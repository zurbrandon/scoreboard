// Timecodes, in the one form the app shows them: m:ss.
//
// Both directions live here because they have to agree — the start-time field
// shows what format() produced and hands it back to parse(), so a round trip
// that didn't land on the same number would quietly move a cue every time you
// opened the field and closed it again.

/** Seconds -> "1:07". Anything not a usable number reads as "0:00" rather than
 *  NaN, since this ends up on screen during playback. */
export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const whole = Math.floor(seconds)
  const m = Math.floor(whole / 60)
  const s = whole % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * "1:07" -> 67, and deliberately forgiving about how it's typed, because this
 * is a field you edit mid-show with one hand:
 *   "1:07" / "1:7" / "67" all mean the same thing, and stray spaces are fine.
 * Returns null for anything that isn't a time, so a half-typed value never
 * becomes a real offset.
 */
export function parseTimecode(raw: string): number | null {
  const text = raw.trim()
  if (text === '') return null

  // Bare seconds: "67", or "1.5" for a sub-second nudge.
  if (/^\d+(\.\d+)?$/.test(text)) {
    const n = Number(text)
    return Number.isFinite(n) ? n : null
  }

  const m = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(text)
  if (!m) return null
  const mins = Number(m[1])
  const secs = Number(m[2])
  if (!Number.isFinite(mins) || !Number.isFinite(secs)) return null
  // "1:70" is 130s rather than an error: it's an obvious intent, and rejecting
  // it would only make you do the arithmetic the computer just did.
  return mins * 60 + secs
}
