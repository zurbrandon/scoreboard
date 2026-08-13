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

// Final-score sequence timings. Paced for suspense: a long tabulating build,
// then unhurried beats between the countdown numbers.
export const FINALE_TABULATE_MS = 7000 // "tabulating final score" + drum roll build
export const FINALE_COUNTDOWN_STEP_MS = 1700 // beat between 3 … 2 … 1 (and 1 → celebrate)
export const FINALE_CELEBRATE_MS = 14000 // winner takeover holds this long, then resets

// A slide's cue effect fires this long after the slide is revealed, so it lands
// AFTER the entrance + text animation instead of all at once (you'd miss it).
export const CUE_EFFECT_DELAY_MS = 1100

export function attachRevealService(
  store: Store,
  durationMs: number = REVEAL_DURATION_MS,
): () => void {
  let lastNonce = store.getState().revealNonce
  let lastFinaleNonce = store.getState().finaleNonce
  let lastStopNonce = store.getState().stopNonce
  let lastAnimNonce = store.getState().revealAnimNonce
  const timers = new Set<ReturnType<typeof setTimeout>>()
  // The pending slide cue-effect fire, kept separate from the finale timers so
  // its own clears don't cancel it (and vice versa).
  let cueEffectTimer: ReturnType<typeof setTimeout> | undefined
  const clearCueEffect = () => {
    if (cueEffectTimer) clearTimeout(cueEffectTimer)
    cueEffectTimer = undefined
  }

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
    const stopped = state.stopNonce !== lastStopNonce
    const animRevealed = state.revealAnimNonce !== lastAnimNonce
    lastFinaleNonce = state.finaleNonce
    lastNonce = state.revealNonce
    lastStopNonce = state.stopNonce
    lastAnimNonce = state.revealAnimNonce

    // A slide was revealed → if it carries a cue effect, fire it after a beat so
    // it lands once the slide has animated in. A newer reveal cancels a pending
    // one, so a fast operator never gets the previous slide's effect on this one.
    if (animRevealed) {
      clearCueEffect()
      const live = state.scene === 'slides' ? state.slides.live : null
      const effectKind = live && 'cue' in live ? live.cue?.effect : undefined
      if (effectKind) {
        cueEffectTimer = setTimeout(() => {
          cueEffectTimer = undefined
          store.dispatch({ type: 'effect.fire', kind: effectKind })
        }, CUE_EFFECT_DELAY_MS)
      }
    }

    if (stopped) {
      clearCueEffect()
      // Kill switch: cancel every pending step so a queued countdown/celebrate/
      // finish can't fire after the operator stopped. The reducer already put the
      // board in its terminal frame; the service just stands down.
      clearTimers()
      return
    }

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
    clearCueEffect()
    unsubscribe()
  }
}
