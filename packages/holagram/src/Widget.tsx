'use client'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { css } from './styles.js'
import { TEXT, type HolagramText } from './text.js'

/** Opens the chat from anywhere, e.g. a "Let's talk" button in your navbar. */
export const openHolagram = () => window.dispatchEvent(new Event('holagram:open'))
/** Closes the chat from anywhere. */
export const closeHolagram = () => window.dispatchEvent(new Event('holagram:close'))

/**
 * A menu option. With `reply` it's answered right in the widget; without it, it opens a conversation
 * with you on Telegram (after the visitor confirms their email) and `intro` is said once connected.
 */
export type HolagramTopic =
  | { id: string; label: string; intro?: string }
  | { id: string; label: string; reply: string; links?: { href: string; label: string }[] }

export type HolagramProps = {
  /** Who answers: shown in the header and in the messages. */
  owner: { name: string; avatar?: string; status?: string }
  /** Menu options after name and email. Default: one option that opens the conversation. */
  topics?: HolagramTopic[]
  /** Base path of the route handler. Default '/api/holagram'. */
  api?: string
  /** Corner for the button and the chat. Default 'bottom-right'. */
  position?: 'bottom-right' | 'bottom-left'
  /** 'always' shows the round button; 'started' only once there is a conversation to go back to. Default 'always'. */
  launcher?: 'always' | 'started'
  /**
   * Replaces the round chat button with your own content: an avatar, an image, an icon. Clicking anywhere on it opens
   * the chat. Make it (or put inside it) a button, so keyboard users can reach it.
   */
  launcherIcon?: ReactNode
  /**
   * Inline styles for the launcher: the round button, or the circle around `launcherIcon`. Inline, because the widget
   * lives in a shadow root that your page's CSS classes can't reach.
   */
  launcherStyle?: CSSProperties
  /**
   * Adds a small × to the launcher that hides it for the rest of the browser session. `openHolagram()` still opens the
   * chat, and a new reply brings the launcher back.
   */
  dismissible?: boolean
  /** The widget is ready (its saved conversation, if any, is loaded). */
  onLoad?: () => void
  /** The chat opened. */
  onShow?: () => void
  /** The chat closed. */
  onClose?: () => void
  /** The visitor hid the launcher with its ×. */
  onDismiss?: () => void
  /** Default 'auto' (follows the OS). */
  theme?: 'auto' | 'light' | 'dark'
  /** Translate or reword any string. */
  text?: Partial<Omit<HolagramText, 'placeholder'>> & { placeholder?: Partial<HolagramText['placeholder']> }
}

export type HolagramMessage = { from: 'user' | 'owner'; text: string; at: number }
type Visitor = { sid: string; name: string; email: string; topic: string }

/** The four calls the widget makes. The real one is fetch; the docs demo passes a simulated one. */
export type Api = {
  start(body: { name: string; email: string; topic: string; path: string }): Promise<{ status: number; demoToken?: string }>
  verify(token: string): Promise<{ status: number; visitor?: Visitor }>
  send(sid: string, text: string): Promise<number>
  poll(sid: string, after: number): Promise<{ status: number; messages?: HolagramMessage[] }>
}

type From = 'bot' | 'user' | 'owner'
type Msg = { from: From; text: string; links?: { href: string; label: string }[] }
type Step = 'identify' | 'topic' | 'verify' | 'chat'
type State = { step: Step; name: string; email: string; topic?: string; sid?: string; serverCount: number; transcript: Msg[] }

const STORAGE_KEY = 'holagram:v1'
const DISMISSED_KEY = 'holagram:dismissed'
const TOKEN_PARAM = 'holagram_token'
const DEFAULT_TOPICS: HolagramTopic[] = [{ id: 'chat', label: '💬 Start a conversation' }]
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)

