// Parsing an HTTP Range header. Lives here, apart from the Electron protocol
// handler, because the arithmetic is where an off-by-one hides: ranges are
// inclusive at both ends, so a wrong `end` truncates or overruns the file and
// the symptom is a song that stutters or won't seek — not an obvious error.

export interface ByteRange {
  start: number
  end: number // inclusive
}

/** Returns the requested range, or null if the header is malformed or asks for
 *  something outside the file (the caller answers 416). Handles the three forms
 *  a media element actually sends: "bytes=500-", "bytes=500-999", "bytes=-500"
 *  (the last N bytes). */
export function parseByteRange(header: string | null, size: number): ByteRange | null {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null
  const [, rawStart, rawEnd] = match
  if (rawStart === '' && rawEnd === '') return null

  let start: number
  let end: number
  if (rawStart === '') {
    // Suffix form: the last N bytes. More than the whole file means the whole file.
    const wanted = Number(rawEnd)
    if (!Number.isFinite(wanted) || wanted <= 0) return null
    start = Math.max(0, size - wanted)
    end = size - 1
  } else {
    start = Number(rawStart)
    end = rawEnd === '' ? size - 1 : Number(rawEnd)
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null
    // A range may ask past the end; it's clamped, not rejected.
    end = Math.min(end, size - 1)
  }

  if (start < 0 || start >= size || start > end) return null
  return { start, end }
}
