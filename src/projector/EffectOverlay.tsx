// Fire-and-forget overlays that play on TOP of whatever scene is showing. Fires
// when `nonce` changes (never on first mount). Two kinds of effect:
//   • particle effects on a canvas: confetti / streamers / fireworks + emoji cannons
//   • screen effects via a CSS layer: camera flash / team color wash
// Self-contained, no dependencies.

import { useEffect, useMemo, useRef } from 'react'

import { EMOJI_FONT_STACK, warmEmojiGlyphs } from './emojiFont'

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
  term: number // the fall speed air resistance holds it to, px/ms (see the tick)
  life: number
  decay: number
}

const CONFETTI_COLORS = ['#2f6bff', '#e23b3b', '#ffd23f', '#39d98a', '#b06bff', '#ffffff']
const FIREWORK_COLORS = ['#ffd23f', '#ff7ad9', '#5ad1ff', '#7cff8a', '#ff6b6b', '#ffffff']
const EFFECT_EMOJI: Record<string, string> = { hearts: '❤️', stars: '⭐' }

// Particle effects run on the canvas. (Team-color washes moved to WashOverlay,
// which is press-and-hold rather than a one-shot fire.) 'team-emoji' cannons the
// teams' scoreboard mood emoji — a dynamic glyph pool resolved by the caller.
const PARTICLE_KINDS = new Set(['confetti', 'streamers', 'fireworks', 'hearts', 'stars', 'team-emoji'])
// Verdict "slams": a big word that slams down over the scene (guessing games).
// Each fire picks a random phrase from the pool.
const SLAMS: Record<string, { words: string[]; cls: string }> = {
  success: {
    cls: 'fx-slam--success',
    words: ['SUCCESS!', 'NAILED IT!', 'YES!', 'GOT IT!', 'BOOM!', 'CORRECT!', 'BINGO!'],
  },
  nope: {
    cls: 'fx-slam--nope',
    words: ['NOPE!', 'NUH-UH', 'WRONG!', 'NOT IT', 'SO CLOSE', 'TRY AGAIN', 'DENIED'],
  },
}

const GRAVITY = 0.0012 // px per ms^2
const DRAG = 0.9996
// Falling paper is held to a slow flutter by air resistance; a shot piece keeps
// its full speed on the way UP (that's the punch) and only eases to this once
// it's coming down. Speeds are tuned at 1080 tall and scale with the canvas, so
// the rain takes as long on any screen.
const FALL_SETTLE = 0.004 // per ms: how quickly a falling piece eases to `term`
const REF_H = 1080

// Cap the canvas' internal render resolution. The particle effects — the
// fireworks especially — are fill-rate bound: every frame clears the whole
// canvas and blends hundreds of additive glow sprites over it, so cost scales
// with pixel count. On a 4K projector that's ~4× the fill of 1080p and it can
// crawl. The canvas is CSS-stretched to fill the screen (see .fx-overlay), so we
// render at a capped backing resolution and let the browser upscale; the glow is
// soft enough that the downscale is invisible. 1080p and below are left as-is.
const MAX_RENDER_WIDTH = 1920

function rand(a: number, b: number) {
  return a + Math.random() * (b - a)
}
function pick<T>(arr: T[]): T {
  return arr[(Math.random() * arr.length) | 0]
}

// A soft round glow, pre-rendered once per color to an offscreen canvas. Drawing
// this with drawImage is far cheaper than canvas shadowBlur per particle (which
// tanks the frame rate and makes the animation crawl).
const glowCache = new Map<string, HTMLCanvasElement>()
function glowSprite(color: string): HTMLCanvasElement {
  const cached = glowCache.get(color)
  if (cached) return cached
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, color)
  grd.addColorStop(0.35, color)
  grd.addColorStop(1, 'transparent')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  glowCache.set(color, c)
  return c
}

