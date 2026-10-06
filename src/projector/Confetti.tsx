// A self-contained canvas confetti burst — no external dependency (offline-first,
// easy to delete). Fires when `nonce` changes; the first mount does not fire.
// Tuned to feel celebratory: a big burst of fluttering streamers from the
// winner's side (`originX`, 0..1 across the width), then a full-width downpour
// arriving from above for several seconds, in the given colors. Pieces keep
// full speed going up and flutter slowly coming down (see `term`).

import { useEffect, useRef } from 'react'

import { EMOJI_FONT_STACK, warmEmojiGlyphs } from './emojiFont'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  color: string
  glyph: string | null // an emoji piece (theme confetti) instead of a paper one
  rotation: number
  vr: number
  wobble: number // phase for horizontal flutter
  wobbleSpeed: number
  term: number // fall speed air resistance holds it to, px/ms
  life: number // 1 → 0
  decay: number
}

const GRAVITY = 0.0011 // px per ms^2
const DRAG = 0.9997
const BURST_COUNT = 240
const RAIN_COUNT = 200
const FALL_SETTLE = 0.004 // per ms: how quickly a falling piece eases to `term`
const REF_H = 1080 // fall speeds are tuned at this height and scale with the canvas
const GLYPH_SHARE = 0.16 // of pieces, when a theme supplies glyphs
const GLYPH_SCALE = 2.2 // emoji read small next to paper at the same size

export function Confetti({
  nonce,
  colors,
  originX,
  glyphs,
  stopNonce = 0,
}: {
  nonce: number
  colors: string[]
  originX: number
  glyphs?: string[]
  /** Bumped by the reveal kill switch: clears whatever is still falling. */
  stopNonce?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const seenNonce = useRef(nonce) // don't fire on initial mount
  const seenStop = useRef(stopNonce)

  // The downpour runs ~10s, long enough that a STOPped reveal would otherwise
  // keep raining on a board the operator has just settled.
  useEffect(() => {
    if (stopNonce === seenStop.current) return
    seenStop.current = stopNonce
    cancelAnimationFrame(rafRef.current)
    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }, [stopNonce])

  // Canvas text doesn't load webfonts, so warm the theme's emoji as soon as the
  // theme is picked — long before a reveal fires them.
  useEffect(() => {
    if (glyphs) warmEmojiGlyphs(glyphs.join(''))
  }, [glyphs])

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
    const fall = (lo: number, hi: number) => (lo + Math.random() * (hi - lo)) * (h / REF_H)
    const pickGlyph = () =>
      glyphs?.length && Math.random() < GLYPH_SHARE ? glyphs[(Math.random() * glyphs.length) | 0] : null
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
        glyph: pickGlyph(),
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.02,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.002 + Math.random() * 0.004,
        term: fall(0.15, 0.24),
        life: 1,
        // A backstop only: pieces normally leave by falling off the bottom.
        decay: 1 / (7000 + Math.random() * 2000),
      }
    }
    const makeRain = (): Particle => {
      const size = 8 + Math.random() * 12
      return {
        x: Math.random() * w,
        // Spread high above the top edge so the downpour keeps arriving for
        // several seconds after the burst rather than landing all at once.
        y: -20 - Math.random() * h * 0.75,
        vx: (Math.random() - 0.5) * 0.08,
        vy: 0.04 + Math.random() * 0.08,
        w: size,
        h: size * (0.4 + Math.random() * 0.5),
        color: pick(),
        glyph: pickGlyph(),
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.015,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.002 + Math.random() * 0.004,
        term: fall(0.15, 0.24),
        life: 1,
        decay: 1 / (12000 + Math.random() * 2000),
      }
    }

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
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
        if (p.life <= 0 || p.y > h + 60) continue
        alive = true
        // Rising: plain gravity, so the burst keeps its punch. Falling: air
        // resistance takes over and settles it at its flutter speed.
        const term = p.glyph ? p.term * 1.6 : p.term // emoji are "heavier"
        if (p.vy < 0) p.vy += GRAVITY * dt
        else p.vy += (term - p.vy) * Math.min(1, FALL_SETTLE * dt)
        p.vx *= DRAG
        p.wobble += p.wobbleSpeed * dt
        // Sways wider drifting down than while being shot up.
        p.x += (p.vx + Math.sin(p.wobble) * (p.vy > 0 ? 0.13 : 0.08)) * dt
        p.y += p.vy * dt
        p.rotation += p.vr * dt

        ctx.save()
        // Full strength until the end of its life rather than fading all the way down.
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 4))
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        if (p.glyph) {
          // A lighter squash than paper: enough to read as a flap or a tumble
          // without flattening the emoji into a line.
          ctx.rotate(-p.rotation * 0.7)
          ctx.scale(1, Math.abs(Math.cos(p.wobble)) * 0.3 + 0.7)
          ctx.font = `${Math.round(p.w * GLYPH_SCALE)}px ${EMOJI_FONT_STACK}`
          ctx.fillText(p.glyph, 0, 0)
        } else {
          // squash on the wobble to fake a fluttering ribbon
          ctx.scale(1, Math.abs(Math.cos(p.wobble)) * 0.7 + 0.3)
          ctx.fillStyle = p.color
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
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
  }, [nonce, colors, originX, glyphs])

  return <canvas ref={canvasRef} className="confetti" aria-hidden="true" />
}
