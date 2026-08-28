// Points each automatic music moment at a tag instead of a folder. The song is
// drawn at random from whatever carries that tag, so putting a song into a
// behavior becomes a matter of tagging it in the soundboard window.
//
// A slot left unset — or set to a tag nothing carries yet — keeps using the
// folder it used before, which is what lets a half-tagged library run a show.

import { useAppState, useDispatch } from '../store/react'
import { SOUND_SLOTS } from '../core/state'
import { useSoundLibrary } from '../sound/useSoundLibrary'

export function SoundSlotsPanel() {
  const dispatch = useDispatch()
  const slots = useAppState((s) => s.soundSlots)
  const { tracks, tags } = useSoundLibrary()
  if (!window.showboard) return null // Electron-only: the library lives in main

  return (
    <div className="extra music-panel">
      {SOUND_SLOTS.map(({ id, label, hint }) => {
        const tag = slots[id]
        const count = tag ? tracks.filter((t) => t.tags.includes(tag)).length : 0
        return (
          <div className="music-panel__row" key={id}>
            <label className="extra__label" htmlFor={`slot-${id}`}>
              {label}
            </label>
            <select
              id={`slot-${id}`}
              value={tag ?? ''}
              onChange={(e) =>
                dispatch({ type: 'soundSlot.set', slot: id, tag: e.target.value || null })
              }
            >
              <option value="">Use folder (no tag)</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="music-panel__status">
              {/* A tag that's set but empty is worth saying out loud: it looks
                  configured while actually still falling back to the folder. */}
              {!tag
                ? hint
                : count === 0
                  ? 'no songs tagged yet — still using the folder'
                  : `${count} song${count === 1 ? '' : 's'}`}
            </span>
          </div>
        )
      })}
    </div>
  )
}
