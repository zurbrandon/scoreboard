// Hex colors, and whether text on one should be dark.
//
// Both live here because they're two halves of one job: the operator accepts a
// color typed by hand, and the projector has to put readable words on it. A
// slide that took "#fff" and then painted white text on it would be a slide
// nobody can read, so the check that a color is usable and the check for which
// ink it needs are kept together.

/**
 * Normalize a hand-typed hex color to "#rrggbb", or null if it isn't one.
 *
 * Forgiving about the ways people actually type a hex: with or without the #,
 * three digits or six, any casing, stray spaces. Strict about everything else,
 * so a half-typed value never reaches the slide.
 */
export function normalizeHexColor(raw: string): string | null {
  const text = raw.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(text)) {
    // #abc is shorthand for #aabbcc — expanded on the way in so everything
    // downstream only ever sees one form.
    const [r, g, b] = text.toLowerCase()
    return `#${r}${r}${g}${g}${b}${b}`
  }
  if (/^[0-9a-fA-F]{6}$/.test(text)) return `#${text.toLowerCase()}`
  return null
}

/**
 * Is this color light enough that white text would disappear on it?
 *
 * Uses the WCAG relative-luminance weights rather than a plain average, because
 * green reads far brighter than blue at the same value — a naive average calls
 * #0000ff light and #00ff00 dark, which is backwards for this purpose.
 * Anything that isn't a color answers false: dark text on an unknown background
 * is the worse failure, so the default stays white-on-dark.
 */
export function isLightColor(hex: string): boolean {
  const norm = normalizeHexColor(hex)
  if (!norm) return false
  const channel = (pair: string) => {
    const v = parseInt(pair, 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  const lum =
    0.2126 * channel(norm.slice(1, 3)) +
    0.7152 * channel(norm.slice(3, 5)) +
    0.0722 * channel(norm.slice(5, 7))
  // 0.4 rather than 0.5: white text starts failing on a mid-tone well before
  // that mid-tone is "light", and a stage is dimmer than a desk monitor.
  return lum > 0.4
}
