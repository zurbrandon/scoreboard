// Search results: a row of tag filters, then the songs.
//
// Tags are a FILTER, not a destination. They sit as pills across the top the way
// facets do on a shop: tap one to narrow, X it to widen again, tap two to narrow
// twice (they AND together). That means this surface has one mode instead of two
// — the grid is always songs — and the pills that narrow are the same pills you
// clear, so there's nothing to learn twice.
//
// The board is a grid of chunky pads, so results are pads too: same shape, same
// tap. A pad here does exactly one thing, which is what keeps it a single
// control — a song plays. Putting one on a bank is a DRAG onto that bank's tab,
// because the target changes with every drop, which is what a drag is for and
// what a + button is bad at. Tag pills drag too: dropping one makes a pad that
// plays from that tag.

import { useEffect, useRef } from 'react'
import { MdClose, MdLocalOffer } from 'react-icons/md'
import type { SoundTrackInfo } from '../shared/bridge'
import { DRAG_TYPE, TAG_DRAG_TYPE } from './drops'

export function SearchGrid({
  songs,
  tags,
  pinned,
  query,
  activeIndex,
  onPlay,
  onTogglePin,
  onHover,
}: {
  /** Already filtered by query + pinned tags. */
  songs: SoundTrackInfo[]
  /** Every tag worth offering, with how many songs it currently covers. */
  tags: { tag: string; count: number }[]
  pinned: string[]
  query: string
  activeIndex: number
  onPlay: (track: SoundTrackInfo) => void
  onTogglePin: (tag: string) => void
  onHover: (index: number) => void
}) {
  const activeRef = useRef<HTMLButtonElement>(null)
  const narrowed = query.trim().length > 0 || pinned.length > 0

  // Keep the highlighted pad in view when arrowing past the fold.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <div className="searchgrid">
      {tags.length > 0 && (
        <div className="searchgrid__tags">
          {tags.map(({ tag, count }) => {
            const on = pinned.includes(tag)
            return (
              <button
                key={tag}
                className={`tagpill${on ? ' tagpill--on' : ''}`}
                title={on ? `Stop narrowing by “${tag}”` : `Narrow to “${tag}” — or drag onto a tab`}
                onClick={() => onTogglePin(tag)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(TAG_DRAG_TYPE, tag)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
              >
                <MdLocalOffer className="tagpill__icon" />
                <span className="tagpill__name">{tag}</span>
                {on ? (
                  <MdClose className="tagpill__x" />
                ) : (
                  <span className="tagpill__count">{count}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="searchgrid__hint">
        {songs.length === 0
          ? narrowed
            ? `Nothing matches${query.trim() ? ` “${query.trim()}”` : ''}`
            : 'No songs in the library yet — open Library and pick your music folder'
          : `${songs.length} song${songs.length === 1 ? '' : 's'} · tap to play, drag onto a tab to keep`}
      </div>

      <div className="searchgrid__pads">
        {songs.map((track, index) => (
          <button
            key={track.id}
            ref={index === activeIndex ? activeRef : null}
            className={`pad pad--result${index === activeIndex ? ' pad--cued' : ''}`}
            title={`Play “${track.name}”`}
            onMouseMove={() => onHover(index)}
            onClick={() => onPlay(track)}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_TYPE, JSON.stringify([track.id]))
              e.dataTransfer.effectAllowed = 'copy'
            }}
          >
            <span className="pad__label">{track.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
