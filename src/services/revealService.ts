// Orchestrates the reveal sequence — the part that involves *time*, which the
// pure reducer can't own (Principles: reveal sequencing is business logic, not a
// component concern). It watches for a reveal (via revealNonce), holds the
// "revealing" phase for the sequence duration, then dispatches reveal.finish.
//
// Attached only to the OPERATOR store (the authority). The projector reads
// revealPhase and renders; it never runs this.
//
// This is also the seam where bumper music will start in M3.

import type { Store } from '../store/store'

// How long the winner emphasis (grow, glow pulse, sheen) holds on the projector
// after a reveal. Long enough to ride the bumper music. The confetti burst is
// separate and shorter — it fires once at the start. Interruptible: a new reveal
// mid-celebration restarts this window.
export const REVEAL_DURATION_MS = 10000
// The winner finale ('end' phase) lingers longer than a normal reveal.
export const FINALE_DURATION_MS = 16000

export function attachRevealService(
  store: Store,
  durationMs: number = REVEAL_DURATION_MS,
): () => void {
  let lastNonce = store.getState().revealNonce
  let timer: ReturnType<typeof setTimeout> | undefined

  const unsubscribe = store.subscribe(() => {
    const state = store.getState()
    if (state.revealNonce === lastNonce) return // some other state change; ignore
    lastNonce = state.revealNonce

    // A reveal just happened. The finale holds longer than a normal reveal.
    // Interruptible: a fresh reveal mid-sequence restarts the hold.
    const hold = state.revealPhase === 'finale' ? FINALE_DURATION_MS : durationMs
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      store.dispatch({ type: 'reveal.finish' })
    }, hold)
  })

  return () => {
    if (timer) clearTimeout(timer)
    unsubscribe()
  }
}
