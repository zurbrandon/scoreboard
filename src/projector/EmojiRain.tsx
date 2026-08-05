// Rains the winning team's mood emoji across the whole screen during the reveal
// celebration. Fires on `nonce` change (like the confetti) only when an emoji is
// set; the first mount never fires. Self-contained canvas, no dependencies.

import { useEffect, useRef } from 'react'

interface Flake {
  x: number
  y: number
  vy: number
  vx: number
  size: number
  rot: number
  vrot: number
  sway: number
  swaySpeed: number
}

const COUNT = 50
const MAX_MS = 8500 // whole rain lasts about this long
const FADE_MS = 1300 // gentle fade-out at the end

export function EmojiRain({ nonce, emoji }: { nonce: number; emoji: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const seenNonce = useRef(nonce)

  useEffect(() => {
    if (nonce === seenNonce.current) return
    seenNonce.current = nonce

    const glyph = emoji.trim()
    if (!glyph) return // no mood set → no rain

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // rAF is paused when the projector isn't visible; nothing to show anyway.
    if (typeof document !== 'undefined' && document.hidden) return

    const w = (canvas.width = canvas.clientWidth)
    const h = (canvas.height = canvas.clientHeight)

    const flakes: Flake[] = Array.from({ length: COUNT }, () => {
      const size = (0.035 + Math.random() * 0.04) * w
      return {
        x: Math.random() * w,
        // staggered above the top so they cascade in rather than all at once
        y: -Math.random() * h * 1.2 - size,
        vy: (0.18 + Math.random() * 0.22) * (h / 720),
        vx: (Math.random() - 0.5) * 0.05,
        size,
        rot: (Math.random() - 0.5) * 0.6,
        vrot: (Math.random() - 0.5) * 0.0012,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 0.001 + Math.random() * 0.002,
      }
    })

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const start = performance.now()
    let last = start
    const tick = (now: number) => {
      const dt = Math.min(now - last, 48) // clamp so a throttled frame can't teleport
      last = now
      const elapsed = now - start
      const fade = elapsed > MAX_MS - FADE_MS ? Math.max(0, (MAX_MS - elapsed) / FADE_MS) : 1
      ctx.clearRect(0, 0, w, h)

      for (const f of flakes) {
        f.vy += 0.0002 * dt // slight acceleration
        f.sway += f.swaySpeed * dt
        f.x += (f.vx + Math.sin(f.sway) * 0.06) * dt
        f.y += f.vy * dt
        f.rot += f.vrot * dt

        // Recycle flakes that fall off the bottom so the rain stays steady for
        // the whole duration — but stop once we've entered the fade-out, so the
        // last flakes fall away cleanly instead of popping back in.
        if (f.y > h + f.size && elapsed < MAX_MS - FADE_MS) {
          f.x = Math.random() * w
          f.y = -f.size - Math.random() * h * 0.25
          f.vy = (0.18 + Math.random() * 0.22) * (h / 720)
        }

        ctx.save()
        ctx.globalAlpha = fade
        ctx.translate(f.x, f.y)
        ctx.rotate(f.rot)
        ctx.font = `${f.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
        ctx.fillText(glyph, 0, 0)
        ctx.restore()
      }

      if (elapsed < MAX_MS) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        ctx.clearRect(0, 0, w, h)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [nonce, emoji])

  return <canvas ref={canvasRef} className="emoji-rain" aria-hidden="true" />
}
