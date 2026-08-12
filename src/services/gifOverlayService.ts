// Auto-dismiss the GIF overlay after a few seconds so the operator doesn't have
// to remember to clear it. Picking a new GIF restarts the timer; clearing it (or
// going to Black) cancels it. Timers live in a service, never the pure reducer.
// Attached to the OPERATOR store (the authority), like the reveal service.

import type { Store } from '../store/store'

export const GIF_OVERLAY_MS = 9000 // how long a searched GIF stays up (tweakable)

export function attachGifOverlayService(store: Store, durationMs = GIF_OVERLAY_MS): () => void {
  let last = store.getState().gifOverlay
  let timer: ReturnType<typeof setTimeout> | undefined

  const unsubscribe = store.subscribe(() => {
    const current = store.getState().gifOverlay
    if (current === last) return
    last = current
    clearTimeout(timer)
    if (current) {
      timer = setTimeout(() => store.dispatch({ type: 'gif.overlay', src: null }), durationMs)
    }
  })

  return () => {
    clearTimeout(timer)
    unsubscribe()
  }
}
