import type { ComponentType } from 'react'
import { Code, Driver, Flash, Home2, MessageQuestion, Messages2, Send2, ShieldTick, Sms, type Icon } from 'iconsax-reactjs'
import type { Locale } from '@/i18n/routing'

// Single source of truth for the wiki: order drives the sidebar and prev/next links.
// Titles and descriptions live in messages/<locale>.json under `pages.<slug>`.
export const SECTIONS = [
  { key: 'start', pages: ['index', 'getting-started'] },
  { key: 'guide', pages: ['telegram', 'email', 'widget', 'server'] },
  { key: 'reference', pages: ['security', 'troubleshooting'] },
  { key: 'project', pages: ['contributing'] },
] as const

export type Slug = (typeof SECTIONS)[number]['pages'][number]

export const SLUGS: Slug[] = SECTIONS.flatMap((s) => [...s.pages])

export const isSlug = (v: string): v is Slug => (SLUGS as string[]).includes(v)

export const ICONS: Record<Slug, Icon> = {
  index: Home2,
  'getting-started': Flash,
  telegram: Send2,
  email: Sms,
  widget: Messages2,
  server: Driver,
  security: ShieldTick,
  troubleshooting: MessageQuestion,
  contributing: Code,
}

// The home page lives at /<locale>, every other page at /<locale>/<slug>.
export const hrefOf = (slug: Slug) => (slug === 'index' ? '/' : `/${slug}`)

export function neighbours(slug: Slug) {
  const i = SLUGS.indexOf(slug)
  return { prev: SLUGS[i - 1] as Slug | undefined, next: SLUGS[i + 1] as Slug | undefined }
}

type Loader = () => Promise<{ default: ComponentType }>

// Static import map: every path is visible to the bundler (no template-literal imports).
const CONTENT: Record<Locale, Record<Slug, Loader>> = {
  en: {
    index: () => import('@/content/en/index.mdx'),
    'getting-started': () => import('@/content/en/getting-started.mdx'),
    telegram: () => import('@/content/en/telegram.mdx'),
    email: () => import('@/content/en/email.mdx'),
    widget: () => import('@/content/en/widget.mdx'),
    server: () => import('@/content/en/server.mdx'),
    security: () => import('@/content/en/security.mdx'),
    troubleshooting: () => import('@/content/en/troubleshooting.mdx'),
    contributing: () => import('@/content/en/contributing.mdx'),
  },
  es: {
    index: () => import('@/content/es/index.mdx'),
    'getting-started': () => import('@/content/es/getting-started.mdx'),
    telegram: () => import('@/content/es/telegram.mdx'),
    email: () => import('@/content/es/email.mdx'),
    widget: () => import('@/content/es/widget.mdx'),
    server: () => import('@/content/es/server.mdx'),
    security: () => import('@/content/es/security.mdx'),
    troubleshooting: () => import('@/content/es/troubleshooting.mdx'),
    contributing: () => import('@/content/es/contributing.mdx'),
  },
}

export async function loadPage(locale: Locale, slug: Slug): Promise<ComponentType> {
  return (await CONTENT[locale][slug]()).default
}

export const REPO = 'https://github.com/angelitolm/holagram'
export const REPO_PUBLIC = false // true once the GitHub repo is public
export const editUrl = (locale: Locale, slug: Slug) => `${REPO}/edit/main/docs/content/${locale}/${slug}.mdx`
