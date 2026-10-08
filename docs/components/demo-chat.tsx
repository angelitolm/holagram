'use client'
import { es } from '@angelitolm/holagram'
import { HolagramDemo } from '@angelitolm/holagram/demo'
import { useLocale } from 'next-intl'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

type Topic = { id: string; label: string; intro?: string; reply?: string }

// The real widget on a simulated backend: verification passes by itself and "you" answer automatically.
export function DemoChat({ reply, status, topics }: { reply: string; status: string; topics: Topic[] }) {
  const { resolvedTheme } = useTheme()
  const locale = useLocale()
  // The theme is only known in the browser: render after mount so server and client HTML match.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return (
    <HolagramDemo
      owner={{ name: 'Holagram', avatar: '/logo.svg', status }}
      topics={topics.map((t) => (t.reply ? { id: t.id, label: t.label, reply: t.reply } : { id: t.id, label: t.label, intro: t.intro }))}
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      text={locale === 'es' ? es : undefined}
      reply={() => reply}
      dismissible
    />
  )
}
