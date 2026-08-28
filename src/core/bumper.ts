// Pure bumper-selection logic. No audio, no DOM — so the "random, but never the
// same track twice in a row" rule (PRD) is testable on a MacBook with a seeded
// random function. The AudioController layers real playback on top of this.

export interface BumperTrack {
  id: string
  name: string
}

// Pick a random track, avoiding an immediate repeat of `lastTrackId` when there
// is more than one to choose from. `rand` returns a float in [0, 1).
export function pickBumper<T extends BumperTrack>(
  tracks: T[],
  lastTrackId: string | null,
  rand: () => number,
): T | null {
  if (tracks.length === 0) return null
  if (tracks.length === 1) return tracks[0]

  const eligible = tracks.filter((t) => t.id !== lastTrackId)
  const pool = eligible.length > 0 ? eligible : tracks
  const index = Math.min(pool.length - 1, Math.floor(rand() * pool.length))
  return pool[index]
}

/** Songs carrying `tag`. The slot mechanism's whole job: a behavior names a tag
 *  and the pool is whatever currently carries it, so adding a song to a
 *  behavior is just tagging it. */
export function tracksWithTag<T extends { tags: readonly string[] }>(
  tracks: readonly T[],
  tag: string | null,
): T[] {
  if (!tag) return []
  return tracks.filter((t) => t.tags.includes(tag))
}

/** One song from `pool` at random, or null if the pool is empty — which is the
 *  signal to fall back to the folder a behavior used before it had a tag. */
export function pickFromPool<T>(pool: readonly T[], random: () => number = Math.random): T | null {
  if (pool.length === 0) return null
  return pool[Math.floor(random() * pool.length)] ?? null
}
