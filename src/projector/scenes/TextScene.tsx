// Full-screen text scene. Renders the committed (live) card in one of two
// layouts: a headline+body clue, or a 2x2 grid of words. Either can be driven
// live (the operator's live-type toggle just re-commits on every keystroke —
// the projector doesn't need to know or care).

import type { TextSlide } from '../../core/state'

export function TextScene({ slide, animate = false }: { slide: TextSlide; animate?: boolean }) {
  const live = slide
  const revealCls = animate ? 'scene-text--reveal' : ''
  const themeCls = live.theme ? `scene-text--${live.theme}` : ''

  if (live.template === 'quadrants') {
    return (
      <div className={`scene-text scene-text--quads ${themeCls} ${revealCls}`}>
        <div className="quad-grid">
          {live.quads.map((word, i) => (
            <div className="quad-cell" key={i} style={{ ['--i' as string]: i }}>
              {word}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // basic
  return (
    <div className={`scene-text ${themeCls} ${revealCls}`}>
      {live.headline && <div className="scene-text__headline">{live.headline}</div>}
      {live.body && <div className="scene-text__body">{live.body}</div>}
    </div>
  )
}
