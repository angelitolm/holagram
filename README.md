<p align="center"><img src="https://raw.githubusercontent.com/angelitolm/holagram/main/docs/public/logo.svg" width="96" height="96" alt="holagram logo"></p>

<h1 align="center">holagram</h1>

<p align="center">A chat on your website that reaches you on Telegram. Visitors confirm their email, you reply from your phone, and each answer goes back only to that visitor.</p>

<p align="center">
  <a href="https://github.com/angelitolm/holagram/actions/workflows/ci.yml"><img src="https://github.com/angelitolm/holagram/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@angelitolm/holagram#provenance"><img src="https://img.shields.io/badge/npm-provenance-2ea44f?logo=npm" alt="npm provenance"></a>
</p>

<p align="center"><a href="https://holagram.angellm.dev">Docs</a> · <a href="https://holagram.angellm.dev/en/demo">Live demo</a></p>

---

```bash
pnpm add @angelitolm/holagram
```

No dependencies. The widget needs React 18 or 19; the server is a Web `Request → Response` handler (Next.js App Router, Hono, Remix, Bun...).

## How it works

1. The visitor opens the chat, writes their name and email and picks an option. Options with a `reply` are answered right there.
2. For an option that needs you, they get an email with a one-time link (Resend).
3. The link brings them back, the chat confirms the email and opens the conversation: your Telegram gets a card with their name, email and topic.
4. Their messages reach your Telegram. **Reply** to one (swipe ↩️) and the answer shows up in their chat.

Every message sent to you stores `message_id → conversation` in Upstash Redis, so a Telegram reply always finds its visitor. One bot, one private chat, no groups.

## Server

```ts
// app/api/holagram/[action]/route.ts
import { createHolagram } from '@angelitolm/holagram/server'

export const { GET, POST } = createHolagram({ ownerName: 'Ana' })
```

## Widget

```tsx
// app/layout.tsx
import { Holagram } from '@angelitolm/holagram'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Holagram
          owner={{ name: 'Ana', avatar: '/me.jpg', status: 'Usually replies within a few hours' }}
          topics={[
            { id: 'hire', label: '💼 I want to hire you', intro: 'Tell me what you need and your timeline.' },
            { id: 'question', label: '💬 Another question' },
            { id: 'rates', label: '💲 Rates', reply: 'I work hourly from $25/h.', links: [{ href: '/services', label: 'Services' }] },
          ]}
        />
      </body>
    </html>
  )
}
```

Open it from your own button with `openHolagram()`, close it with `closeHolagram()`. Style the launcher with `launcherStyle`, let visitors hide it with `dismissible`, and hook into `onLoad`, `onShow`, `onClose` and `onDismiss`. Spanish strings ship ready: `import { es } from '@angelitolm/holagram'` and `text={es}`. Colors are CSS variables: `[data-holagram] { --hg-from: #a855f7; --hg-to: #3b82f6 }`.

## Environment

```bash
TELEGRAM_BOT_TOKEN=          # @BotFather → /newbot
TELEGRAM_CHAT_ID=            # npx holagram chat-id (press Start in your bot first)
TELEGRAM_WEBHOOK_SECRET=     # npx holagram secret
KV_REST_API_URL=             # Upstash Redis (or UPSTASH_REDIS_REST_URL)
KV_REST_API_TOKEN=           # (or UPSTASH_REDIS_REST_TOKEN)
RESEND_API_KEY=
HOLAGRAM_EMAIL_FROM="Ana <chat@your-domain.com>"
```

After deploying, point Telegram at your site once:

```bash
npx holagram webhook https://your-site.com
```

If a variable is missing the widget shows "offline" and `POST /api/holagram/start` answers `503` with the names (never the values) of what's missing.

## Security

The conversation only exists after the email link is opened; Redis keeps only the token's hash, and the link works once for 30 minutes. The link's origin is fixed by config, never the request's `Host`. The webhook requires Telegram's secret header and only reads your chat. Messages reach Telegram as plain text. Rate limits per IP, email and conversation. Everything expires after 30 days. See [Security](https://holagram.angellm.dev/en/security).

## License

MIT
