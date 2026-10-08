import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHolagram } from './server.ts'

// The whole flow against fakes of Upstash (a tiny in-memory Redis), Telegram and Resend.
Object.assign(process.env, {
  KV_REST_API_URL: 'https://redis.test',
  KV_REST_API_TOKEN: 'redis-token',
  TELEGRAM_BOT_TOKEN: 'bot-token',
  TELEGRAM_CHAT_ID: '42',
  TELEGRAM_WEBHOOK_SECRET: 'hook-secret',
  RESEND_API_KEY: 're_test',
  HOLAGRAM_EMAIL_FROM: 'Chat <chat@example.com>',
  SITE_URL: 'https://example.com',
})

const db = new Map<string, unknown>()
const telegram: string[] = []
const emails: { to: string; text: string }[] = []

function exec([cmd, key, ...args]: (string | number)[]): unknown {
  const k = String(key)
  switch (cmd) {
    case 'SET': db.set(k, args[0]); return 'OK'
    case 'GET': return db.get(k) ?? null
    case 'GETDEL': { const v = db.get(k) ?? null; db.delete(k); return v }
    case 'INCR': { const n = Number(db.get(k) ?? 0) + 1; db.set(k, n); return n }
    case 'EXPIRE': return 1
    case 'RPUSH': { const l = (db.get(k) as string[]) ?? []; l.push(String(args[0])); db.set(k, l); return l.length }
    case 'LRANGE': return ((db.get(k) as string[]) ?? []).slice(Number(args[0]))
    default: throw new Error(`unexpected ${cmd}`)
  }
}

globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  const url = String(input)
  const body = JSON.parse(String(init?.body))
  if (url === 'https://redis.test') return Response.json({ result: exec(body) })
  if (url === 'https://redis.test/pipeline') return Response.json(body.map((c: string[]) => ({ result: exec(c) })))
  if (url.endsWith('/sendMessage')) {
    telegram.push(body.text)
    return Response.json({ ok: true, result: { message_id: 1000 + telegram.length } })
  }
  if (url === 'https://api.resend.com/emails') {
    emails.push(body)
    return Response.json({ id: 'email' })
  }
  throw new Error(`unexpected fetch ${url}`)
}) as typeof fetch

const { GET, POST } = createHolagram({ ownerName: 'Ana' })
const call = (method: 'GET' | 'POST', path: string, body?: unknown, headers: Record<string, string> = {}) =>
  (method === 'GET' ? GET : POST)(
    new Request(`https://example.com/api/holagram/${path}`, {
      method,
      headers: { 'x-forwarded-for': '1.2.3.4', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
const webhook = (message: unknown, secret = 'hook-secret') =>
  call('POST', 'webhook', { message }, { 'x-telegram-bot-api-secret-token': secret })

test('verify email, chat, and route the owner reply to that visitor only', async () => {
  const start = await call('POST', 'start', { name: 'Bob Smith', email: 'bob@example.com', topic: '💼 Hire', path: '/contact' })
  assert.equal(start.status, 200)
  assert.equal(telegram.length, 0, 'nothing reaches Telegram before the email is verified')

  const token = emails[0].text.match(/https:\/\/example\.com\/contact\?holagram_token=([\w-]{43})/)?.[1]
  assert.ok(token, 'the link uses SITE_URL and the visitor path')

  const verified = await call('POST', 'verify', { token })
  const { sid, name, topic } = await verified.json()
  assert.equal(name, 'Bob Smith')
  assert.equal(topic, '💼 Hire')
  assert.match(telegram[0], /New chat/)
  assert.equal((await call('POST', 'verify', { token })).status, 410, 'the link works once')

  assert.equal((await call('POST', 'messages', { sid, text: 'Hello!' })).status, 200)
  assert.match(telegram[1], /Bob Smith\n\nHello!/)

  // Owner replies to message 1002 (the visitor's "Hello!").
  assert.equal((await webhook({ message_id: 7, chat: { id: 42 }, text: 'Hi Bob', reply_to_message: { message_id: 1002 } })).status, 200)
  const { messages } = await (await call('GET', `messages?sid=${sid}&after=1`)).json()
  assert.deepEqual(messages.map((m: { from: string; text: string }) => [m.from, m.text]), [['owner', 'Hi Bob']])

  // A reply that isn't a reply is not delivered, and the owner is told.
  await webhook({ message_id: 8, chat: { id: 42 }, text: 'lost' })
  assert.match(telegram.at(-1)!, /Not delivered/)
})

test('rejects bad input, other chats and a wrong webhook secret', async () => {
  assert.equal((await call('POST', 'start', { name: 'X', email: 'nope', topic: 't' })).status, 400)
  assert.equal((await call('POST', 'verify', { token: 'short' })).status, 400)
  assert.equal((await call('GET', 'messages?sid=00000000-0000-0000-0000-000000000000')).status, 404)
  assert.equal((await webhook({ message_id: 1, chat: { id: 42 }, text: 'x' }, 'wrong')).status, 401)

  const before = telegram.length
  await webhook({ message_id: 9, chat: { id: 666 }, text: 'spam', reply_to_message: { message_id: 1002 } })
  assert.equal(telegram.length, before, 'messages from other chats are ignored')
})

test('a path to another host falls back to /', async () => {
  await call('POST', 'start', { name: 'Eve', email: 'eve@example.com', topic: 'q', path: '//evil.com' })
  assert.match(emails.at(-1)!.text, /https:\/\/example\.com\/\?holagram_token=/)
})

test('reports missing variables by name', async () => {
  const saved = process.env.RESEND_API_KEY
  delete process.env.RESEND_API_KEY
  const res = await call('POST', 'start', { name: 'Bob', email: 'bob@example.com', topic: 't' })
  process.env.RESEND_API_KEY = saved
  assert.equal(res.status, 503)
  assert.deepEqual((await res.json()).missing, ['RESEND_API_KEY'])
})
