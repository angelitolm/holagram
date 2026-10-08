/**
 * Holagram server: a website chat bridged to your Telegram.
 *
 * Each visitor who opens a conversation gets a random `sid` (their secret). Their messages reach the owner's
 * Telegram chat, and every message sent stores `tg:<message_id> → sid`. When the owner replies (reply) to one of
 * them, the webhook looks the sid up and delivers the answer ONLY to that visitor's conversation.
 *
 * Before the conversation opens the visitor confirms their email: a one-time link (30 min) is sent through Resend,
 * and the sid is only created when that link is used.
 *
 * No dependencies: Upstash Redis (REST), Telegram and Resend are all plain fetch calls. Works with any runtime that
 * speaks Web Request/Response (Next.js route handlers, Hono, Remix, Bun...).
 */

export type HolagramMessage = { from: 'user' | 'owner'; text: string; at: number }

type Visitor = { name: string; email: string; topic: string }
type Session = Visitor & { createdAt: number }

export type EmailContent = { subject: string; text: string; html: string }

export type HolagramConfig = {
  /** Who the visitor talks to, used in the verification email. Default 'us'. */
  ownerName?: string
  /** Sender of the verification email, on a domain verified in Resend. Default env HOLAGRAM_EMAIL_FROM. */
  emailFrom?: string
  /**
   * Fixed origin for the verification link (never the request's Host). Default env SITE_URL, then
   * https://VERCEL_PROJECT_PRODUCTION_URL, then http://localhost:PORT.
   */
  siteUrl?: string
  /** Builds the verification email (subject, text and html). Default: a short English email. */
  email?: (data: { name: string; link: string; ownerName: string }) => EmailContent
  /** Prefix for every Redis key, to share a database with other apps. Default 'holagram'. */
  prefix?: string
}

const TTL = 60 * 60 * 24 * 30 // 30 days
const VERIFY_TTL = 60 * 30 // 30 min
export const LIMITS = { name: 100, email: 200, topic: 100, text: 2000 }

const env = (name: string) => process.env[name]
const redisUrl = () => env('KV_REST_API_URL') ?? env('UPSTASH_REDIS_REST_URL')
const redisToken = () => env('KV_REST_API_TOKEN') ?? env('UPSTASH_REDIS_REST_TOKEN')

/** Names of the missing variables (never their values), returned in the 503 to make setup easy to debug. */
export function missingConfig(config: HolagramConfig = {}) {
  const missing: string[] = []
  if (!redisUrl()) missing.push('KV_REST_API_URL')
  if (!redisToken()) missing.push('KV_REST_API_TOKEN')
  if (!env('TELEGRAM_BOT_TOKEN')) missing.push('TELEGRAM_BOT_TOKEN')
  if (!env('TELEGRAM_CHAT_ID')) missing.push('TELEGRAM_CHAT_ID')
  if (!env('TELEGRAM_WEBHOOK_SECRET')) missing.push('TELEGRAM_WEBHOOK_SECRET')
  if (!env('RESEND_API_KEY')) missing.push('RESEND_API_KEY')
  if (!(config.emailFrom ?? env('HOLAGRAM_EMAIL_FROM'))) missing.push('HOLAGRAM_EMAIL_FROM')
  return missing
}

/* ── Upstash Redis over REST ───────────────────────────────────────────────── */

type Cmd = (string | number)[]

async function upstash(path: string, body: Cmd | Cmd[]) {
  const res = await fetch(`${redisUrl()}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${redisToken()}` },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
  if (!res.ok || data.error) throw new Error(`Redis: ${data.error ?? res.status}`)
  return data
}

const redis = async <T = unknown>(...cmd: Cmd): Promise<T> => (await upstash('', cmd)).result
const pipeline = (...cmds: Cmd[]) => upstash('/pipeline', cmds)
const parse = <T>(v: string | null): T | null => (v == null ? null : JSON.parse(v))

/* ── Helpers ───────────────────────────────────────────────────────────────── */

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
const isSid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)
// Path the link returns to: same origin only ('//evil.com' would be another host).
const isPath = (v: unknown): v is string => typeof v === 'string' && v.length <= 200 && /^\/(?!\/)[^\s?#\\]*$/.test(v)

const sha256 = async (v: string) =>
  Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))).toString('hex')

const escapeHtml = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const json = (body: unknown, status = 200) => Response.json(body, { status })
const ipOf = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'