// Build the starting particles for the cannon / streamer effects. `glyphs` is the
// emoji pool for a glyph cannon (each particle picks one at random, so a two-team
// pool rains mixed); falls back to the kind's static emoji if none is given.
function spawnParticles(kind: string, w: number, h: number, glyphs?: string[]): Particle[] {
  const out: Particle[] = []
  const pool = glyphs && glyphs.length ? glyphs : EFFECT_EMOJI[kind] ? [EFFECT_EMOJI[kind]] : []
  const useGlyph = pool.length > 0

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
        term: rand(0.16, 0.26) * (h / REF_H),
        life: 1,
        decay: 1 / rand(4200, 6000),
      })
    }
    return out
  }

  // confetti / hearts / stars / team-emoji: two cannons from the bottom corners,
  // up + inward. Each glyph particle draws from the pool, so a two-team pool mixes.
  // Emoji are dearer to draw than paper, so glyph cannons fire fewer.
  const perCannon = useGlyph ? 70 : 120
  const cannon = (originX: number, aimSign: number) => {
    for (let i = 0; i < perCannon; i++) {
      const angle = -Math.PI / 2 + aimSign * rand(0.1, 0.6)
      const speed = rand(1.1, 2.0)
      const glyph = useGlyph ? pick(pool) : undefined
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
        // Paper flutters; an emoji is "heavier" and drops a little faster.
        term: (glyph ? rand(0.24, 0.32) : rand(0.15, 0.24)) * (h / REF_H),
        life: 1,
        // A backstop only: pieces normally leave by falling off the bottom.
        decay: 1 / rand(8000, 10000),
      })
    }
  }
  cannon(0.06, +1)
  cannon(0.94, -1)

  // Plain confetti also gets a downpour: a second wave already falling from
  // above the top edge, spread high so it keeps arriving for several seconds
  // after the shot instead of all at once.
  if (kind === 'confetti') {
    for (let i = 0; i < 180; i++) {
      const size = rand(9, 18)
      out.push({
        x: rand(0, w),
        y: rand(-h * 0.75, -h * 0.1),
        vx: rand(-0.04, 0.04),
        vy: rand(0.04, 0.1),
        w: size,
        h: size * rand(0.4, 0.9),
        color: pick(CONFETTI_COLORS),
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.008, 0.008),
        wobble: rand(0, Math.PI * 2),
        wobbleSpeed: rand(0.002, 0.005),
        flutter: true,
        term: rand(0.15, 0.24) * (h / REF_H),
        life: 1,
        decay: 1 / rand(12000, 14000),
      })
    }
  }
  return out
}

