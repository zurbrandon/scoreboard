// Fire-and-forget overlays that play on TOP of whatever scene is showing. Fires
// when `nonce` changes (never on first mount). Two kinds of effect:
//   • particle effects on a canvas: confetti / streamers / fireworks + emoji cannons
//   • screen effects via a CSS layer: camera flash / team color wash
// Self-contained, no dependencies.

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  color: string
  glyph?: string
  rot: number
  vr: number
  wobble: number
  wobbleSpeed: number
  flutter: boolean
  life: number
  decay: number
}

const CONFETTI_COLORS = ['#2f6bff', '#e23b3b', '#ffd23f', '#39d98a', '#b06bff', '#ffffff']
const FIREWORK_COLORS = ['#ffd23f', '#ff7ad9', '#5ad1ff', '#7cff8a', '#ff6b6b', '#ffffff']
const EFFECT_EMOJI: Record<string, string> = { hearts: '❤️', stars: '⭐' }

// Particle effects run on the canvas; screen effects run on the CSS layer.
const PARTICLE_KINDS = new Set(['confetti', 'streamers', 'fireworks', 'hearts', 'stars'])
const SCREEN_KINDS = new Set(['flash', 'wash-blue', 'wash-red'])

const GRAVITY = 0.0012 // px per ms^2
const DRAG = 0.9996

function rand(a: number, b: number) {
  return a + Math.random() * (b - a)
}
function pick<T>(arr: T[]): T {
  return arr[(Math.random() * arr.length) | 0]
}

// Build the starting particles for the cannon / streamer effects.
function spawnParticles(kind: string, w: number, h: number): Particle[] {
  const out: Particle[] = []
  const glyph = EFFECT_EMOJI[kind]

  if (kind === 'streamers') {
    // Long ribbons drifting down from across the top edge.
    for (let i = 0; i < 44; i++) {
      const width = rand(4, 8)
      out.push({
        x: rand(0, w),
        y: rand(-h * 0.4, -20),
        vx: rand(-0.05, 0.05),
        vy: rand(0.12, 0.26),
        w: width,
        h: width * rand(5, 9),
        color: pick(CONFETTI_COLORS),
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.004, 0.004),
        wobble: rand(0, Math.PI * 2),
        wobbleSpeed: rand(0.001, 0.003),
        flutter: true,
        life: 1,
        decay: 1 / rand(4200, 6000),
      })
    }
    return out
  }

  // confetti / hearts / stars: two cannons from the bottom corners, up + inward.
  const cannon = (originX: number, aimSign: number) => {
    for (let i = 0; i < 70; i++) {
      const angle = -Math.PI / 2 + aimSign * rand(0.1, 0.6)
      const speed = rand(1.1, 2.0)
      const size = glyph ? rand(26, 48) : rand(9, 18)
      out.push({
        x: originX * w + rand(-0.02, 0.02) * w,
        y: h + 12,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: size,
        h: glyph ? size : size * rand(0.4, 0.9),
        color: pick(CONFETTI_COLORS),
        glyph,
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.01, 0.01),
        wobble: rand(0, Math.PI * 2),
        wobbleSpeed: rand(0.002, 0.006),
        flutter: !glyph,
        life: 1,
        decay: 1 / rand(2400, 3800),
      })
    }
  }
  cannon(0.06, +1)
  cannon(0.94, -1)
  return out
}

export function EffectOverlay({ kind, nonce }: { kind: string; nonce: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const seenNonce = useRef(nonce) // don't fire on the initial mount

  useEffect(() => {
    if (nonce === seenNonce.current) return
    seenNonce.current = nonce
    if (!PARTICLE_KINDS.has(kind)) return // screen effects use the CSS layer below

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (typeof document !== 'undefined' && document.hidden) return // rAF is paused anyway

    const w = (canvas.width = canvas.clientWidth)
    const h = (canvas.height = canvas.clientHeight)

    const tick =
      kind === 'fireworks' ? makeFireworksTick(ctx, w, h, rafRef) : makeParticleTick(ctx, w, h, kind, rafRef)

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [kind, nonce])

  return (
    <>
      <canvas ref={canvasRef} className="fx-overlay" aria-hidden="true" />
      {/* Screen effects: a CSS layer that replays via key on each fire. */}
      {SCREEN_KINDS.has(kind) && <div key={nonce} className={`fx-screen fx-screen--${kind}`} aria-hidden="true" />}
    </>
  )
}

// Generic gravity-driven particle loop (confetti / streamers / emoji).
function makeParticleTick(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  kind: string,
  rafRef: { current: number },
) {
  const particles = spawnParticles(kind, w, h)
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
      p.x += (p.vx + Math.sin(p.wobble) * 0.06) * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt

      ctx.save()
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5))
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      if (p.glyph) {
        ctx.font = `${p.w}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(p.glyph, 0, 0)
      } else {
        if (p.flutter) ctx.scale(1, Math.abs(Math.cos(p.wobble)) * 0.7 + 0.3)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      }
      ctx.restore()
    }

    if (alive) rafRef.current = requestAnimationFrame(tick)
    else ctx.clearRect(0, 0, w, h)
  }
  return tick
}

// Fireworks: shells rise from the bottom, then burst into radial sparks.
function makeFireworksTick(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rafRef: { current: number },
) {
  interface Shell {
    x: number
    y: number
    vy: number
    g: number
    color: string
    done: boolean
  }
  interface Spark {
    x: number
    y: number
    vx: number
    vy: number
    color: string
    life: number
    decay: number
  }
  const launches = [
    { x: 0.28, t: 0, apex: 0.3 },
    { x: 0.62, t: 380, apex: 0.2 },
    { x: 0.48, t: 760, apex: 0.34 },
  ]
  const shells: Shell[] = []
  const sparks: Spark[] = []
  let launched = 0
  const start = performance.now()
  let last = start

  const burst = (x: number, y: number, color: string) => {
    const n = 48
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.08, 0.08)
      const sp = rand(0.22, 0.6)
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, color, life: 1, decay: 1 / rand(1000, 1700) })
    }
  }

  const tick = (now: number) => {
    const dt = Math.min(now - last, 48)
    last = now
    const elapsed = now - start
    ctx.clearRect(0, 0, w, h)

    while (launched < launches.length && elapsed >= launches[launched].t) {
      const L = launches[launched++]
      const g = 0.0016
      const rise = h - h * L.apex
      shells.push({ x: L.x * w, y: h, vy: -Math.sqrt(2 * g * rise), g, color: pick(FIREWORK_COLORS), done: false })
    }

    for (const s of shells) {
      if (s.done) continue
      s.vy += s.g * dt
      s.y += s.vy * dt
      ctx.save()
      ctx.globalAlpha = 0.9
      ctx.fillStyle = s.color
      ctx.beginPath()
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      if (s.vy >= 0) {
        burst(s.x, s.y, s.color)
        s.done = true
      }
    }

    let sparksAlive = false
    for (const p of sparks) {
      p.life -= p.decay * dt
      if (p.life <= 0) continue
      sparksAlive = true
      p.vy += 0.0007 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      ctx.save()
      ctx.globalAlpha = Math.max(0, p.life)
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    const pending = launched < launches.length || shells.some((s) => !s.done)
    if (pending || sparksAlive) rafRef.current = requestAnimationFrame(tick)
    else ctx.clearRect(0, 0, w, h)
  }
  return tick
}
