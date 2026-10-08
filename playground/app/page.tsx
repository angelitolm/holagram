import { OpenButton } from './open-button'

export default function Page() {
  return (
    <main>
      <h1>Holagram playground</h1>
      <p>Copy <code>.env.example</code> to <code>.env.local</code>, fill it in and open the chat.</p>
      <OpenButton />
    </main>
  )
}
