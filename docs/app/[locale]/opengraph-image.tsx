import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { routing } from '@/i18n/routing'

// Social card (Open Graph and Twitter), rendered once per locale at build time.
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'holagram: a chat on your website that reaches you on Telegram'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

const COPY = {
  en: {
    tagline: 'A chat on your website that reaches you on Telegram',
    note: 'Verified emails · replies routed to each visitor',
    chat: ['Hi! I want to hire you 👋', 'Sure! What do you need?', 'A Next.js app by June'],
  },
  es: {
    tagline: 'Un chat en tu web que te llega a Telegram',
    note: 'Emails verificados · respuestas a cada visitante',
    chat: ['¡Hola! Quiero contratarte 👋', '¡Claro! ¿Qué necesitas?', 'Una app en Next.js para junio'],
  },
} as const

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const copy = COPY[locale === 'es' ? 'es' : 'en']
  const logo = `data:image/svg+xml;base64,${(await readFile(join(process.cwd(), 'public/logo.svg'))).toString('base64')}`
  const gradient = 'linear-gradient(135deg, #2aabee, #7c5cff)'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: '72px 80px',
          background: 'radial-gradient(circle at 85% 15%, rgba(42,171,238,.3), transparent 45%), radial-gradient(circle at 10% 100%, rgba(124,92,255,.18), transparent 40%), #111113',
          color: '#f4f4f5',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} width={104} height={104} alt="" />
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, letterSpacing: -2 }}>holagram</div>
          </div>
          <div style={{ display: 'flex', fontSize: 50, fontWeight: 700, lineHeight: 1.15, maxWidth: 600, letterSpacing: -1 }}>{copy.tagline}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 26, color: '#9d9da3' }}>
            <div style={{ display: 'flex', width: 56, height: 6, borderRadius: 3, background: gradient }} />
            {copy.note}
          </div>
        </div>

        {/* A slice of the conversation: visitor on the web, owner from Telegram. */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18, width: 400, marginLeft: 40 }}>
          {copy.chat.map((text, i) => {
            const mine = i !== 1
            return (
              <div
                key={text}
                style={{
                  display: 'flex',
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  padding: '18px 24px',
                  borderRadius: 24,
                  fontSize: 26,
                  maxWidth: 360,
                  background: mine ? gradient : 'rgba(42,171,238,.14)',
                  border: mine ? 'none' : '2px solid rgba(42,171,238,.45)',
                }}
              >
                {text}
              </div>
            )
          })}
        </div>
      </div>
    ),
    size,
  )
}
