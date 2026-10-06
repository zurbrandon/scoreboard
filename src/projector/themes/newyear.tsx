// New Year's Eve: the VS medallion becomes a turning mirror ball, spots of light
// it throws drift across the space around the board, fireworks burst now and
// then above and below it, the coming year sits in gold between the ribbons,
// the Final countdown goes gold like the midnight one, a champagne-pop winner,
// and sparkles and glasses in the confetti. All motion is transform/opacity.

import type { CSSProperties } from 'react'
import type { ScoreboardSkin } from './index'
import './newyear.css'

const GOLD = ['#ffd23f', '#f5e6a8']
const SILVER = ['#d9dee8', '#ffffff']
const GLYPHS = ['✨', '🥂']

export const newyear: ScoreboardSkin = {
  Decorations,
  VsAccent: MirrorBall,
  FooterCenter: () => <span className="ny-year">✦ {comingYear()} ✦</span>,
  winnerStyle: 'fizz',
  confetti: {
    colors: (base, winner) => (winner === 'tie' ? [...GOLD, ...SILVER] : [base[0], base[0], ...GOLD, ...SILVER]),
    glyphs: GLYPHS,
  },
}

function Decorations() {
  return (
    <div className="ny" aria-hidden="true">
      <div className="ny__glow" />
      {SPOTS.map((s, i) => (
        <span
          key={i}
          className="ny__spot"
          style={{ top: `${s.y}cqh`, width: s.size, height: s.size, opacity: s.alpha, animationDuration: `${s.secs}s`, animationDelay: `${s.delay}s` }}
        />
      ))}
      {BURSTS.map((b, i) => (
        <span
          key={i}
          className="ny__burst"
          style={{ left: `${b.x}%`, top: `${b.y}cqh`, ['--c' as string]: b.color, ['--t' as string]: `${b.secs}s`, ['--d' as string]: `${b.delay}s` } as CSSProperties}
        >
          {SPARK_ANGLES.map((a) => (
            <span key={a} className="ny__ray" style={{ transform: `rotate(${a}deg)` }}>
              <span className="ny__spark" />
            </span>
          ))}
        </span>
      ))}
    </div>
  )
}

// The year being rung in: from October on that's next year; in January it's
// the one that just started.
function comingYear() {
  const now = new Date()
  return now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear()
}

// Light thrown off the mirror ball, sweeping across the open bands above and
// below the panels (and behind them). Built once per load; random is fine.
const SPOTS = Array.from({ length: 16 }, (_, i) => ({
  y: i % 2 ? 2 + Math.random() * 11 : 88 + Math.random() * 9,
  size: `${(0.5 + Math.random() * 0.7).toFixed(2)}cqw`,
  alpha: +(0.35 + Math.random() * 0.45).toFixed(2),
  secs: 16 + Math.random() * 12,
  delay: -Math.random() * 28,
}))

// Each burst blooms in the first part of its cycle and is dark for the rest, so
// with staggered lengths they go off now and then rather than strobing.
const SPARK_ANGLES = Array.from({ length: 14 }, (_, i) => (i * 360) / 14)
const BURSTS = [
  { x: 27, y: 7, color: '#ffd23f', secs: 6.5, delay: -1 },
  { x: 73, y: 6, color: '#e9edf5', secs: 8.2, delay: -4.5 },
  { x: 30, y: 93, color: '#ffb84d', secs: 9.4, delay: -2.5 },
  { x: 62, y: 5, color: '#9fd0ff', secs: 11, delay: -8 },
  { x: 72, y: 94, color: '#ffd23f', secs: 10.2, delay: -6 },
]

// The mirror ball fills the medallion, under its VS lettering. The tiles are a
// strip that slides behind a round window (transform-only) with fixed shading
// over it, which reads as a ball turning; glints twinkle by opacity.
function MirrorBall() {
  return (
    <span className="ny-ball">
      <span className="ny-ball__tiles" />
      <span className="ny-ball__shade" />
      <span className="ny-ball__glint ny-ball__glint--a">✦</span>
      <span className="ny-ball__glint ny-ball__glint--b">✦</span>
      <span className="ny-ball__glint ny-ball__glint--c">✦</span>
    </span>
  )
}
