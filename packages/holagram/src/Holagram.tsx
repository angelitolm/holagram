'use client'
import { useMemo } from 'react'
import { Widget, type Api, type HolagramProps } from './Widget.js'

const post = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

function fetchApi(base: string): Api {
  return {
    start: async (body) => ({ status: (await post(`${base}/start`, body)).status }),
    verify: async (token) => {
      const res = await post(`${base}/verify`, { token })
      return { status: res.status, visitor: res.ok ? await res.json() : undefined }
    },
    send: async (sid, text) => (await post(`${base}/messages`, { sid, text })).status,
    poll: async (sid, after) => {
      const res = await fetch(`${base}/messages?sid=${sid}&after=${after}`, { cache: 'no-store' })
      return { status: res.status, messages: res.ok ? (await res.json()).messages : undefined }
    },
  }
}

/**
 * The chat widget. Mount it once in your root layout, next to a route handler created with
 * `createHolagram()` from `@angelitolm/holagram/server`.
 */
export function Holagram({ api = '/api/holagram', ...props }: HolagramProps) {
  const client = useMemo(() => fetchApi(api.replace(/\/$/, '')), [api])
  return <Widget {...props} api={client} />
}
