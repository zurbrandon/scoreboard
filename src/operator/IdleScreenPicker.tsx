// Settings → Visuals: what the projector shows when nothing's on — the Blank /
// black scene. Black (default), or a logo held on black for a branded holding
// screen. Options are the scoreboard corner logos (always available) plus any
// logo slides in the decks — deduped by image, so you always have something to
// pick even when the show template carries no standalone logo slide.

import { useAppState, useDispatch } from '../store/react'
import { LOGO_LIBRARY } from '../core/logos'

// A friendly name for a bundled logo src ('logos/comedysportz.png' → 'ComedySportz').
function bundledName(src: string): string | null {
  const hit = LOGO_LIBRARY.find((l) => src === `logos/${l.file}`)
  return hit ? hit.name : null
}

export function IdleScreenPicker() {
  const dispatch = useDispatch()
  const current = useAppState((s) => s.idleLogoSrc)
  const scoreboardLogos = useAppState((s) => s.scoreboardLogos)
  const logoSlides = useAppState((s) => s.slides.items).filter((sl) => sl.type === 'logo')

  // Build the option list, deduped by src so a logo used in two places shows once.
  const options: { label: string; src: string }[] = []
  const seen = new Set<string>()
  const add = (label: string, src: string) => {
    if (src && !seen.has(src)) {
      seen.add(src)
      options.push({ label, src })
    }
  }
  // Deck logo slides first — they carry a website, so they win the src-dedup and
  // the projector can show the URL under the logo (same as the showboard slide).
  for (const sl of logoSlides) if (sl.type === 'logo') add(sl.name || 'Logo', sl.src)
  add(bundledName(scoreboardLogos.left) ?? 'Top-left logo', scoreboardLogos.left)
  add(bundledName(scoreboardLogos.right) ?? 'Top-right logo', scoreboardLogos.right)

  return (
    <>
      <div className="music-panel__row">
        <label className="extra__label" htmlFor="idle-logo">
          On blank
        </label>
        <select
          id="idle-logo"
          className="nextsong__select"
          value={current ?? ''}
          onChange={(e) => dispatch({ type: 'idle.set', src: e.target.value || null })}
        >
          <option value="">Black (nothing)</option>
          {options.map((o) => (
            <option key={o.src} value={o.src}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <span className="music-panel__status">
        Choose a logo to hold on screen when the projector is blanked, or keep it black.
      </span>
    </>
  )
}
