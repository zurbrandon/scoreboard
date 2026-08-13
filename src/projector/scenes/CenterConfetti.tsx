// A one-shot confetti burst from the middle of the screen, radiating out on all
// sides under gravity. Rendered BEHIND the logo on the brand card, so it appears
// to pop out from behind it. Self-contained canvas; only fires on a reveal, and
// only after `delayMs` (so it lands as the logo arrives).

import { useEffect, useRef } from 'react'

interface Bit {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  color: string
  rot: number
  vr: number
  wobble: number
  wobbleSpeed: number
  life: number
  decay: number
}

const COLORS = ['#2f6bff', '#e23b3b', '#ffd23f', '#39d98a', '#b06bff', '#ffffff']
const GRAVITY = 0.0011 // px per ms^2
const DRAG = 0.9996
const MAX_RENDER_WIDTH = 1920 // cap backing resolution; canvas is CSS-stretched

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(arr: T[]): T => arr[(Math.random() * arr.length) | 0]

export function CenterConfetti({ animate, delayMs = 1800 }: { animate: boolean; delayMs?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!animate) return
    if (typeof document !== 'undefined' && document.hidden) return // rAF is paused anyway
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const timer = setTimeout(() => {
      const scale = Math.min(1, MAX_RENDER_WIDTH / canvas.clientWidth)
      const w = (canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale)))
      const h = (canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale)))
      const cx = w / 2
      const cy = h * 0.46 // roughly the logo's center

      // A big, dense burst: many bits, all directions, varied speed.
      const bits: Bit[] = Array.from({ length: 260 }, () => {
        const angle = Math.random() * Math.PI * 2
        const speed = rand(1.0, 3.6)
        const size = rand(12, 30)
        return {
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          w: size,
          h: size * rand(0.4, 0.9),
          color: pick(COLORS),
          rot: rand(0, Math.PI * 2),
          vr: rand(-0.014, 0.014),
          wobble: rand(0, Math.PI * 2),
          wobbleSpeed: rand(0.002, 0.006),
          life: 1,
          decay: 1 / rand(2800, 4800),
        }
      })

      let last = performance.now()
      const tick = (now: number) => {
        const dt = Math.min(now - last, 48)
        last = now
        ctx.clearRect(0, 0, w, h)

        let alive = false
        for (const p of bits) {
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
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6))
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rot)
          ctx.scale(1, Math.abs(Math.cos(p.wobble)) * 0.7 + 0.3) // flutter
          ctx.fillStyle = p.color
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
          ctx.restore()
        }

        if (alive) rafRef.current = requestAnimationFrame(tick)
        else ctx.clearRect(0, 0, w, h)
      }
      rafRef.current = requestAnimationFrame(tick)
    }, delayMs)

    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(rafRef.current)
    }
  }, [animate, delayMs])

  return <canvas ref={canvasRef} className="show__confetti" aria-hidden="true" />
}
