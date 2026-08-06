// Orchestrates the reveal sequence — the part that involves *time*, which the
// pure reducer can't own (Principles: reveal sequencing is business logic, not a
// component concern). It watches for a reveal (via revealNonce) and, for the
// Final score, drives the multi-step finale on a timer.
//
// Attached only to the OPERATOR store (the authority). The projector reads
// revealPhase / finaleStage and renders; it never runs this.

import type { Store } from '../store/store'

// How long the winner emphasis (grow, glow pulse, sheen) holds on the projector
// after a normal reveal. Long enough to ride the bumper music. Interruptible: a
// new reveal mid-celebration restarts this window.
export const REVEAL_DURATION_MS = 10000

// Final-score sequence timings.
export const FINALE_TABULATE_MS = 4000 // "tabulating final score" + drum roll build
export const FINALE_COUNTDOWN_STEP_MS = 1000 // 3 … 2 … 1
export const FINALE_CELEBRATE_MS = 14000 // winner takeover holds this long, then resets

export function attachRevealService(
  store: Store,
  durationMs: number = REVEAL_DURATION_MS,
): () => void {
  let lastNonce = store.getState().revealNonce
  let lastFinaleNonce = store.getState().finaleNonce
  const timers = new Set<ReturnType<typeof setTimeout>>()

  const clearTimers = () => {
    for (const t of timers) clearTimeout(t)
    timers.clear()
  }
  const at = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.delete(t)
      fn()
    }, ms)
    timers.add(t)
  }

  const unsubscribe = store.subscribe(() => {
    const state = store.getState()
    const finaleStarted = state.finaleNonce !== lastFinaleNonce
    const revealed = state.revealNonce !== lastNonce
    lastFinaleNonce = state.finaleNonce
    lastNonce = state.revealNonce

    if (finaleStarted) {
      // Final score: tabulating (now) → 3 · 2 · 1 → celebrate → finish.
      clearTimers()
      const d = store.dispatch
      at(FINALE_TABULATE_MS + 0 * FINALE_COUNTDOWN_STEP_MS, () => d({ type: 'finale.countdown', value: 3 }))
      at(FINALE_TABULATE_MS + 1 * FINALE_COUNTDOWN_STEP_MS, () => d({ type: 'finale.countdown', value: 2 }))
      at(FINALE_TABULATE_MS + 2 * FINALE_COUNTDOWN_STEP_MS, () => d({ type: 'finale.countdown', value: 1 }))
      at(FINALE_TABULATE_MS + 3 * FINALE_COUNTDOWN_STEP_MS, () => d({ type: 'finale.celebrate' }))
      at(
        FINALE_TABULATE_MS + 3 * FINALE_COUNTDOWN_STEP_MS + FINALE_CELEBRATE_MS,
        () => d({ type: 'reveal.finish' }),
      )
      return
    }

    if (revealed) {
      // The finale bumps revealNonce itself (at 'celebrate') — its own timeline
      // already schedules the finish, so don't start a normal-reveal timer.
      if (state.finaleStage === 'celebrate') return
      clearTimers()
      at(durationMs, () => store.dispatch({ type: 'reveal.finish' }))
    }
  })

  return () => {
    clearTimers()
    unsubscribe()
  }
}
