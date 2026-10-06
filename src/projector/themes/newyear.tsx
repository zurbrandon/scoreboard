// New Year's Eve: gold and silver streamers hanging in the top corners,
// fireworks bursting now and then in the open bands above and below the board,
// a glinting disco ball on the VS medallion, a gold midnight-style Final
// countdown, a champagne-pop winner, and sparkles and glasses in the confetti.
// All motion is transform/opacity — the board itself is untouched underneath.

import type { CSSProperties } from 'react'
import type { ScoreboardSkin } from './index'
import './newyear.css'

const GOLD = ['#ffd23f', '#f5e6a8']
const SILVER = ['#d9dee8', '#ffffff']
const GLYPHS = ['✨', '🥂']

export const newyear: ScoreboardSkin = {
  Decorations,
  VsAccent: DiscoBall,
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
      {STREAMERS.map((s, i) => (
        <svg
          key={i}
          className="ny__streamer"
          viewBox="0 0 20 100"
          preserveAspectRatio="none"
          style={{ [s.side]: `${s.inset}cqw`, height: `${s.len}cqh`, color: s.color, animationDuration: `${s.secs}s`, animationDelay: `${s.delay}s` }}
        >
          <path d={STREAMER_PATH} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      ))}
    </div>
  )
}

// A curling ribbon: a sine wave down the svg, stretched to each streamer's length.
const STREAMER_PATH = (() => {
  let d = ''
  for (let i = 0; i <= 60; i++) {
    const y = (i / 60) * 98 + 1
    d += `${i ? 'L' : 'M'}${(10 + 6 * Math.sin((y / 100) * Math.PI * 5)).toFixed(2)} ${y.toFixed(2)} `
  }
  return d
})()

// Clustered in the two top corners, behind the logos; the outermost hang down
// the side gutters past the panels' edges.
const STREAMERS = [
  { side: 'left', inset: 0.4, len: 46, color: '#ffd23f', secs: 4.6, delay: -1 },
  { side: 'left', inset: 2.6, len: 24, color: '#d9dee8', secs: 5.3, delay: -3 },
  { side: 'left', inset: 5, len: 15, color: '#f0b93a', secs: 4.1, delay: -2 },
  { side: 'right', inset: 0.4, len: 42, color: '#d9dee8', secs: 5, delay: -2.5 },
  { side: 'right', inset: 2.6, len: 27, color: '#ffd23f', secs: 4.4, delay: -0.5 },
  { side: 'right', inset: 5, len: 16, color: '#e9edf5', secs: 5.6, delay: -4 },
] as const

// Each burst blooms in the first part of its cycle and is dark for the rest, so
// with staggered lengths they go off now and then rather than strobing. Spots
// are the open bands above and below the panels (they burst behind them).
const SPARK_ANGLES = Array.from({ length: 14 }, (_, i) => (i * 360) / 14)
const BURSTS = [
  { x: 27, y: 7, color: '#ffd23f', secs: 6.5, delay: -1 },
  { x: 73, y: 6, color: '#e9edf5', secs: 8.2, delay: -4.5 },
  { x: 40, y: 93, color: '#ffb84d', secs: 9.4, delay: -2.5 },
  { x: 62, y: 5, color: '#9fd0ff', secs: 11, delay: -8 },
  { x: 85, y: 94, color: '#ffd23f', secs: 10.2, delay: -6 },
]

// A mirror ball perched on the medallion: silver sphere, tiled with latitude
// and longitude lines, with a few glints that twinkle by opacity.
function DiscoBall() {
  return (
    <span className="ny-ball">
      <svg viewBox="0 0 100 100">
        <defs>
          <radialGradient id="ny-ball-face" cx="38%" cy="32%" r="70%">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.45" stopColor="#c9d0dc" />
            <stop offset="1" stopColor="#5c6577" />
          </radialGradient>
          <clipPath id="ny-ball-clip">
            <circle cx="50" cy="50" r="46" />
          </clipPath>
        </defs>
        <circle cx="50" cy="50" r="46" fill="url(#ny-ball-face)" />
        <g clipPath="url(#ny-ball-clip)" fill="none" stroke="rgba(40,48,64,0.55)" strokeWidth="1.4">
          {[-36, -24, -12, 0, 12, 24, 36].map((y) => (
            <ellipse key={`h${y}`} cx="50" cy={50 + y} rx="48" ry={Math.max(1, 9 - Math.abs(y) / 5)} />
          ))}
          {[8, 20, 34, 50, 66, 80, 92].map((x) => (
            <ellipse key={`v${x}`} cx="50" cy="50" rx={Math.abs(50 - x)} ry="46" />
          ))}
        </g>
        <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
      </svg>
      <span className="ny-ball__glint ny-ball__glint--a">✦</span>
      <span className="ny-ball__glint ny-ball__glint--b">✦</span>
      <span className="ny-ball__glint ny-ball__glint--c">✦</span>
    </span>
  )
}