export function Widget({ owner, topics = DEFAULT_TOPICS, position = 'bottom-right', launcher = 'always', launcherIcon, launcherStyle, dismissible, onLoad, onShow, onClose, onDismiss, theme = 'auto', text, api }: Omit<HolagramProps, 'api'> & { api: Api }) {
  const t = { ...TEXT, ...text, placeholder: { ...TEXT.placeholder, ...text?.placeholder } }
  const fresh = (): State => ({ step: 'identify', name: '', email: '', serverCount: 0, transcript: [{ from: 'bot', text: t.greeting(owner.name) }] })

  const host = useRef<HTMLDivElement>(null)
  const [root, setRoot] = useState<ShadowRoot | null>(null)
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<State | null>(null) // null until loaded from localStorage
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [unread, setUnread] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  // The identify form, prefilled with what the visitor already gave (e.g. after "Use another email").
  const [who, setWho] = useState({ name: '', email: '' })
  const [badEmail, setBadEmail] = useState(false)
  const openRef = useRef(open)
  openRef.current = open

  // Shadow root: the page's CSS can't reach the widget, and the widget's can't leak out.
  useEffect(() => setRoot(host.current!.shadowRoot ?? host.current!.attachShadow({ mode: 'open' })), [])

  // localStorage only exists on the client: loading after mount avoids a hydration mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      setState(raw ? { ...fresh(), ...JSON.parse(raw) } : fresh())
    } catch {
      setState(fresh())
    }
  }, [])
  useEffect(() => {
    if (!state) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {}
  }, [state])

  // Another tab (e.g. the one the email link opened) changed the conversation: follow it.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        setState({ ...fresh(), ...JSON.parse(e.newValue) })
      } catch {}
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    const onOpen = () => {
      setOpen(true)
      setUnread(false)
    }
    const onCloseEvent = () => setOpen(false)
    window.addEventListener('holagram:open', onOpen)
    window.addEventListener('holagram:close', onCloseEvent)
    try {
      setDismissed(sessionStorage.getItem(DISMISSED_KEY) === '1')
    } catch {}
    return () => {
      window.removeEventListener('holagram:open', onOpen)
      window.removeEventListener('holagram:close', onCloseEvent)
    }
  }, [])

  // onShow / onClose on every change of `open`, not on the first render.
  const wasOpen = useRef<boolean | null>(null)
  useEffect(() => {
    if (wasOpen.current === null || wasOpen.current === open) {
      wasOpen.current = open
      return
    }
    wasOpen.current = open
    ;(open ? onShow : onClose)?.()
  }, [open])

  function dismiss() {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1')
    } catch {}
    onDismiss?.()
  }

  const say = useCallback((...msgs: Msg[]) => setState((s) => s && { ...s, transcript: [...s.transcript, ...msgs] }), [])

  const verify = useCallback(async (token: string) => {
    setOpen(true)
    setBusy(true)
    try {
      const { status, visitor } = await api.verify(token)
      if (!visitor) {
        setState((s) => s && {
          ...s,
          step: s.sid ? 'chat' : s.email ? 'topic' : 'identify',
          transcript: [...s.transcript, { from: 'bot', text: status === 410 || status === 400 ? t.linkExpired : t.verifyFailed }],
        })
        return
      }
      const topic = topics.find((o) => o.label === visitor.topic)
      const intro = topic && 'intro' in topic && topic.intro ? topic.intro : t.connected(owner.name)
      setState((s) => s && {
        ...s,
        ...visitor,
        serverCount: 0,
        step: 'chat',
        transcript: [...s.transcript, { from: 'bot', text: t.verified(owner.name) }, { from: 'bot', text: intro }],
      })
    } catch {
      say({ from: 'bot', text: t.verifyFailed })
    } finally {
      setBusy(false)
    }
  }, [api])

  // Back from the email link (?holagram_token=…): verify and open the conversation.
  const loaded = state !== null
  const loadFired = useRef(false) // once, even when Strict Mode runs effects twice
  useEffect(() => {
    if (!loaded || loadFired.current) return
    loadFired.current = true
    onLoad?.()
  }, [loaded])
  useEffect(() => {
    if (!loaded) return
    const url = new URL(window.location.href)
    const token = url.searchParams.get(TOKEN_PARAM)
    if (!token) return
    url.searchParams.delete(TOKEN_PARAM)
    window.history.replaceState(window.history.state, '', url) // one-time token: out of the URL
    verify(token)
  }, [loaded])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [state?.transcript.length, open, busy])

  useEffect(() => {
    if (state?.step === 'identify') setWho({ name: state.name, email: state.email })
  }, [state?.step])

  useEffect(() => {
    if (open) (state?.step === 'identify' ? nameRef : inputRef).current?.focus()
  }, [open, state?.step])

  // Replies: fast polling with the chat open, slow when closed, none while the tab is hidden.
  const sid = state?.sid
  const serverCount = state?.serverCount ?? 0
  useEffect(() => {
    if (!sid) return
    let stopped = false
    const poll = async () => {
      if (document.hidden) return
      try {
        const { status, messages } = await api.poll(sid, serverCount)
        if (stopped) return
        if (status === 404) return setState((s) => s && { ...fresh(), name: s.name, email: s.email }) // conversation expired
        if (!messages?.length) return
        const replies = messages.filter((m) => m.from === 'owner').map((m) => ({ from: 'owner' as const, text: m.text }))
        setState((s) => s && { ...s, serverCount: s.serverCount + messages.length, transcript: [...s.transcript, ...replies] })
        if (replies.length && !openRef.current) setUnread(true)
      } catch {}
    }
    const id = setInterval(poll, open ? 4000 : 20000)
    poll()
    return () => {
      stopped = true
      clearInterval(id)
    }
  }, [sid, serverCount, open, api])

  /** Sends (or resends) the verification link to the visitor's email. */
  async function requestLink(topic: string) {
    if (!state) return
    setBusy(true)
    try {
      const { status, demoToken } = await api.start({ name: state.name, email: state.email, topic, path: window.location.pathname })
      if (status !== 200) return say({ from: 'bot', text: status === 429 ? t.rateLimited : t.offline })
      setState((s) => s && { ...s, topic, step: 'verify', transcript: [...s.transcript, { from: 'bot', text: t.emailSent(s.email) }] })
      if (demoToken) setTimeout(() => verify(demoToken), 1500)
    } catch {
      say({ from: 'bot', text: t.offline })
    } finally {
      setBusy(false)
    }
  }

  async function choose(topic: HolagramTopic) {
    say({ from: 'user', text: topic.label })
    if ('reply' in topic) return say({ from: 'bot', text: topic.reply, links: topic.links }, { from: 'bot', text: t.anythingElse })
    await requestLink(topic.label)
  }

  function identify(e: FormEvent) {
    e.preventDefault()
    const name = who.name.trim().slice(0, 100)
    const email = who.email.trim()
    if (!state || !name) return
    if (!isEmail(email)) return setBadEmail(true)
    setBadEmail(false)
    setState({
      ...state,
      name,
      email,
      step: 'topic',
      transcript: [...state.transcript, { from: 'user', text: `${name} · ${email}` }, { from: 'bot', text: t.askTopic(name.split(' ')[0]) }],
    })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = input.trim()
    if (!state || !value || busy) return
    setInput('')

    if (state.step === 'chat' && state.sid) {
      say({ from: 'user', text: value })
      setBusy(true)
      try {
        const status = await api.send(state.sid, value.slice(0, 2000))
        if (status !== 200) say({ from: 'bot', text: status === 429 ? t.slowDown : t.notSent })
      } catch {
        say({ from: 'bot', text: t.notSent })
      } finally {
        setBusy(false)
      }
    }
  }

  const started = !!state && state.transcript.length > 1
  const locked = state?.step === 'topic' || state?.step === 'verify'
  const placeholder = !state || state.step === 'identify' ? '' : t.placeholder[state.step]

  const ui = state && (
    <div className={`hg ${position === 'bottom-left' ? 'hg-left' : ''}`}>
      {!open && (launcher === 'always' || started) && (!dismissed || unread) && (
        <div className="hg-dock">
          {launcherIcon ? (
            // ponytail: a div, not a button: custom content is often interactive itself (e.g. a <button>), and
            // buttons can't nest. A click anywhere inside bubbles up here and opens the chat.
            <div className="hg-launcher hg-custom" onClick={openHolagram}>
              <span className="hg-ring" style={launcherStyle}>
                {launcherIcon}
              </span>
              <span className="hg-badge" aria-hidden="true" />
              {unread && <span className="hg-dot" />}
            </div>
          ) : (
            <button className="hg-launcher" style={launcherStyle} onClick={openHolagram} aria-label={t.open}>
              <BotIcon />
              <span className="hg-badge" aria-hidden="true" />
              {unread && <span className="hg-dot" />}
            </button>
          )}
          {dismissible && (
            <button className="hg-dismiss" onClick={dismiss} aria-label={t.dismiss} title={t.dismiss}>
              <CloseIcon size={12} />
            </button>
          )}
        </div>
      )}

      {open && (
        <section className="hg-panel" role="dialog" aria-label={t.dialog(owner.name)}>
          <header className="hg-header">
            <span className="hg-avatar">{owner.avatar ? <img src={owner.avatar} alt="" /> : owner.name.charAt(0).toUpperCase()}</span>
            <div className="hg-who">
              <p className="hg-name">{owner.name}</p>
              {owner.status && (
                <p className="hg-status">
                  <span className="hg-online" />
                  {owner.status}
                </p>
              )}
            </div>
            {started && (
              <button className="hg-icon" onClick={() => setState(fresh())} aria-label={t.newChat} title={t.newChat}>
                <RefreshIcon />
              </button>
            )}
            <button className="hg-icon" onClick={() => setOpen(false)} aria-label={t.close}>
              <CloseIcon />
            </button>
          </header>

          <div className="hg-list" ref={listRef} aria-live="polite">
            {state.transcript.map((m, i) => (
              <div key={i} className={`hg-row hg-${m.from}`}>
                <div className="hg-msg">
                  {m.from === 'owner' && <p className="hg-author">{owner.name}</p>}
                  <div className="hg-bubble">{m.text}</div>
                  {m.links && (
                    <div className="hg-chips">
                      {m.links.map((l) => (
                        <a key={l.href} href={l.href} className="hg-link">
                          {l.label} ↗
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {state.step === 'identify' && (
              <form className="hg-card" onSubmit={identify} noValidate>
                <p className="hg-card-title">{t.identifyTitle}</p>
                <p className="hg-card-hint">{t.identifyHint(owner.name)}</p>
                <label className="hg-field">
                  <span>{t.nameLabel}</span>
                  <input
                    ref={nameRef}
                    className="hg-input"
                    value={who.name}
                    onChange={(e) => setWho({ ...who, name: e.target.value })}
                    placeholder={t.placeholder.name}
                    autoComplete="name"
                    maxLength={100}
                    required
                  />
                </label>
                <label className="hg-field">
                  <span>{t.emailLabel}</span>
                  <input
                    className="hg-input"
                    type="email"
                    value={who.email}
                    onChange={(e) => {
                      setWho({ ...who, email: e.target.value })
                      setBadEmail(false)
                    }}
                    placeholder={t.placeholder.email}
                    autoComplete="email"
                    maxLength={200}
                    aria-invalid={badEmail}
                    required
                  />
                  {badEmail && <span className="hg-error">{t.badEmail}</span>}
                </label>
                <button className="hg-submit" type="submit" disabled={!who.name.trim() || !who.email.trim()}>
                  {t.continue}
                </button>
              </form>
            )}

            {state.step === 'topic' && (
              <div className="hg-chips">
                {topics.map((o) => (
                  <button key={o.id} className="hg-chip" onClick={() => choose(o)} disabled={busy}>
                    {o.label}
                  </button>
                ))}
              </div>
            )}

            {state.step === 'verify' && (
              <div className="hg-chips">
                <button
                  className="hg-chip"
                  disabled={busy}
                  onClick={() => {
                    say({ from: 'user', text: t.resend })
                    requestLink(state.topic ?? topics[0].label)
                  }}
                >
                  {t.resend}
                </button>
                <button
                  className="hg-chip"
                  disabled={busy}
                  onClick={() =>
                    setState({ ...state, step: 'identify', transcript: [...state.transcript, { from: 'user', text: t.otherEmail }] })
                  }
                >
                  {t.otherEmail}
                </button>
              </div>
            )}

            {busy && (
              <div className="hg-typing" aria-hidden="true">
                {[0, 1, 2].map((d) => (
                  <span key={d} style={{ animationDelay: `${d * 120}ms` } as CSSProperties} />
                ))}
              </div>
            )}
          </div>

          {state.step !== 'identify' && (
          <form className="hg-form" onSubmit={submit} noValidate>
            <input
              ref={inputRef}
              className="hg-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={locked}
              placeholder={placeholder}
              aria-label={placeholder}
              autoComplete="off"
              maxLength={2000}
            />
            <button className="hg-send" type="submit" disabled={!input.trim() || busy || locked} aria-label={t.send}>
              <SendIcon />
            </button>
          </form>
          )}
        </section>
      )}
    </div>
  )

  return (
    <div ref={host} data-holagram="" data-theme={theme}>
      {root &&
        createPortal(
          <>
            <style>{css}</style>
            {ui}
          </>,
          root,
        )}
    </div>
  )
}

// "chat-bot" from IBM Carbon icons (Apache-2.0).
const BotIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
    <path d="M16,19a6.9908,6.9908,0,0,1-5.833-3.1287l1.666-1.1074a5.0007,5.0007,0,0,0,8.334,0l1.666,1.1074A6.9908,6.9908,0,0,1,16,19Z" />
    <path d="M20,8a2,2,0,1,0,2,2A1.9806,1.9806,0,0,0,20,8Z" />
    <path d="M12,8a2,2,0,1,0,2,2A1.9806,1.9806,0,0,0,12,8Z" />
    <path d="M17.7358,30,16,29l4-7h6a1.9966,1.9966,0,0,0,2-2V6a1.9966,1.9966,0,0,0-2-2H6A1.9966,1.9966,0,0,0,4,6V20a1.9966,1.9966,0,0,0,2,2h9v2H6a3.9993,3.9993,0,0,1-4-4V6A3.9988,3.9988,0,0,1,6,2H26a3.9988,3.9988,0,0,1,4,4V20a3.9993,3.9993,0,0,1-4,4H21.1646Z" />
  </svg>
)
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="m21 3-9.5 9.5M21 3l-6.5 18-3-8.5L3 9.5 21 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const CloseIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)
const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
