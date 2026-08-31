// Scores can be decimals (e.g. 3.5 — comedy judges do funny things). Display
// them cleanly: trim floating-point dust and show at most two decimals, with no
// trailing zeros. 4 -> "4", 3.5 -> "3.5", 5.500000001 -> "5.5".
export function formatScore(n: number): string {
  return String(Math.round(n * 100) / 100)
}

// A score is normally one or two digits, but at a show it can become a joke and
// run into the millions — and at the projector's fixed type size a seven-digit
// score runs clean off the LED face. So the readout steps down once the score is
// longer than the face holds: ONE size per character count, the same for every
// score of that length, rather than fitting continuously to the rendered width.
// That keeps a score of a given length rock-steady — a count-up from 10 to 99
// never wobbles — while an absurd score still lands inside its box.
//
// Concretely: hold full size while the score fits in `fitChars` characters, then
// shrink just enough to keep that same width. So every stepped size renders to
// an identical box width; only the digits get smaller.
export function scoreScale(text: string, fitChars: number): number {
  return Math.min(1, fitChars / text.length)
}

// How many characters each readout holds at full size. Each is measured against
// the box that readout actually gets on a 16:9 stage, and against Geist Pixel's
// WIDEST glyph — the digit "8", at 0.646em — so the step is right even for the
// worst-numbered score of that length and nothing can spill.
//
// (The face's digits are not equal-width: "0" is 0.570em and "1" is 0.494em. The
// font ships no tabular figures, so the tabular-nums on .team-panel__score has
// nothing to act on. Sizing to "8" is what makes the char count safe to use.)
//
//   Team panel  LED face 44.1cqw, base 15cqw -> 4 chars is 38.8cqw (88% of it),
//               and still inside the face at the winner pop's 1.09x.
//   Finale      takeover 100cqw, base 20cqw -> 6 chars is 77.5cqw.
//   Finale tie  the same box, but the line is two scores joined by " – ", and a
//               dash and two spaces (1.25em) are far narrower than three digits
//               (1.94em) — so the line affords one more character than a bare
//               score before it has to step down. A normal tie ("42 – 39") thus
//               stays full size, while "999 – 999" steps down as it must.
export const PANEL_FIT_CHARS = 4
export const FINALE_FIT_CHARS = 6
export const FINALE_TIE_FIT_CHARS = 7
