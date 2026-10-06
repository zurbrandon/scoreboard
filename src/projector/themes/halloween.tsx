// Halloween: cobwebs in the top corners, a spider hanging off one of them, a
// jack-o'-lantern perched on the VS medallion, a low purple/orange haze along
// the floor, and bats and pumpkins in the reveal confetti. Everything here is
// static — the board itself is untouched underneath.

import type { ScoreboardSkin } from './index'
import './halloween.css'

const ORANGE = ['#ff7a1a', '#ffa64d']
const PURPLE = ['#8a3ffc', '#b78cff']
const GLYPHS = ['🦇', '🎃']

export const halloween: ScoreboardSkin = {
  Decorations,
  VsAccent: () => <span className="hw-pumpkin">🎃</span>,
  confetti: {
    // Winner's own colour leads (so the burst still reads as theirs), then the
    // season. A tie is all season.
    colors: (base, winner) =>
      winner === 'tie' ? [...ORANGE, ...PURPLE, '#ffd23f'] : [base[0], base[0], ...ORANGE, ...PURPLE],
    glyphs: GLYPHS,
  },
}

function Decorations() {
  return (
    <div className="hw" aria-hidden="true">
      <div className="hw__haze" />
      <Cobweb className="hw__web hw__web--left" />
      <Cobweb className="hw__web hw__web--right" />
      <div className="hw__spider">
        <span className="hw__thread" />
        <span className="hw__spider-glyph">🕷️</span>
      </div>
    </div>
  )
}

// A corner web anchored at (0,0): spokes fanning across the quarter-circle and
// rings that sag toward the corner between each pair of spokes. Built once.
const WEB_PATH = (() => {
  const spokes = [0, 14, 29, 45, 61, 76, 90].map((d) => (d * Math.PI) / 180)
  const rings = [16, 31, 48, 67, 88]
  const pt = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`
  let d = spokes.map((a) => `M0 0 L${pt(140, a)}`).join(' ')
  for (const r of rings) {
    d += ` M${pt(r, spokes[0])}`
    for (let i = 1; i < spokes.length; i++) {
      const mid = (spokes[i - 1] + spokes[i]) / 2
      d += ` Q${pt(r * 0.84, mid)} ${pt(r, spokes[i])}`
    }
  }
  return d
})()

function Cobweb({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="xMinYMin meet">
      <path d={WEB_PATH} fill="none" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" />
    </svg>
  )
}
