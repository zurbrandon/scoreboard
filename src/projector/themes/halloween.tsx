// Halloween: cobwebs in the top corners with a spider swinging off one, bats
// that now and then flap across behind the board, a flickering jack-o'-lantern
// perched on the VS medallion, a low purple/orange haze along the floor, a
// shivering winner entrance, and bats and pumpkins in the reveal confetti.
// All motion is transform/opacity — the board itself is untouched underneath.

import type { ScoreboardSkin } from './index'
import './halloween.css'

const ORANGE = ['#ff7a1a', '#ffa64d']
const PURPLE = ['#8a3ffc', '#b78cff']
const GLYPHS = ['🦇', '🎃']

export const halloween: ScoreboardSkin = {
  Decorations,
  VsAccent: () => (
    <>
      <span className="hw-pumpkin-glow" />
      <span className="hw-pumpkin">🎃</span>
    </>
  ),
  winnerStyle: 'spooky',
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
      {BATS.map((b, i) => (
        <span
          key={i}
          className={`hw__bat hw__bat--${b.path}`}
          style={{ top: b.top, animationDuration: `${b.secs}s`, animationDelay: `${b.delay}s` }}
        >
          <span className="hw__bat-wings" style={{ fontSize: b.size, animationDuration: `${b.flap}s` }}>
            🦇
          </span>
        </span>
      ))}
      <div className="hw__spider">
        <span className="hw__thread" />
        <span className="hw__spider-glyph">🕷️</span>
      </div>
    </div>
  )
}

// Each bat crosses in the first part of its cycle and spends the rest off
// screen, so with staggered lengths they pass now and then rather than circling.
// Lanes are the open bands above and below the panels (they fly behind them).
const BATS = [
  { path: 'ltr', top: '4cqh', size: '3.8cqw', secs: 23, delay: -4, flap: 0.22 },
  { path: 'rtl', top: '9cqh', size: '3cqw', secs: 31, delay: -19, flap: 0.18 },
  { path: 'ltr', top: '91cqh', size: '3cqw', secs: 37, delay: -30, flap: 0.2 },
]

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
