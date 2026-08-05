// A self-contained canvas confetti burst — no external dependency (offline-first,
// easy to delete). Fires when `nonce` changes; the first mount does not fire.
// Tuned to feel celebratory: a big burst of fluttering streamers from the
// winner's side (`originX`, 0..1 across the width) plus a lighter full-width
// rain, in the given colors, falling under gravity before fading out.

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  color: string
  rotation: number
  vr: number
  wobble: number // phase for horizontal flutter
  wobbleSpeed: number
  life: number // 1 → 0
  decay: number
}

const GRAVITY = 0.0011 // px per ms^2
const DRAG = 0.9997
const BURST_COUNT = 180
const RAIN_COUNT = 70

export function Confetti({
  nonce,
  colors,
  originX,
}: {
  nonce: number
  colors: string[]
  originX: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const seenNonce = useRef(nonce) // don't fire on initial mount

  useEffect(() => {
    if (nonce === seenNonce.current) return
    seenNonce.current = nonce

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // rAF is paused when the projector isn't visible; nothing to show anyway.
    if (typeof document !== 'undefined' && document.hidden) return

    const w = (canvas.width = canvas.clientWidth)
    const h = (canvas.height = canvas.clientHeight)

    const pick = () => colors[(Math.random() * colors.length) | 0]
    const makeStreamer = (): Particle => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9
      const speed = 0.45 + Math.random() * 0.95
      const size = 10 + Math.random() * 18
      return {
        x: originX * w + (Math.random() - 0.5) * w * 0.35,
        y: h * 0.45,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: size,
        h: size * (0.35 + Math.random() * 0.5),
        color: pick(),
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.02,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.002 + Math.random() * 0.004,
        life: 1,
        decay: 1 / (1600 + Math.random() * 900),
      }
    }
    const makeRain = (): Particle => {
      const size = 8 + Math.random() * 12
      return {
        x: Math.random() * w,
        y: -20 - Math.random() * h * 0.3,
        vx: (Math.random() - 0.5) * 0.15,
        vy: 0.15 + Math.random() * 0.2,
        w: size,
        h: size * (0.4 + Math.random() * 0.5),
        color: pick(),
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.015,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.002 + Math.random() * 0.004,
        life: 1,
        decay: 1 / (1900 + Math.random() * 900),
      }
    }

    const particles: Particle[] = [
      ...Array.from({ length: BURST_COUNT }, makeStreamer),
      ...Array.from({ length: RAIN_COUNT }, makeRain),
    ]

    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(now - last, 48) // clamp so a throttled frame can't teleport
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
        p.x += (p.vx + Math.sin(p.wobble) * 0.08) * dt
        p.y += p.vy * dt
        p.rotation += p.vr * dt

        ctx.save()
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4))
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        // squash on the wobble to fake a fluttering ribbon
        ctx.scale(1, Math.abs(Math.cos(p.wobble)) * 0.7 + 0.3)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
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
  }, [nonce, colors, originX])

  return <canvas ref={canvasRef} className="confetti" aria-hidden="true" />
}
