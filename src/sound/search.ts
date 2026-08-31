// Matching songs to what the operator typed. Pure and tested, out of the
// component, because this is the whole point of the feature: during a show
// somebody types "rap" and the right forty songs have to be there
// (Principles: "Business Logic Never Lives in React Components").

import type { SoundTrackInfo } from '../shared/bridge'
import { normalizeTag } from '../shared/soundTags'

/** Every term must match, and a term matches either the song's name or one of
 *  its tags. Terms AND together so "rap beat" narrows rather than widens — the
 *  operator is trying to find one song, not browse. Substrings count, so "guess"
 *  finds "guessing game" without anyone having to type it exactly. */
export function matchesQuery(track: SoundTrackInfo, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const name = track.name.toLowerCase()
  return terms.every((term) => name.includes(term) || track.tags.some((tag) => tag.includes(term)))
}

/** Filter by typed query and by any tags the operator has pinned. Pinned tags
 *  AND together too: pinning "rap" then "high energy" means songs that are both,
 *  which is how you drill into a big library. */
export function filterTracks(
  tracks: readonly SoundTrackInfo[],
  query: string,
  pinnedTags: readonly string[] = [],
): SoundTrackInfo[] {
  const pinned = pinnedTags.map((t) => normalizeTag(t)).filter((t): t is string => t !== null)
  return tracks.filter(
    (track) => pinned.every((tag) => track.tags.includes(tag)) && matchesQuery(track, query),
  )
}

/** Tags carried by every track in the selection, and tags carried by only some.
 *  The split drives the editor: a tag on all of them can be removed cleanly,
 *  while a partial tag needs to read as partial rather than silently applying to
 *  songs that never had it. */
export function tagsForSelection(selected: readonly SoundTrackInfo[]): {
  all: string[]
  some: string[]
} {
  if (selected.length === 0) return { all: [], some: [] }
  const counts = new Map<string, number>()
  for (const track of selected) {
    for (const tag of track.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  const all: string[] = []
  const some: string[] = []
  for (const [tag, count] of counts) {
    if (count === selected.length) all.push(tag)
    else some.push(tag)
  }
  return { all: all.sort(), some: some.sort() }
}

/** Existing tags that could complete what's being typed, minus ones already
 *  applied to everything selected. Keeps autocomplete from offering a no-op. */
export function suggestTags(
  allTags: readonly string[],
  input: string,
  exclude: readonly string[] = [],
): string[] {
  const term = input.trim().toLowerCase()
  const skip = new Set(exclude)
  return allTags.filter((tag) => !skip.has(tag) && (term === '' || tag.includes(term))).slice(0, 12)
}

/** The tags carrying the most songs, biggest first. These become the shortcuts
 *  offered before anything is typed — the handful you actually reach for, rather
 *  than the whole tag list, which is a curation-time concern. */
export function topTags(
  tracks: readonly SoundTrackInfo[],
  limit = 8,
): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const track of tracks) {
    for (const tag of track.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    // Ties break alphabetically so the row doesn't reshuffle between renders.
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit)
}

/** One row in the search panel. Before anything is typed the rows are tag
 *  shortcuts; after, they're songs. Both are in one list so the keyboard can
 *  walk it without caring which mode it's in — type, arrow down, Enter. */

/** Move a highlight by `delta`, wrapping at both ends so holding Down cycles
 *  rather than sticking at the bottom. Returns 0 for an empty list.
 *
 *  The search grid lays pads out in rows but walks them in READING ORDER, so
 *  this stays a one-dimensional list: Down means "the next one", not "the one
 *  directly below". Two-dimensional arrows sound nicer and are worse — you'd
 *  have to think about geometry mid-show. */
export function moveIndex(current: number, delta: number, length: number): number {
  if (length === 0) return 0
  return (((current + delta) % length) + length) % length
}