export function defaultEmail({ name, link, ownerName }: { name: string; link: string; ownerName: string }): EmailContent {
  const first = name.split(' ')[0]
  return {
    subject: `Confirm your email to chat with ${ownerName}`,
    text: `Hi ${first},\n\nConfirm your email to start chatting with ${ownerName}:\n${link}\n\nThe link expires in 30 minutes. If you didn't request it, ignore this email.`,
    html: `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border:1px solid #e4e4e7;border-radius:20px;padding:32px">
<tr><td style="font-size:16px;line-height:1.6">Hi ${escapeHtml(first)}, confirm your email to start chatting with ${escapeHtml(ownerName)}. Your messages reach them directly, and they reply right in the chat.</td></tr>
<tr><td style="padding:28px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:linear-gradient(90deg,#2aabee,#7c5cff);color:#fff;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:12px">Confirm and open chat</a></td></tr>
<tr><td style="font-size:13px;line-height:1.6;color:#71717a">The link expires in 30 minutes and works once. If you didn't request it, ignore this email.</td></tr>
</table></td></tr></table></body></html>`,
  }
}

/** Plain text (no parse_mode): the visitor's text can't inject formatting. Returns the message_id. */
export async function sendTelegram(text: string): Promise<number> {
  const res = await fetch(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env('TELEGRAM_CHAT_ID'), text, link_preview_options: { is_disabled: true } }),
    cache: 'no-store',
  })
  const data = await res.json()
  if (!data.ok) throw new Error(`Telegram: ${data.description}`)
  return data.result.message_id
}

/* ── Holagram ──────────────────────────────────────────────────────────────── */

type TelegramUpdate = {
  message?: { message_id: number; chat: { id: number }; text?: string; reply_to_message?: { message_id: number } }
}

/**
 * Builds the route handler. Mount it on a dynamic segment named `action`:
 *
 * ```ts
 * // app/api/holagram/[action]/route.ts
 * export const { GET, POST } = createHolagram()
 * ```
 *
 * Endpoints (the last path segment): POST start, POST verify, GET/POST messages, POST webhook.
 */
