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
