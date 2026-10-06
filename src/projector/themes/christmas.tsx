// Christmas: a string of twinkling lights swagged across the top, light snow
// drifting down over the board, a cap of snow on the VS medallion, a jingle-bell
// swing for the winner, and snowflakes and presents in the reveal confetti.
// All motion is transform/opacity — the board itself is untouched underneath.

import type { CSSProperties } from 'react'
import type { ScoreboardSkin } from './index'
import './christmas.css'

const FESTIVE = ['#e8323c', '#1fa35c', '#ffd23f', '#ffffff']
const GLYPHS = ['❄️', '🎁']

export const christmas: ScoreboardSkin = {
  Decorations,
  VsAccent: SnowCap,
  winnerStyle: 'jingle',
  confetti: {
    // Winner's own colour leads (so the burst still reads as theirs), then the
    // season. A tie is all season.
    colors: (base, winner) => (winner === 'tie' ? FESTIVE : [base[0], base[0], ...FESTIVE]),
    glyphs: GLYPHS,
  },
}

function Decorations() {
  return (
    <>
      <div className="xm" aria-hidden="true">
        <div className="xm__glow" />
        <svg className="xm__wire" viewBox="0 0 100 10" preserveAspectRatio="none">
          <path d={WIRE_PATH} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        {BULBS.map((b, i) => (
          <span
            key={i}
            className="xm__bulb"
            style={{ left: `${b.x}%`, top: `${b.y}cqh`, ['--c' as string]: b.color, ['--d' as string]: `${b.delay}s` } as CSSProperties}
          >
            <span className="xm__halo" />
            <span className="xm__glass" />
          </span>
        ))}
      </div>
      {/* Snow falls in front of the board (the panels would hide most of it),
          kept small and sparse so it never fights the numbers. */}
      <div className="xm-snow" aria-hidden="true">
        {FLAKES.map((f, i) => (
          <span
            key={i}
            className="xm-snow__fall"
            style={{ left: `${f.x}%`, animationDuration: `${f.secs}s`, animationDelay: `${f.delay}s` }}
          >
            <span
              className="xm-snow__flake"
              style={{ width: f.size, height: f.size, opacity: f.alpha, animationDuration: `${f.sway}s` }}
            />
          </span>
        ))}
      </div>
    </>
  )
}

// The light string hangs in SWAGS shallow scallops across the full width. One
// function gives both the wire path (in the 100×10 viewBox) and where each bulb
// hangs (in % across and cqh down), so the bulbs always sit on the wire.
const SWAGS = 5
const WIRE_TOP = 0.6 // cqh
const WIRE_SAG = 3.4 // cqh
const WIRE_BOX = 6 // cqh — the svg's height; the viewBox's 10 units map onto it
const sagAt = (x: number) => WIRE_TOP + WIRE_SAG * Math.sin(Math.PI * ((x * SWAGS) % 1))

const WIRE_PATH = (() => {
  let d = ''
  for (let i = 0; i <= 200; i++) {
    const x = i / 200
    d += `${i ? 'L' : 'M'}${(x * 100).toFixed(2)} ${((sagAt(x) / WIRE_BOX) * 10).toFixed(2)} `
  }
  return d
})()

const BULB_COLORS = ['#ff3b46', '#2fd27a', '#ffd23f', '#4d8dff']
const BULB_COUNT = 30
const BULBS = Array.from({ length: BULB_COUNT }, (_, i) => {
  const x = (i + 0.5) / BULB_COUNT
  return { x: x * 100, y: sagAt(x), color: BULB_COLORS[i % BULB_COLORS.length], delay: -((i * 0.37) % 2.4) }
})

// Built once per load; random is fine — nobody needs the same snowfall twice.
const FLAKES = Array.from({ length: 26 }, () => ({
  x: Math.random() * 100,
  size: `${(0.35 + Math.random() * 0.55).toFixed(2)}cqw`,
  alpha: +(0.45 + Math.random() * 0.45).toFixed(2),
  secs: 11 + Math.random() * 9,
  delay: -Math.random() * 20,
  sway: 2.5 + Math.random() * 2.5,
}))

// A soft drift of snow settled on the medallion's top rim.
function SnowCap() {
  return (
    <svg className="xm-cap" viewBox="0 0 100 40">
      <path
        d="M4 34 C4 14 24 3 50 3 C76 3 96 14 96 34 C90 30 86 37 79 33 C72 29 68 38 60 34 C52 30 47 39 39 34 C31 29 26 37 19 33 C13 30 9 36 4 34 Z"
        fill="#f4f8ff"
      />
    </svg>
  )
}