export function createHolagram(config: HolagramConfig = {}) {
  const ownerName = config.ownerName ?? 'us'
  const prefix = config.prefix ?? 'holagram'
  const renderEmail = config.email ?? defaultEmail
  const site = () =>
    (
      config.siteUrl ??
      env('SITE_URL') ??
      (env('VERCEL_PROJECT_PRODUCTION_URL') ? `https://${env('VERCEL_PROJECT_PRODUCTION_URL')}` : `http://localhost:${env('PORT') || 3000}`)
    ).replace(/\/$/, '')

  const k = {
    verify: (hash: string) => `${prefix}:verify:${hash}`,
    session: (sid: string) => `${prefix}:${sid}`,
    msgs: (sid: string) => `${prefix}:${sid}:msgs`,
    tg: (messageId: number) => `${prefix}:tg:${messageId}`,
    rl: (key: string) => `${prefix}:rl:${key}`,
  }

  /** Counter per 1h window; true when over the limit. */
  async function rateLimited(key: string, max: number) {
    const n = await redis<number>('INCR', k.rl(key))
    if (n === 1) await redis('EXPIRE', k.rl(key), 3600)
    return n > max
  }

  const getSession = async (sid: string) => parse<Session>(await redis(`GET`, k.session(sid)))
  const linkTelegram = (messageId: number, sid: string) => redis('SET', k.tg(messageId), sid, 'EX', TTL)

  async function pushMessage(sid: string, msg: HolagramMessage) {
    await pipeline(['RPUSH', k.msgs(sid), JSON.stringify(msg)], ['EXPIRE', k.msgs(sid), TTL], ['EXPIRE', k.session(sid), TTL])
  }

  async function start(req: Request) {
    const missing = missingConfig(config)
    if (missing.length) return json({ error: 'not_configured', missing }, 503)

    const body = await req.json().catch(() => null)
    const name = String(body?.name ?? '').trim()
    const email = String(body?.email ?? '').trim()
    const topic = String(body?.topic ?? '').trim()
    const path = isPath(body?.path) ? body.path : '/'
    if (!name || name.length > LIMITS.name || !isEmail(email) || email.length > LIMITS.email || !topic || topic.length > LIMITS.topic) {
      return json({ error: 'invalid' }, 400)
    }
    if ((await rateLimited(`start:${ipOf(req)}`, 5)) || (await rateLimited(`email:${email.toLowerCase()}`, 3))) {
      return json({ error: 'rate_limited' }, 429)
    }

    // Only the token's hash is stored: whoever reads Redis can't use pending links.
    const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
    await redis('SET', k.verify(await sha256(token)), JSON.stringify({ name, email, topic } satisfies Visitor), 'EX', VERIFY_TTL)
    const link = `${site()}${path}?holagram_token=${token}`
    const content = renderEmail({ name, link, ownerName })
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.emailFrom ?? env('HOLAGRAM_EMAIL_FROM'), to: email, ...content }),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Resend: ${res.status} ${await res.text()}`)
    return json({ pending: true })
  }

  async function verify(req: Request) {
    if (missingConfig(config).length) return json({ error: 'not_configured' }, 503)
    const body = await req.json().catch(() => null)
    const token = String(body?.token ?? '')
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return json({ error: 'invalid' }, 400)
    if (await rateLimited(`verify:${ipOf(req)}`, 20)) return json({ error: 'rate_limited' }, 429)

    // GETDEL: the link works once.
    const visitor = parse<Visitor>(await redis('GETDEL', k.verify(await sha256(token))))
    if (!visitor) return json({ error: 'expired' }, 410)

    const sid = crypto.randomUUID()
    await redis('SET', k.session(sid), JSON.stringify({ ...visitor, createdAt: Date.now() } satisfies Session), 'EX', TTL)
    const messageId = await sendTelegram(
      `🆕 New chat #${sid.slice(0, 6)}\n${visitor.topic}\n\n👤 ${visitor.name}\n✉️ ${visitor.email}\n\n↩️ Reply to this message to answer this visitor.`,
    )
    await linkTelegram(messageId, sid)
    return json({ sid, ...visitor })
  }

  async function poll(req: Request) {
    if (missingConfig(config).length) return json({ error: 'not_configured' }, 503)
    const url = new URL(req.url)
    const sid = url.searchParams.get('sid')
    const after = Math.max(0, Math.floor(Number(url.searchParams.get('after'))) || 0)
    if (!isSid(sid) || !(await getSession(sid))) return json({ error: 'not_found' }, 404)
    const raw = await redis<string[]>('LRANGE', k.msgs(sid), after, -1)
    return json({ messages: raw.map((m) => JSON.parse(m) as HolagramMessage) })
  }

  async function send(req: Request) {
    if (missingConfig(config).length) return json({ error: 'not_configured' }, 503)
    const body = await req.json().catch(() => null)
    const sid = body?.sid
    const text = String(body?.text ?? '').trim()
    if (!isSid(sid) || !text || text.length > LIMITS.text) return json({ error: 'invalid' }, 400)

    const session = await getSession(sid)
    if (!session) return json({ error: 'not_found' }, 404)
    if (await rateLimited(`msg:${sid}`, 40)) return json({ error: 'rate_limited' }, 429)

    await pushMessage(sid, { from: 'user', text, at: Date.now() })
    await linkTelegram(await sendTelegram(`💬 #${sid.slice(0, 6)} · ${session.name}\n\n${text}`), sid)
    return json({ ok: true })
  }

  /** Telegram → the visitor whose message the owner replied to. Always 200 so Telegram doesn't retry. */
  async function webhook(req: Request) {
    if (missingConfig(config).length || req.headers.get('x-telegram-bot-api-secret-token') !== env('TELEGRAM_WEBHOOK_SECRET')) {
      return json({ ok: false }, 401)
    }
    const { message } = ((await req.json().catch(() => null)) ?? {}) as TelegramUpdate
    if (!message?.text || String(message.chat.id) !== env('TELEGRAM_CHAT_ID')) return json({ ok: true })

    if (message.text.startsWith('/')) {
      await sendTelegram('✅ Holagram is connected. Reply (swipe ↩️) to a visitor message to answer them.').catch(() => {})
      return json({ ok: true })
    }

    const target = message.reply_to_message?.message_id
    const sid = target ? await redis<string | null>('GET', k.tg(target)) : null
    if (sid && (await getSession(sid))) {
      await pushMessage(sid, { from: 'owner', text: message.text, at: Date.now() })
      await linkTelegram(message.message_id, sid) // replying to your own messages in the thread works too
    } else {
      await sendTelegram('⚠️ Not delivered. Reply (swipe ↩️) to a visitor message so I know who it is for.').catch(() => {})
    }
    return json({ ok: true })
  }

  const routes: Record<string, (req: Request) => Promise<Response>> = {
    'POST start': start,
    'POST verify': verify,
    'GET messages': poll,
    'POST messages': send,
    'POST webhook': webhook,
  }

  async function handler(req: Request) {
    const action = new URL(req.url).pathname.split('/').filter(Boolean).pop()
    const route = routes[`${req.method} ${action}`]
    if (!route) return json({ error: 'not_found' }, 404)
    try {
      return await route(req)
    } catch (e) {
      console.error(`[holagram] ${action} failed`, e)
      // A webhook that fails must still answer 200, or Telegram retries the same update for hours.
      return action === 'webhook' ? json({ ok: true }) : json({ error: 'failed' }, 502)
    }
  }

  return { GET: handler, POST: handler }
}
