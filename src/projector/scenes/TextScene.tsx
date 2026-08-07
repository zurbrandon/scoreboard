// Full-screen text scene. Renders the committed (live) card in one of two
// layouts: a headline+body clue, or a 2x2 grid of words. Either can be driven
// live (the operator's live-type toggle just re-commits on every keystroke —
// the projector doesn't need to know or care).

import { useAppState } from '../../store/react'

export function TextScene() {
  const live = useAppState((s) => s.text.live)

  if (live.template === 'quadrants') {
    return (
      <div className="scene-text scene-text--quads">
        <div className="quad-grid">
          {live.quads.map((word, i) => (
            <div className="quad-cell" key={i}>
              {word}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // basic
  return (
    <div className="scene-text">
      {live.headline && <div className="scene-text__headline">{live.headline}</div>}
      {live.body && <div className="scene-text__body">{live.body}</div>}
    </div>
  )
}
