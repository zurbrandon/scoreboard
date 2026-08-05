// Eases a displayed number from its current value toward a target whenever the
// target changes. Pure presentation — the store always holds the true score;
// this only animates how it's shown (counts up or down, handles negatives).
//
// Reliability first (Engineering Principles): requestAnimationFrame is paused by
// the browser when the projector isn't visible. If we relied on it blindly, a
// hidden or occluded projector could freeze mid-count on the WRONG number. So:
// when the document is hidden we skip the animation and snap straight to the
// true value; if it becomes hidden mid-animation we snap as well. When visible,
// we animate. The displayed number therefore always converges on the truth.

import { useEffect, useRef, useState } from 'react'

export function useAnimatedNumber(target: number, durationMs = 1800): number {
  const [display, setDisplay] = useState(target)
  const displayRef = useRef(target)
  displayRef.current = display // mirror the latest shown value every render

  const rafRef = useRef(0)

  useEffect(() => {
    const from = displayRef.current
    if (from === target) return

    // Not visible → animation is pointless and rAF is throttled anyway. Show truth.
    if (typeof document !== 'undefined' && document.hidden) {
      setDisplay(target)
      return
    }

    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      if (t >= 1) {
        setDisplay(target) // land exactly on the target (preserves decimals)
        return
      }
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      // Whole-number ticking while counting; the final frame above is exact.
      setDisplay(Math.round(from + (target - from) * eased))
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)

    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current)
        setDisplay(target) // snap so a paused count never leaves a stale number
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelAnimationFrame(rafRef.current)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [target, durationMs])

  return display
}
