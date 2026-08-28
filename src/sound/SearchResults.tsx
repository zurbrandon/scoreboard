// The search drop-down. Open it, and before you type it offers the tags that
// actually carry songs — the handful you reach for, not the whole tag list.
// Type, and it becomes results.
//
// A result plays on click, because during a show "find it and play it" is one
// gesture, not two. The + puts it on the current bank for later, and rows stay
// draggable onto a specific pad area.

import type { SoundBank } from '../core/state'
import type { SoundTrackInfo } from '../shared/bridge'
import { filterTracks, topTags } from './search'
import { DRAG_TYPE } from './BankPanel'

export function SearchResults({
  tracks,
  query,
  activeBank,
  onPickTag,
  onPlay,
  onAddToBank,
}: {
  tracks: SoundTrackInfo[]
  query: string
  activeBank: SoundBank | null
  onPickTag: (tag: string) => void
  onPlay: (track: SoundTrackInfo) => void
  onAddToBank: (track: SoundTrackInfo) => void
}) {
  const typed = query.trim().length > 0
  const results = typed ? filterTracks(tracks, query) : []
  const shortcuts = topTags(tracks)

  return (
    <div className="results">
      {!typed ? (
        shortcuts.length === 0 ? (
          <p className="sound__empty">
            Type to search by song name. Once songs are tagged, your most-used tags show up
            here as shortcuts.
          </p>
        ) : (
          <div className="results__shortcuts">
            {shortcuts.map(({ tag, count }) => (
              <button key={tag} className="sound__tag sound__tag--pin" onClick={() => onPickTag(tag)}>
                {tag} <span className="banks__count">{count}</span>
              </button>
            ))}
          </div>
        )
      ) : results.length === 0 ? (
        <p className="sound__empty">Nothing matches that.</p>
      ) : (
        <>
          {/* The panel covers the bank tabs, so it has to say where + lands —
              otherwise you're adding to a bank you can't see. */}
          <div className="results__target">
            {results.length} found
            {activeBank ? ` · + adds to “${activeBank.name}”` : ' · make a bank to add pads'}
          </div>
          <ul className="sound__list">
            {results.map((track) => (
              <li
                key={track.id}
                className="sound__row"
                onClick={() => onPlay(track)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_TYPE, JSON.stringify([track.id]))
                  e.dataTransfer.effectAllowed = 'copy'
                }}
              >
                <span className="sound__name">{track.name}</span>
                <span className="sound__tags">
                  {track.tags.map((tag) => (
                    <span key={tag} className="sound__tag">
                      {tag}
                    </span>
                  ))}
                </span>
                <button
                  className="sound__play"
                  title={activeBank ? `Add to "${activeBank.name}"` : 'Make a bank first'}
                  disabled={!activeBank}
                  onClick={(e) => {
                    e.stopPropagation() // adding is not playing
                    onAddToBank(track)
                  }}
                >
                  +
                </button>
              </li>
              ))}
          </ul>
        </>
      )}
    </div>
  )
}
