// Full-screen text scene. Renders the committed (live) card in one of three
// layouts: a headline+body clue, one big centred statement, or a 2x2 grid of
// words. Any of them can carry a background image. Either can be driven live
// (the operator's live-type toggle just re-commits on every keystroke — the
// projector doesn't need to know or care).

import type { CSSProperties } from 'react'
import type { TextSlide } from '../../core/state'

export function TextScene({ slide, animate = false }: { slide: TextSlide; animate?: boolean }) {
  const live = slide
  const revealCls = animate ? 'scene-text--reveal' : ''
  const themeCls = live.theme ? `scene-text--${live.theme}` : ''
  // A background is a layout concern, not a template: any of the three can sit
  // on one. The scrim that keeps text readable is drawn in CSS, so the image
  // itself is all that has to reach the DOM.
  const bgCls = live.bg ? 'scene-text--bg' : ''
  const bgStyle: CSSProperties | undefined = live.bg
    ? ({ ['--bg-image' as string]: `url("${live.bg}")` } as CSSProperties)
    : undefined

  if (live.template === 'quadrants') {
    return (
      <div className={`scene-text scene-text--quads ${bgCls} ${themeCls} ${revealCls}`} style={bgStyle}>
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

  if (live.template === 'centered') {
    // One statement, as big as it can be. The body is a subordinate line under
    // it rather than a paragraph — a game name and its one-line rule.
    return (
      <div className={`scene-text scene-text--centered ${bgCls} ${themeCls} ${revealCls}`} style={bgStyle}>
        {live.headline && <div className="scene-text__statement">{live.headline}</div>}
        {live.body && <div className="scene-text__under">{live.body}</div>}
      </div>
    )
  }

  // basic
  return (
    <div className={`scene-text ${bgCls} ${themeCls} ${revealCls}`} style={bgStyle}>
      {live.headline && <div className="scene-text__headline">{live.headline}</div>}
      {live.body && <div className="scene-text__body">{live.body}</div>}
    </div>
  )
}
