// The soundboard window: find a song by typing, tag it, hear it. Pads land here
// in M4 — this milestone is the library half.
//
// This window never plays audio itself. It dispatches a cue and the operator
// window's audio controller does the playing, which is what guarantees exactly
// one song at a time and lets this window be moved or closed mid-show without
// cutting the music.

import { useMemo, useRef, useState } from 'react'
import { useDispatch } from '../store/react'
import { useSoundLibrary } from './useSoundLibrary'
import { filterTracks } from './search'
import { TagEditor } from './TagEditor'

export function SoundApp() {
  const { tracks, tags } = useSoundLibrary()
  const dispatch = useDispatch()
  const bridge = window.showboard

  const [query, setQuery] = useState('')
  const [pinned, setPinned] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // Anchor for shift-click ranges — the row a range extends from.
  const anchor = useRef<number | null>(null)

  const visible = useMemo(() => filterTracks(tracks, query, pinned), [tracks, query, pinned])
  // Selection survives filtering (you can tag, retype, and tag again), so the
  // editor works from ids rather than from what's currently on screen.
  const selected = useMemo(() => tracks.filter((t) => selectedIds.has(t.id)), [tracks, selectedIds])

  function togglePinned(tag: string) {
    setPinned((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  function selectRow(index: number, event: React.MouseEvent) {
    const track = visible[index]
    if (!track) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (event.shiftKey && anchor.current !== null) {
        const [from, to] = [anchor.current, index].sort((a, b) => a - b)
        for (let i = from; i <= to; i++) next.add(visible[i].id)
      } else if (event.metaKey || event.ctrlKey) {
        if (next.has(track.id)) next.delete(track.id)
        else next.add(track.id)
        anchor.current = index
      } else {
        next.clear()
        next.add(track.id)
        anchor.current = index
      }
      return next
    })
  }

  return (
    <div className="sound">
      <header className="sound__topbar">
        <h1>Sound</h1>
        <input
          className="sound__search"
          value={query}
          autoFocus
          placeholder="Search songs and tags…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('')
          }}
        />
        <button className="pill" onClick={() => dispatch({ type: 'sound.stop' })}>
          Stop
        </button>
        <span className="sound__status">
          {visible.length === tracks.length
            ? `${tracks.length} song${tracks.length === 1 ? '' : 's'}`
            : `${visible.length} of ${tracks.length}`}
        </span>
        <button className="pill" onClick={() => bridge?.chooseSoundFolder()}>
          Folder…
        </button>
      </header>

      {tags.length > 0 && (
        <div className="sound__tagrail">
          {tags.map((tag) => (
            <button
              key={tag}
              className={`sound__tag sound__tag--pin${pinned.includes(tag) ? ' sound__tag--pinned' : ''}`}
              onClick={() => togglePinned(tag)}
            >
              {tag}
            </button>
          ))}
          {pinned.length > 0 && (
            <button className="sound__tag sound__tag--clear" onClick={() => setPinned([])}>
              clear filters
            </button>
          )}
        </div>
      )}

      <div className="sound__body">
        {tracks.length === 0 ? (
          <p className="sound__empty">
            Choose a folder above. Subfolders are included, so you can point this at the
            folder that holds your existing music folders and get everything at once.
          </p>
        ) : visible.length === 0 ? (
          <p className="sound__empty">Nothing matches that.</p>
        ) : (
          <ul className="sound__list">
            {visible.map((track, index) => (
              <li
                key={track.id}
                className={`sound__row${selectedIds.has(track.id) ? ' sound__row--selected' : ''}`}
                onClick={(e) => selectRow(index, e)}
                onDoubleClick={() => dispatch({ type: 'sound.play', id: track.id })}
              >
                <button
                  className="sound__play"
                  title="Play"
                  onClick={(e) => {
                    e.stopPropagation() // auditioning shouldn't change the selection
                    dispatch({ type: 'sound.play', id: track.id })
                  }}
                >
                  ▶
                </button>
                <span className="sound__name">{track.name}</span>
                <span className="sound__tags">
                  {track.tags.map((tag) => (
                    <span key={tag} className="sound__tag">
                      {tag}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected.length > 0 && (
        <TagEditor
          selected={selected}
          allTags={tags}
          onClear={() => {
            setSelectedIds(new Set())
            anchor.current = null
          }}
        />
      )}
    </div>
  )
}
