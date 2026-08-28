// A shuffle that plays everything before it repeats anything.
//
// Rolling a die each time is what makes a "random" playlist sound broken: over
// an hour of house music it replays the same song within minutes while other
// songs never come up. A bag deals out every song in random order, then refills.

/** Fisher–Yates. `random` is injected so the order is testable. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Refill a spent bag from `pool`, avoiding starting the new pass with the song
 *  that just played — the one repeat a listener actually notices. */
export function refillBag<T>(
  pool: readonly T[],
  justPlayed: T | null,
  random: () => number = Math.random,
): T[] {
  const next = shuffle(pool, random)
  if (next.length > 1 && justPlayed !== null && next[0] === justPlayed) {
    // Move it back one place rather than reshuffling until it isn't first,
    // which could spin.
    ;[next[0], next[1]] = [next[1], next[0]]
  }
  return next
}
