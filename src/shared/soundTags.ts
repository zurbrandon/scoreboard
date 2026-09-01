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

// --- what we know about one song -------------------------------------------
//
// The tags file grew a second thing to remember: a start time, for a song that
// doesn't get going until a minute in. That made each entry a record rather
// than a bare list, so both shapes have to be readable — and, so far as it can
// be, writable, since a file this build saves shouldn't strand a build that
// predates start times.

export interface SoundMeta {
  tags: string[]
  /** Seconds into the file where the song should start. Absent means the top. */
  startAt?: number
}

/** A start time is only worth storing if it's a real, positive number: 0 IS the
 *  top of the file, so it's stored as "no start time" rather than as a value. */
function normalizeStartAt(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return undefined
  return raw
}

/** Read one entry, accepting either the bare tag list written before start
 *  times existed or the record written since. Returns null for an entry that
 *  holds nothing worth keeping. */
export function normalizeSoundMeta(raw: unknown): SoundMeta | null {
  if (Array.isArray(raw)) {
    const tags = normalizeTags(raw as unknown[])
    return tags.length > 0 ? { tags } : null
  }
  if (!raw || typeof raw !== 'object') return null
  const entry = raw as { tags?: unknown; startAt?: unknown }
  const tags = Array.isArray(entry.tags) ? normalizeTags(entry.tags as unknown[]) : []
  const startAt = normalizeStartAt(entry.startAt)
  if (tags.length === 0 && startAt === undefined) return null
  return startAt === undefined ? { tags } : { tags, startAt }
}

/** Write one entry, staying in the old bare-array form whenever there's no
 *  start time — so most of the file keeps the shape an older build can read,
 *  and only songs that actually carry an offset need the newer one. Returns
 *  null when the entry holds nothing, meaning: drop the key entirely. */
export function serializeSoundMeta(meta: SoundMeta): string[] | SoundMeta | null {
  const tags = normalizeTags(meta.tags)
  const startAt = normalizeStartAt(meta.startAt)
  if (startAt === undefined) return tags.length > 0 ? tags : null
  return { tags, startAt }
}
