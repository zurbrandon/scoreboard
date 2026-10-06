// Pride: rainbow bands along the top and bottom edges with a sheen that sweeps
// across now and then, rainbow sparkles twinkling in the open bands, a waving
// pride flag on the VS medallion, a hop-hop winner, and rainbow confetti. All
// motion is transform/opacity — the board itself is untouched underneath.

import type { CSSProperties } from 'react'
import type { ScoreboardSkin } from './index'
import './pride.css'

const RAINBOW = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787']
const GLYPHS = ['🌈', '✨']

export const pride: ScoreboardSkin = {
  Decorations,
  VsAccent: () => <span className="pr-flag">🏳️‍🌈</span>,
  winnerStyle: 'strut',
  confetti: {
    colors: (base, winner) => (winner === 'tie' ? RAINBOW : [base[0], ...RAINBOW]),
    glyphs: GLYPHS,
  },
}

function Decorations() {
  return (
    <div className="pr" aria-hidden="true">
      <div className="pr__glow" />
      <div className="pr__arc" />
      <div className="pr__band pr__band--top">
        <span className="pr__sheen" />
      </div>
      <div className="pr__band pr__band--bottom">
        <span className="pr__sheen pr__sheen--late" />
      </div>
      {SPARKLES.map((s, i) => (
        <span
          key={i}
          className="pr__sparkle"
          style={{ left: `${s.x}%`, top: `${s.y}cqh`, fontSize: s.size, color: RAINBOW[i % RAINBOW.length], ['--d' as string]: `${s.delay}s`, ['--t' as string]: `${s.secs}s` } as CSSProperties}
        >
          ✦
        </span>
      ))}
    </div>
  )
}

// Scattered through the open bands above and below the panels.
const SPARKLES = [
  { x: 22, y: 4, size: '2.6cqw', secs: 3.2, delay: -0.4 },
  { x: 31, y: 10, size: '1.8cqw', secs: 2.7, delay: -1.9 },
  { x: 38, y: 5, size: '2.2cqw', secs: 3.6, delay: -2.6 },
  { x: 62, y: 9, size: '1.9cqw', secs: 2.9, delay: -1.1 },
  { x: 69, y: 4, size: '2.7cqw', secs: 3.4, delay: -3 },
  { x: 78, y: 11, size: '1.6cqw', secs: 2.5, delay: -0.8 },
  { x: 33, y: 94, size: '1.9cqw', secs: 3.1, delay: -2.2 },
  { x: 47, y: 96, size: '2.4cqw', secs: 3.7, delay: -0.2 },
  { x: 58, y: 93, size: '1.8cqw', secs: 2.8, delay: -1.5 },
  { x: 70, y: 95, size: '2.1cqw', secs: 3.3, delay: -2.9 },
  { x: 54, y: 3, size: '1.6cqw', secs: 2.6, delay: -0.9 },
  { x: 14, y: 12, size: '1.9cqw', secs: 3.5, delay: -1.3 },
]
