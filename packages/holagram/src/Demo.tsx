'use client'
import { useMemo } from 'react'
import { Widget, type Api, type HolagramMessage, type HolagramProps } from './Widget.js'

export type HolagramDemoProps = Omit<HolagramProps, 'api'> & {
  /** What "you" answer from Telegram to each visitor message. */
  reply?: (text: string) => string
}

/**
 * The real widget on a simulated backend, for docs and demos: the email is "verified" by itself after a moment and
 * every message gets an automatic reply. Nothing leaves the browser.
 */
export function HolagramDemo({ reply = () => '👋 This is a simulated reply. In your app, it comes from Telegram.', ...props }: HolagramDemoProps) {
  const api = useMemo<Api>(() => {
    const messages: HolagramMessage[] = []
    let pending = { name: '', email: '', topic: '' }
    return {
      start: async (body) => {
        pending = body
        return { status: 200, demoToken: 'demo' }
      },
      verify: async () => ({ status: 200, visitor: { sid: 'demo', ...pending } }),
      send: async (_sid, text) => {
        messages.push({ from: 'user', text, at: Date.now() })
        setTimeout(() => messages.push({ from: 'owner', text: reply(text), at: Date.now() }), 1500)
        return 200
      },
      poll: async (_sid, after) => ({ status: 200, messages: messages.slice(after) }),
    }
  }, [])
  return <Widget {...props} api={api} />
}
