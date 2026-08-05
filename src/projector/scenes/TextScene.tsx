// Full-screen text scene: shows the committed (live) card's headline and body.
// Used for clues in guessing games — e.g. headline "Skiing", body "but with
// pizza sauce". Publishing a different card swaps what's shown.

import { useAppState } from '../../store/react'

export function TextScene() {
  const headline = useAppState((s) => s.text.live.headline)
  const body = useAppState((s) => s.text.live.body)

  return (
    <div className="scene-text">
      {headline && <div className="scene-text__headline">{headline}</div>}
      {body && <div className="scene-text__body">{body}</div>}
    </div>
  )
}
