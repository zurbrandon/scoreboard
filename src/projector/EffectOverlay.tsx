// A fire-and-forget overlay that plays on TOP of whatever scene is showing.
// Fires when `nonce` changes (never on first mount). Two cannons at the bottom
// corners shoot particles up and inward under gravity, then fade — a confetti
// cannon, or an emoji burst for the emoji effects. Self-contained canvas, no deps.

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  ratio: number // height:width for confetti flutter
  color: string
  rot: number
  vr: number
  wobble: number
  wobbleSpeed: number
  life: number
  decay: number
}

const CONFETTI_COLORS = ['#2f6bff', '#e23b3b', '#ffd23f', '#39d98a', '#b06bff', '#ffffff']
// Emoji effects reuse the same physics but draw a glyph instead of a ribbon.
const EFFECT_EMOJI: Record<string, string> = { hearts: '❤️', stars: '⭐', fire: '🔥' }

const GRAVITY = 0.0012 // px per ms^2
const DRAG = 0.9996
const PER_CANNON = 70

export function EffectOverlay({ kind, nonce }: { kind: string; nonce: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const seenNonce = useRef(nonce) // don't fire on the initial mount

  useEffect(() => {
    if (nonce === seenNonce.current) return
    seenNonce.current = nonce
    if (!kind) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // rAF is paused when the projector isn't visible — nothing to show anyway.
    if (typeof document !== 'undefined' && document.hidden) return

    const w = (canvas.width = canvas.clientWidth)
    const h = (canvas.height = canvas.clientHeight)
    const glyph = EFFECT_EMOJI[kind]

    // One cannon at a bottom corner, angled up and toward the middle.
    const cannon = (originX: number, aimSign: number, particles: Particle[]) => {
      for (let i = 0; i < PER_CANNON; i++) {
        const angle = -Math.PI / 2 + aimSign * (0.1 + Math.random() * 0.5)
        const speed = 1.1 + Math.random() * 0.9
        const size = glyph ? 26 + Math.random() * 22 : 9 + Math.random() * 9
        particles.push({
          x: originX * w + (Math.random() - 0.5) * w * 0.04,
          y: h + 12,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size,
          ratio: 0.4 + Math.random() * 0.5,
          color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.02,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.002 + Math.random() * 0.004,
          life: 1,
          decay: 1 / (2400 + Math.random() * 1400),
        })
      }
    }

    const particles: Particle[] = []
    cannon(0.06, +1, particles) // bottom-left, up-and-right
    cannon(0.94, -1, particles) // bottom-right, up-and-left

    if (glyph) {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
    }

    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(now - last, 48)
      last = now
      ctx.clearRect(0, 0, w, h)

      let alive = false
      for (const p of particles) {
        p.life -= p.decay * dt
        if (p.life <= 0) continue
        alive = true
        p.vy += GRAVITY * dt
        p.vx *= DRAG
        p.wobble += p.wobbleSpeed * dt
        p.x += (p.vx + Math.sin(p.wobble) * 0.05) * dt
        p.y += p.vy * dt
        p.rot += p.vr * dt

        ctx.save()
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5))
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        if (glyph) {
          ctx.font = `${p.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
          ctx.fillText(glyph, 0, 0)
        } else {
          ctx.scale(1, Math.abs(Math.cos(p.wobble)) * 0.7 + 0.3) // ribbon flutter
          ctx.fillStyle = p.color
          ctx.fillRect(-p.size / 2, (-p.size * p.ratio) / 2, p.size, p.size * p.ratio)
        }
        ctx.restore()
      }

      if (alive) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        ctx.clearRect(0, 0, w, h)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [kind, nonce])

  return <canvas ref={canvasRef} className="fx-overlay" aria-hidden="true" />
}
