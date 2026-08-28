// The tagging tool. Deliberately not part of the show surface: you use it for an
// hour once while curating, and never during a show — so it's a mode you open on
// purpose from the header, and it takes the whole window when you do.

import { useMemo, useRef, useState } from 'react'
import { useDispatch } from '../store/react'
import type { SoundBank } from '../core/state'
import type { SoundTrackInfo } from '../shared/bridge'
import { filterTracks } from './search'
import { TagEditor } from './TagEditor'
import { makePads } from './pads'

export function LibraryManager({
  tracks,
  tags,
  folder,
  activeBank,
  onClose,
}: {
  tracks: SoundTrackInfo[]
  tags: string[]
  folder: string | null
  activeBank: SoundBank | null
  onClose: () => void
}) {
  const dispatch = useDispatch()
  const bridge = window.showboard
  const [query, setQuery] = useState('')
  const [pinned, setPinned] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // Which row's tag popover is open, and where its button is — the popover is
  // positioned against the viewport, since the list it lives in scrolls.
  const [tagging, setTagging] = useState<{ trackId: string; anchor: DOMRect } | null>(null)
  // Anchor for shift-click ranges — the row a range extends from.
  const anchor = useRef<number | null>(null)

  const visible = useMemo(() => filterTracks(tracks, query, pinned), [tracks, query, pinned])
  // Selection survives filtering, so you can tag, retype, and tag again — which
  // means the editor works from ids rather than from what's on screen.
  const selected = useMemo(() => tracks.filter((t) => selectedIds.has(t.id)), [tracks, selectedIds])

  function clearSelection() {
    setSelectedIds(new Set())
    setTagging(null)
    anchor.current = null
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
    <div className="library">
      <header className="sound__topbar">
        <h1>Library</h1>
        <input
          className="sound__search"
          value={query}
          autoFocus
          placeholder="Filter songs and tags…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('')
          }}
        />
        <span className="sound__status">
          {visible.length === tracks.length
            ? `${tracks.length} song${tracks.length === 1 ? '' : 's'}`
            : `${visible.length} of ${tracks.length}`}
          {folder && ` · ${folder.split('/').pop()}`}
        </span>
        <button className="pill" onClick={() => bridge?.chooseSoundFolder()}>
          Folder…
        </button>
        <button className="pill" onClick={onClose}>
          Done
        </button>
      </header>

      {tags.length > 0 && (
        <div className="sound__tagrail">
          {tags.map((tag) => (
            <button
              key={tag}
              className={`sound__tag sound__tag--pin${pinned.includes(tag) ? ' sound__tag--pinned' : ''}`}
              onClick={() =>
                setPinned((prev) =>
                  prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                )
              }
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

      {/* Clicking the empty space under the list clears the selection — the
          way it does in a file list, and the only way out now that the actions
          live on the rows rather than in a bar with a Clear button. */}
      <div
        className="library__list"
        onClick={(e) => {
          if (e.target === e.currentTarget) clearSelection()
        }}
      >
        {tracks.length === 0 ? (
          <p className="sound__empty">
            Choose a folder above. Subfolders are included, so you can point this at the
            folder that holds your existing music folders and get everything at once.
          </p>
        ) : visible.length === 0 ? (
          <p className="sound__empty">Nothing matches that.</p>
        ) : (
          <ul className="sound__list">
            {visible.map((track, index) => {
              // A row's buttons act on the whole selection when that row is part
              // of it, and on just that row otherwise — the way a file manager
              // behaves. So you can select four songs and tag them from any one.
              const targets = selectedIds.has(track.id) && selected.length > 0 ? selected : [track]
              return (
                <li
                  key={track.id}
                  className={`sound__row librow${selectedIds.has(track.id) ? ' sound__row--selected' : ''}`}
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
                  <span className="librow__name">{track.name}</span>
                  <span className="librow__tags">
                    {track.tags.map((tag) => (
                      <span key={tag} className="sound__tag">
                        {tag}
                      </span>
                    ))}
                  </span>
                  <span className="librow__spacer" />
                  <span className="librow__actions">
                    {activeBank && (
                      <button
                        className="librow__btn"
                        title={`Add to “${activeBank.name}”`}
                        onClick={(e) => {
                          e.stopPropagation()
                          dispatch({
                            type: 'soundPad.add',
                            bankId: activeBank.id,
                            pads: makePads(targets),
                          })
                        }}
                      >
                        + bank{targets.length > 1 ? ` (${targets.length})` : ''}
                      </button>
                    )}
                    <button
                      className="librow__btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        const anchor = e.currentTarget.getBoundingClientRect()
                        setTagging((open) =>
                          open?.trackId === track.id ? null : { trackId: track.id, anchor },
                        )
                      }}
                    >
                      Add tag{targets.length > 1 ? ` (${targets.length})` : ''}
                    </button>
                  </span>
                  {tagging?.trackId === track.id && (
                    <TagEditor
                      selected={targets}
                      allTags={tags}
                      anchor={tagging.anchor}
                      onClose={() => setTagging(null)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

    </div>
  )
}
