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
  // on one, and the scrim is drawn in CSS so only the image reaches the DOM.
  // A slide has ONE background: a picture if it has one, otherwise a flat colour
  // if it has one, otherwise the scene's own gradient. The picture wins so that
  // setting an image never silently depends on what colour was chosen before it.
  const bgCls = live.bg
    ? `scene-text--bg scene-text--bg-${live.bgDim ?? 'dim'}`
    : live.bgColor
      ? 'scene-text--flat'
      : ''
  const bgStyle: CSSProperties | undefined = live.bg
    ? ({ ['--bg-image' as string]: `url("${live.bg}")` } as CSSProperties)
    : live.bgColor
      ? ({ ['--bg-flat' as string]: live.bgColor } as CSSProperties)
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

  return (
    <div className={`scene-text ${bgCls} ${themeCls} ${revealCls}`} style={bgStyle}>
      {live.headline && (
        <div className={`scene-text__headline ${headlineSize(live.headline)}`}>{live.headline}</div>
      )}
      {live.body && <div className="scene-text__body">{live.body}</div>}
    </div>
  )
}

/**
 * How big the headline gets, from how much of it there is.
 *
 * This is what the old 'centered' template was really for: one word wants to be
 * enormous, a sentence wants to be readable, and picking between two layouts was
 * a clumsy way to say so. Stepped rather than fitted — a size per length band,
 * so a headline doesn't resize while you type into it live, and two slides of
 * roughly the same length look the same.
 */
function headlineSize(text: string): string {
  const n = text.trim().length
  if (n <= 14) return 'scene-text__headline--xl' // HALFTIME, a game's name
  if (n <= 32) return 'scene-text__headline--lg'
  return '' // the base size: a full sentence
}
