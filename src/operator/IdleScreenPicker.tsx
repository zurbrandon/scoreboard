// Settings → Visuals: what the projector shows when nothing's on — the Blank /
// black scene. Black (default), or one of the deck's logo slides shown on black
// (its logo + website), for venues that want a branded holding screen.

import { useAppState, useDispatch } from '../store/react'

export function IdleScreenPicker() {
  const dispatch = useDispatch()
  const current = useAppState((s) => s.idleLogoSlideId)
  // Any logo slide (from either deck) is a valid holding screen. Show its name.
  const logoSlides = useAppState((s) => s.slides.items).filter((sl) => sl.type === 'logo')
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
          onChange={(e) => dispatch({ type: 'idle.set', slideId: e.target.value || null })}
        >
          <option value="">Black (nothing)</option>
          {logoSlides.map((sl) => (
            <option key={sl.id} value={sl.id}>
              {sl.type === 'logo' ? sl.name || 'Logo' : ''}
            </option>
          ))}
        </select>
      </div>
      <span className="music-panel__status">
        Choose a logo slide to hold on screen when the projector is blanked, or keep it black.
      </span>
    </>
  )
}
