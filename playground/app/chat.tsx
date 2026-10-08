'use client'
import { Holagram } from '@angelitolm/holagram'

export function Chat() {
  return (
    <Holagram
      owner={{ name: 'Playground', status: 'Replies from Telegram' }}
      topics={[
        { id: 'hire', label: '💼 I want to hire you', intro: 'Tell me what you need, your timeline and a rough budget.' },
        { id: 'question', label: '💬 Another question' },
        { id: 'docs', label: '📚 Read the docs', reply: 'Everything is documented.', links: [{ href: 'https://holagram.angellm.dev', label: 'Docs' }] },
      ]}
    />
  )
}
