// Emoji on the projector are drawn as canvas text, and canvas does NOT
// participate in CSS font loading: `ctx.font` with a webfont that hasn't been
// loaded yet silently falls back to whatever the OS has, with no error and no
// second chance — the burst is already on screen. So any surface about to draw
// emoji has to ask for the glyphs it needs ahead of time.
//
// Our Noto Color Emoji is split by unicode-range (see styles.css), so there's no
// single "the font is ready" moment either: each chunk loads only when something
// asks for a character inside its range. document.fonts.load() with the actual
// glyphs is what pulls the right chunks in.

/** Noto first so it beats the OS sets on both platforms; the system faces stay
 *  as a fallback for anything Noto's build happens to miss. */
export const EMOJI_FONT_STACK =
  '"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif'

/** Warm the chunks covering `glyphs`. Fire-and-forget: the files are local to
 *  the bundle, so this resolves in milliseconds, and callers warm on prop change
 *  rather than at fire time so the font is already resident when a cue lands. */
export function warmEmojiGlyphs(glyphs: string) {
  const text = glyphs.trim()
  if (!text || typeof document === 'undefined' || !document.fonts) return
  // The size in the query is irrelevant to which file loads, but the shorthand
  // is only valid with one.
  document.fonts.load(`100px "Noto Color Emoji"`, text).catch(() => {
    // A glyph this build has no coverage for is not an error worth surfacing —
    // the stack falls through to the system face, which is what used to happen
    // for every glyph.
  })
}
