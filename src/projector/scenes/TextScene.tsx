// Full-screen text scene. Renders the committed (live) card in one of three
// templates: a headline+body clue, a 2x2 grid of words, or a single block of
// text that mirrors the operator's live typing.

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

  if (live.template === 'live') {
    return (
      <div className="scene-text">
        {live.liveText && <div className="scene-text__live">{live.liveText}</div>}
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
