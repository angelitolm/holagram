// Widget CSS, scoped by the shadow root. Dark by default, light with the OS (theme="auto") or theme="light".
// Override the brand from your own CSS: [data-holagram] { --hg-from: #a855f7; --hg-to: #3b82f6 }
const light = /* css */ `
  --hg-bg: rgba(255, 255, 255, .96);
  --hg-border: rgba(15, 15, 20, .1);
  --hg-text: #18181b;
  --hg-dim: #6b6b76;
  --hg-raised: rgba(15, 15, 20, .05);
  --hg-hover: rgba(15, 15, 20, .08);
  --hg-bot: rgba(15, 15, 20, .06);
  --hg-send-bg: #18181b;
  --hg-send-text: #fff;
  --hg-ring-bg: #fff;
  --hg-shadow: 0 24px 48px -12px rgba(0, 0, 0, .25);
`

export const css = /* css */ `
:host {
  all: initial;
  --hg-from: #2aabee;
  --hg-to: #7c5cff;
  --hg-accent: var(--hg-from);
  --hg-bg: rgba(13, 13, 20, .96);
  --hg-border: rgba(255, 255, 255, .1);
  --hg-text: #f4f4f5;
  --hg-dim: #9d9da3;
  --hg-raised: rgba(255, 255, 255, .04);
  --hg-hover: rgba(255, 255, 255, .08);
  --hg-bot: rgba(255, 255, 255, .07);
  --hg-send-bg: #fff;
  --hg-send-text: #000;
  --hg-ring-bg: #1f1f27;
  --hg-shadow: 0 24px 48px -12px rgba(0, 0, 0, .6);
  --hg-font: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: light) { :host([data-theme="auto"]) { ${light} } }
:host([data-theme="light"]) { ${light} }

* { box-sizing: border-box; margin: 0; }
button { font: inherit; cursor: pointer; }
button:disabled { cursor: default; }

.hg {
  font-family: var(--hg-font);
  font-size: 14px;
  line-height: 1.5;
  color: var(--hg-text);
  /* Sits above a bottom bar that sets this (next-toolbar does). */
  --hg-bottom: var(--next-kit-inset-bottom, 0px);
}

/* The dock holds the launcher and its optional ×, which can't live inside the launcher button. */
.hg-dock {
  position: fixed; right: 24px; bottom: calc(24px + var(--hg-bottom)); z-index: 2147483000;
  animation: hg-pop .25s ease-out;
}
.hg-left .hg-dock { right: auto; left: 24px; }
.hg-launcher {
  position: relative; display: grid;
  width: 56px; height: 56px; border: 0; border-radius: 50%;
  place-items: center; color: #fff;
  background: linear-gradient(135deg, var(--hg-from), var(--hg-to));
  box-shadow: 0 10px 30px -8px var(--hg-to);
  transition: transform .15s;
}
.hg-launcher:hover { transform: scale(1.06); }
/* launcherIcon: your content in a circle with a brand-gradient ring. Both launchers get the green "online" badge. */
.hg-custom { width: auto; height: auto; background: none; box-shadow: none; cursor: pointer; }
.hg-custom:hover { transform: none; }
.hg-ring {
  /* flex, not grid: an auto grid track would grow to the content and push it off-center */
  display: flex; align-items: center; justify-content: center; overflow: hidden;
  width: var(--hg-launcher-size, 60px); height: var(--hg-launcher-size, 60px); border-radius: 50%;
  border: 3px solid transparent;
  background: linear-gradient(var(--hg-ring-bg), var(--hg-ring-bg)) padding-box,
    linear-gradient(135deg, var(--hg-from), var(--hg-to)) border-box;
  box-shadow: 0 10px 30px -8px var(--hg-to);
  transition: transform .15s;
}
.hg-custom:hover .hg-ring { transform: scale(1.06); }
.hg-badge {
  position: absolute; right: -1px; bottom: -1px; width: 16px; height: 16px; border-radius: 50%;
  background: #22c55e; border: 3px solid #fff;
}
.hg-badge::after {
  content: ""; position: absolute; inset: -3px; border-radius: 50%;
  border: 2px solid #22c55e; animation: hg-ping 2s ease-out infinite;
}
@keyframes hg-ping { 0% { transform: scale(1); opacity: .7; } 80%, 100% { transform: scale(1.7); opacity: 0; } }
.hg-dismiss {
  position: absolute; top: -6px; right: -6px; width: 22px; height: 22px; border-radius: 50%;
  display: grid; place-items: center; padding: 0; border: 1px solid rgba(15, 15, 20, .1);
  background: #fff; color: #3f3f46; box-shadow: 0 2px 8px rgba(0, 0, 0, .2);
  transition: opacity .15s, transform .15s;
}
.hg-dismiss:hover { transform: scale(1.1); }
/* With a mouse, the × appears on hover; on touch it is always there. */
@media (hover: hover) {
  .hg-dismiss { opacity: 0; }
  .hg-dock:hover .hg-dismiss, .hg-dismiss:focus-visible { opacity: 1; }
}
/* Top-left: the top-right corner belongs to the × */
.hg-dot {
  position: absolute; top: 3px; left: 3px; width: 12px; height: 12px; border-radius: 50%;
  background: #ef4444; border: 2px solid #fff;
}

.hg-panel {
  position: fixed; left: 12px; right: 12px; bottom: calc(12px + var(--hg-bottom)); z-index: 2147483001;
  height: min(600px, calc(100dvh - 24px - var(--hg-bottom)));
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--hg-bg); border: 1px solid var(--hg-border); border-radius: 24px;
  box-shadow: var(--hg-shadow); backdrop-filter: blur(20px);
  transform-origin: bottom right;
  animation: hg-in .3s cubic-bezier(.22, 1, .36, 1);
}
@media (min-width: 640px) {
  .hg-panel { left: auto; right: 24px; width: 390px; }
  .hg-left .hg-panel { right: auto; left: 24px; transform-origin: bottom left; }
}

.hg-header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--hg-border); }
.hg-avatar {
  width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; overflow: hidden;
  display: grid; place-items: center; font-weight: 700; color: #fff;
  background: linear-gradient(135deg, var(--hg-from), var(--hg-to));
}
.hg-avatar img { width: 100%; height: 100%; object-fit: cover; }
.hg-who { min-width: 0; flex: 1; }
.hg-name { font-weight: 600; }
.hg-status { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--hg-dim); }
.hg-online { width: 6px; height: 6px; border-radius: 50%; background: #34d399; }
.hg-icon {
  display: grid; place-items: center; padding: 6px; border: 0; border-radius: 50%;
  background: none; color: var(--hg-dim); transition: background .15s, color .15s;
}
.hg-icon:hover { background: var(--hg-hover); color: var(--hg-text); }

.hg-list {
  flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 20px 16px;
  display: flex; flex-direction: column; gap: 12px;
  scrollbar-width: thin; scrollbar-color: var(--hg-hover) transparent;
}
.hg-row { display: flex; animation: hg-up .25s ease-out; }
.hg-user { justify-content: flex-end; }
.hg-msg { max-width: 85%; }
.hg-author { margin: 0 0 4px 4px; font-size: 11px; font-weight: 600; color: var(--hg-accent); }
.hg-bubble { padding: 10px 16px; border-radius: 16px; white-space: pre-wrap; overflow-wrap: anywhere; }
.hg-bot .hg-bubble { background: var(--hg-bot); border-bottom-left-radius: 6px; }
.hg-user .hg-bubble { background: linear-gradient(135deg, var(--hg-from), var(--hg-to)); color: #fff; border-bottom-right-radius: 6px; }
.hg-owner .hg-bubble {
  border: 1px solid color-mix(in srgb, var(--hg-accent) 35%, transparent);
  background: color-mix(in srgb, var(--hg-accent) 12%, transparent);
  border-bottom-left-radius: 6px;
}

.hg-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.hg-chip, .hg-link {
  padding: 8px 14px; border: 1px solid var(--hg-border); border-radius: 999px;
  background: var(--hg-raised); color: var(--hg-text); text-align: left; text-decoration: none;
  transition: border-color .15s, background .15s;
}
.hg-link { padding: 4px 12px; font-size: 12px; color: var(--hg-dim); }
.hg-chip:hover:not(:disabled), .hg-link:hover {
  border-color: color-mix(in srgb, var(--hg-accent) 60%, transparent);
  background: color-mix(in srgb, var(--hg-accent) 10%, transparent);
}
.hg-chip:disabled { opacity: .5; }

.hg-card {
  display: flex; flex-direction: column; gap: 12px; padding: 16px;
  border: 1px solid var(--hg-border); border-radius: 18px; background: var(--hg-raised);
  animation: hg-up .25s ease-out;
}
.hg-card-title { font-size: 16px; font-weight: 700; }
.hg-card-hint { margin-top: -8px; font-size: 13px; color: var(--hg-dim); }
.hg-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 600; color: var(--hg-dim); }
.hg-field .hg-input { font-size: 14px; font-weight: 400; }
.hg-input[aria-invalid="true"] { border-color: #f87171; }
.hg-error { font-weight: 400; color: #f87171; }
.hg-submit {
  padding: 12px 16px; border: 0; border-radius: 14px; font-weight: 600; color: #fff;
  background: linear-gradient(135deg, var(--hg-from), var(--hg-to)); transition: opacity .15s;
}
.hg-submit:disabled { opacity: .4; }

.hg-typing { display: flex; gap: 4px; padding: 8px 4px; }
.hg-typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--hg-dim); animation: hg-bounce 1s infinite; }

.hg-form { display: flex; align-items: center; gap: 8px; padding: 12px; border-top: 1px solid var(--hg-border); }
.hg-input {
  min-width: 0; flex: 1; padding: 12px 16px; border: 1px solid var(--hg-border); border-radius: 16px;
  background: var(--hg-raised); color: var(--hg-text); font: inherit; outline: none;
}
.hg-input::placeholder { color: var(--hg-dim); }
.hg-input:focus { border-color: color-mix(in srgb, var(--hg-accent) 50%, transparent); }
.hg-input:disabled { opacity: .5; }
.hg-send {
  width: 44px; height: 44px; flex-shrink: 0; display: grid; place-items: center; border: 0; border-radius: 16px;
  background: var(--hg-send-bg); color: var(--hg-send-text); transition: opacity .15s;
}
.hg-send:disabled { opacity: .3; }
:focus-visible { outline: 2px solid var(--hg-accent); outline-offset: 2px; }

@keyframes hg-in { from { opacity: 0; transform: translateY(24px) scale(.96); } }
@keyframes hg-up { from { opacity: 0; transform: translateY(8px); } }
@keyframes hg-pop { from { opacity: 0; transform: scale(0); } }
@keyframes hg-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
`
