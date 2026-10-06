// Valentine's Day: a garland of hearts swagged across the top that pulse out of
// step, a few hearts drifting up over the board, a cupid's heart beating on the
// VS medallion (the love match), a heartbeat winner with a pink glow, and hearts
// in the confetti. All motion is transform/opacity.

import type { CSSProperties } from 'react'
import type { ScoreboardSkin } from './index'
import { swag } from './swag'
import './valentines.css'

const PINKS = ['#ff4d8d', '#ff9cc2', '#e8323c', '#ffffff']
const GLYPHS = ['💖', '💘']

export const valentines: ScoreboardSkin = {
  Decorations,
  VsAccent: () => <span className="vd-cupid">💘</span>,
  winnerStyle: 'heartbeat',
  confetti: {
    colors: (base, winner) => (winner === 'tie' ? PINKS : [base[0], base[0], ...PINKS]),
    glyphs: GLYPHS,
  },
}

function Decorations() {
  return (
    <>
      <div className="vd" aria-hidden="true">
        <div className="vd__glow" />
        <svg className="vd__string" viewBox="0 0 100 10" preserveAspectRatio="none">
          <path d={GARLAND.path} fill="none" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        </svg>
        {GARLAND.points.map((p, i) => (
          <span
            key={i}
            className="vd__charm"
            style={{ left: `${p.x}%`, top: `${p.y}cqh`, color: CHARM_COLORS[i % CHARM_COLORS.length], ['--d' as string]: `${-((i * 0.29) % 1.8)}s` } as CSSProperties}
          >
            <Heart />
          </span>
        ))}
      </div>
      {/* Drifts up in front of the board, sparse and faint, so the numbers win. */}
      <div className="vd-float" aria-hidden="true">
        {FLOATERS.map((f, i) => (
          <span
            key={i}
            className="vd-float__rise"
            style={{ left: `${f.x}%`, animationDuration: `${f.secs}s`, animationDelay: `${f.delay}s` }}
          >
            <span
              className="vd-float__heart"
              style={{ width: f.size, height: f.size, opacity: f.alpha, color: f.color, animationDuration: `${f.sway}s` }}
            >
              <Heart />
            </span>
          </span>
        ))}
      </div>
    </>
  )
}

function Heart() {
  return (
    <svg viewBox="0 0 100 94">
      <path
        d="M50 88 C20 66 4 48 4 30 C4 16 15 6 28 6 C38 6 46 12 50 20 C54 12 62 6 72 6 C85 6 96 16 96 30 C96 48 80 66 50 88 Z"
        fill="currentColor"
      />
    </svg>
  )
}

// Same swag as the Christmas lights; the svg is 6cqh tall (see .vd__string).
const GARLAND = swag({ swags: 5, top: 0.6, sag: 3.4, box: 6, count: 26 })
const CHARM_COLORS = ['#ff4d8d', '#ff9cc2', '#e8323c']

// Built once per load; random is fine.
const FLOATERS = Array.from({ length: 12 }, (_, i) => ({
  x: 4 + Math.random() * 92,
  size: `${(1 + Math.random() * 0.9).toFixed(2)}cqw`,
  alpha: +(0.35 + Math.random() * 0.25).toFixed(2),
  color: CHARM_COLORS[i % CHARM_COLORS.length],
  secs: 14 + Math.random() * 10,
  delay: -Math.random() * 24,
  sway: 2.8 + Math.random() * 2,
}))
