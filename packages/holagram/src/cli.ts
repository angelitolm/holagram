#!/usr/bin/env node
// holagram: one-time Telegram setup from your terminal. Reads .env.local and .env from the current folder.
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'

for (const file of ['.env.local', '.env']) if (existsSync(file)) process.loadEnvFile(file)

const [command, arg] = process.argv.slice(2)
const token = process.env.TELEGRAM_BOT_TOKEN

async function telegram(method: string, body?: unknown) {
  if (!token) fail('TELEGRAM_BOT_TOKEN is not set (in the environment, .env.local or .env).')
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const data = await res.json()
  if (!data.ok) fail(`Telegram: ${data.description}`)
  return data.result
}

function fail(message: string): never {
  console.error(`✖ ${message}`)
  process.exit(1)
}

const HELP = `Usage: holagram <command>

  secret          Print a random value for TELEGRAM_WEBHOOK_SECRET
  chat-id         List the chats that wrote to your bot (press Start in your bot first)
  webhook <url>   Point Telegram at your deployed site, e.g. holagram webhook https://example.com
                  (registers <url>/api/holagram/webhook; pass a full URL ending in /webhook to use another path)
  status          Show the webhook Telegram has registered`

switch (command) {
  case 'secret':
    console.log(randomBytes(32).toString('hex'))
    break

  case 'chat-id': {
    const updates: { message?: { chat: { id: number; type: string; first_name?: string; username?: string; title?: string } } }[] =
      await telegram('getUpdates').catch(() => fail('getUpdates failed. If a webhook is set, run `holagram webhook --delete` first.'))
    const chats = new Map(updates.flatMap((u) => (u.message ? [[u.message.chat.id, u.message.chat] as const] : [])))
    if (!chats.size) fail('No messages yet. Open your bot in Telegram, press Start (or send any message) and run this again.')
    for (const c of chats.values()) console.log(`${c.id}\t${c.type}\t${c.title ?? c.first_name ?? ''} ${c.username ? `@${c.username}` : ''}`)
    console.log('\nSet TELEGRAM_CHAT_ID to the id of your private chat.')
    break
  }

  case 'webhook': {
    if (arg === '--delete') {
      await telegram('deleteWebhook')
      console.log('✔ Webhook deleted.')
      break
    }
    if (!arg || !/^https:\/\//.test(arg)) fail('Pass the public https URL of your site, e.g. holagram webhook https://example.com')
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (!secret) fail('TELEGRAM_WEBHOOK_SECRET is not set. Generate one with `holagram secret`.')
    const url = arg.endsWith('/webhook') ? arg : `${arg.replace(/\/$/, '')}/api/holagram/webhook`
    await telegram('setWebhook', { url, secret_token: secret, allowed_updates: ['message'] })
    console.log(`✔ Telegram now sends your replies to ${url}`)
    break
  }

  case 'status': {
    const info = await telegram('getWebhookInfo')
    console.log(JSON.stringify(info, null, 2))
    break
  }

  default:
    console.log(HELP)
}
