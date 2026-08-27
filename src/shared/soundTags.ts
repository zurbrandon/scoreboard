// One canonical form per sound-library tag, shared by the main process (which
// persists tags) and the renderer (which offers autocomplete as you type). If
// these two ever disagreed, the UI would show a tag the store never wrote —
// so normalization lives here, once.

/** Lowercased and whitespace-collapsed, so "Hip Hop", "hip hop" and "hip  hop"
 *  can't become three tags each holding a third of the songs. Returns null for
 *  anything that isn't a usable tag. */
export function normalizeTag(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const tag = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  return tag.length > 0 ? tag : null
}

/** Normalize a list, dropping empties and duplicates, sorted for stable storage
 *  and display. */
export function normalizeTags(raw: readonly unknown[]): string[] {
  const seen = new Set<string>()
  for (const entry of raw) {
    const tag = normalizeTag(entry)
    if (tag) seen.add(tag)
  }
  return [...seen].sort()
}
