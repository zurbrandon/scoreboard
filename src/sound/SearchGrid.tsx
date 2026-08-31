// Search results, drawn as pads.
//
// The board is a grid of chunky buttons and search used to be a list of thin
// rows sitting on top of it — two interaction models in one window, and the one
// you reach for mid-show was the smaller-targeted one. So results are pads too:
// same shape, same size, same tap.
//
// A pad here does exactly one thing, which is what lets it stay a single
// control: a song plays, a tag narrows. Putting a song on a bank is a DRAG onto
// that bank's tab — the target changes with every drop, which is precisely what
// a drag is for and what a + button is bad at. Setting a tag pad's mode isn't
// here at all; it happens on the pad once it's landed, on its back face.

import { useEffect, useRef } from 'react'
import { MdLocalOffer } from 'react-icons/md'
import type { SearchItem } from './search'
import { DRAG_TYPE, TAG_DRAG_TYPE } from './BankPanel'

export function SearchGrid({
  items,
  query,
  pinned,
  activeIndex,
  onActivate,
  onHover,
  onUnpin,
}: {
  items: SearchItem[]
  query: string
  pinned: string[]
  activeIndex: number
  onActivate: (item: SearchItem) => void
  onHover: (index: number) => void
  onUnpin: (tag: string) => void
}) {
  const activeRef = useRef<HTMLButtonElement>(null)
  const narrowed = query.trim().length > 0 || pinned.length > 0

  // Keep the highlighted pad in view when arrowing past the fold.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <div className="searchgrid">
      {pinned.length > 0 && (
        <div className="searchgrid__pins">
          {pinned.map((tag) => (
            <button
              key={tag}
              className="searchgrid__pin"
              title={`Stop narrowing by “${tag}”`}
              onClick={() => onUnpin(tag)}
            >
              <MdLocalOffer />
              {tag}
              <span className="searchgrid__pin-x" aria-hidden="true">
                ✕
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="searchgrid__hint">
        {items.length === 0
          ? narrowed
            ? `Nothing matches${query.trim() ? ` “${query.trim()}”` : ''}`
            : 'No songs in the library yet — open Library and pick your music folder'
          : narrowed
            ? `${items.length} song${items.length === 1 ? '' : 's'} · tap to play, drag onto a tab to keep`
            : 'Tap a tag to narrow, or drag one onto a tab to make a pad'}
      </div>

      <div className="searchgrid__pads">
        {items.map((item, index) => {
          const active = index === activeIndex
          const isTag = item.kind === 'tag'
          const label = isTag ? item.tag : item.track.name
          return (
            <button
              key={isTag ? `tag:${item.tag}` : item.track.id}
              ref={active ? activeRef : null}
              className={`pad pad--result${isTag ? ' pad--tag' : ''}${active ? ' pad--cued' : ''}`}
              title={isTag ? `Narrow to “${item.tag}”` : `Play “${item.track.name}”`}
              onMouseMove={() => onHover(index)}
              onClick={() => onActivate(item)}
              draggable
              onDragStart={(e) => {
                // Two payload types so a bank tab can tell "add these songs"
                // from "make a pad that plays from this tag" without reading the
                // data, which dragover isn't allowed to do.
                if (isTag) e.dataTransfer.setData(TAG_DRAG_TYPE, item.tag)
                else e.dataTransfer.setData(DRAG_TYPE, JSON.stringify([item.track.id]))
                e.dataTransfer.effectAllowed = 'copy'
              }}
            >
              {isTag && (
                <span className="pad__badge" title="Plays from a tag">
                  <MdLocalOffer />
                </span>
              )}
              <span className="pad__label">{label}</span>
              {isTag && (
                <span className="pad__count">
                  {item.count} song{item.count === 1 ? '' : 's'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