export function EffectOverlay({
  kind,
  nonce,
  emojiSide = 'both',
  blueEmoji = '',
  redEmoji = '',
}: {
  kind: string
  nonce: number
  /** For 'team-emoji': whose mood to rain — blue, red, or both mixed. */
  emojiSide?: 'blue' | 'red' | 'both'
  blueEmoji?: string
  redEmoji?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const seenNonce = useRef(nonce) // don't fire on the initial mount
  // The team-emoji inputs matter only at fire time, so hold them in refs kept
  // current each render. Keeping them OUT of the effect's deps means changing a
  // team's mood (or revealing another beat) mid-burst can't cancel the running
  // animation — the effect only re-runs when `nonce` (a fresh fire) changes.
  const emojiSideRef = useRef(emojiSide)
  emojiSideRef.current = emojiSide
  const blueEmojiRef = useRef(blueEmoji)
  blueEmojiRef.current = blueEmoji
  const redEmojiRef = useRef(redEmoji)
  redEmojiRef.current = redEmoji

  // Warm every glyph this overlay can draw, whenever the pool changes: the two
  // static ones plus whatever moods the teams are currently wearing.
  useEffect(() => {
    warmEmojiGlyphs(Object.values(EFFECT_EMOJI).join('') + blueEmoji + redEmoji)
  }, [blueEmoji, redEmoji])

  // Pick a random verdict phrase per fire (stable across unrelated re-renders).
  const slamWord = useMemo(() => {
    const s = SLAMS[kind]
    return s ? s.words[(Math.random() * s.words.length) | 0] : ''
  }, [kind, nonce])

  useEffect(() => {
    if (nonce === seenNonce.current) return
    seenNonce.current = nonce
    if (!PARTICLE_KINDS.has(kind)) return // screen effects use the CSS layer below

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (typeof document !== 'undefined' && document.hidden) return // rAF is paused anyway

    const scale = Math.min(1, MAX_RENDER_WIDTH / canvas.clientWidth)
    const w = (canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale)))
    const h = (canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale)))

    // 'team-emoji' rains the relevant team's mood(s); other kinds use no pool.
    const side = emojiSideRef.current
    const blue = blueEmojiRef.current
    const red = redEmojiRef.current
    const teamGlyphs =
      kind === 'team-emoji'
        ? (side === 'blue' ? [blue] : side === 'red' ? [red] : [blue, red]).map((g) => g.trim()).filter(Boolean)
        : undefined

    const tick =
      kind === 'fireworks'
        ? makeFireworksTick(ctx, w, h, rafRef)
        : makeParticleTick(ctx, w, h, kind, rafRef, teamGlyphs)

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [kind, nonce])

  return (
    <>
      <canvas ref={canvasRef} className="fx-overlay" aria-hidden="true" />
      {/* Screen effects + verdict slams: CSS layers that replay via key. */}
      {SLAMS[kind] && (
        <div key={nonce} className="fx-slam" aria-hidden="true">
          <span className={`fx-slam__word ${SLAMS[kind].cls}`}>{slamWord}</span>
        </div>
      )}
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
  glyphs?: string[],
) {
  const particles = spawnParticles(kind, w, h, glyphs)
  let last = performance.now()
  const tick = (now: number) => {
    const dt = Math.min(now - last, 48)
    last = now
    ctx.clearRect(0, 0, w, h)

    let alive = false
    for (const p of particles) {
      p.life -= p.decay * dt
      if (p.life <= 0 || p.y > h + 60) continue
      alive = true
      // Rising: plain gravity, so the shot keeps its punch. Falling: air
      // resistance takes over and settles it at its flutter speed.
      if (p.vy < 0) p.vy += GRAVITY * dt
      else p.vy += (p.term - p.vy) * Math.min(1, FALL_SETTLE * dt)
      p.vx *= DRAG
      p.wobble += p.wobbleSpeed * dt
      // Sways wider once it's drifting down than while it's being shot up.
      const sway = p.vy > 0 ? 0.13 : 0.06
      p.x += (p.vx + Math.sin(p.wobble) * sway) * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt

      ctx.save()
      // Full strength until the very end of its life (most leave off the bottom
      // first), rather than fading the whole way down.
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 4))
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      if (p.glyph) {
        ctx.font = `${p.w}px ${EMOJI_FONT_STACK}`
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
    sprite: HTMLCanvasElement
    size: number
    life: number
    decay: number
  }
  interface Flash {
    x: number
    y: number
    r: number
    sprite: HTMLCanvasElement
    life: number
  }
  // More shells, staggered, at varied positions and heights.
  const launches = [
    { x: 0.24, t: 0, apex: 0.32 },
    { x: 0.7, t: 260, apex: 0.22 },
    { x: 0.45, t: 560, apex: 0.4 },
    { x: 0.82, t: 820, apex: 0.3 },
    { x: 0.15, t: 1080, apex: 0.26 },
  ]
  const shells: Shell[] = []
  const sparks: Spark[] = []
  const flashes: Flash[] = []
  let launched = 0
  const start = performance.now()
  let last = start

  const whiteGlow = glowSprite('#ffffff')

  const burst = (x: number, y: number, color: string) => {
    // Every spark and the flash of one burst share a color, so resolve the glow
    // sprite once here rather than looking it up per particle per frame.
    const sprite = glowSprite(color)
    // A bright pop at the burst point...
    flashes.push({ x, y, r: 10, sprite, life: 1 })
    // ...then a big, dense ring of glowing sparks.
    const n = 70
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.06, 0.06)
      const sp = rand(0.32, 0.92)
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        sprite,
        size: rand(3, 5),
        life: 1,
        decay: 1 / rand(1300, 2200),
      })
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

    ctx.globalCompositeOperation = 'lighter' // additive bloom where glows overlap

    // Rising shells — a glowing comet (cheap glow sprite, no shadowBlur).
    for (const s of shells) {
      if (s.done) continue
      s.vy += s.g * dt
      s.y += s.vy * dt
      ctx.globalAlpha = 0.95
      ctx.drawImage(whiteGlow, s.x - 10, s.y - 10, 20, 20)
      if (s.vy >= 0) {
        burst(s.x, s.y, s.color)
        s.done = true
      }
    }

    // Burst flashes — a quick expanding glow.
    let flashAlive = false
    for (const f of flashes) {
      f.life -= dt / 260
      if (f.life <= 0) continue
      flashAlive = true
      f.r += 0.5 * dt
      ctx.globalAlpha = Math.max(0, f.life) * 0.7
      ctx.drawImage(f.sprite, f.x - f.r, f.y - f.r, f.r * 2, f.r * 2)
    }

    // Glowing sparks falling under gravity.
    let sparksAlive = false
    for (const p of sparks) {
      p.life -= p.decay * dt
      if (p.life <= 0) continue
      sparksAlive = true
      p.vy += 0.0006 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      const rad = p.size * 3
      ctx.globalAlpha = Math.max(0, p.life)
      ctx.drawImage(p.sprite, p.x - rad, p.y - rad, rad * 2, rad * 2)
    }

    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1

    const pending = launched < launches.length || shells.some((s) => !s.done)
    if (pending || sparksAlive || flashAlive) rafRef.current = requestAnimationFrame(tick)
    else ctx.clearRect(0, 0, w, h)
  }
  return tick
}
