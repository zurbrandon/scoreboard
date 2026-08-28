// The search drop-down. One list either way — tag shortcuts before you type,
// songs after — so the keyboard walks it without caring which it's showing.
// The highlighted row is what Enter acts on: a tag narrows the search, a song
// plays. The whole point is type, down, down, Enter, without looking.

import { useEffect, useRef } from 'react'
import type { SoundBank } from '../core/state'
import type { SearchItem } from './search'
import { DRAG_TYPE } from './BankPanel'

export function SearchResults({
  items,
  query,
  activeIndex,
  activeBank,
  onActivate,
  onHover,
  onAddToBank,
}: {
  items: SearchItem[]
  query: string
  activeIndex: number
  activeBank: SoundBank | null
  onActivate: (item: SearchItem) => void
  onHover: (index: number) => void
  onAddToBank: (trackId: string) => void
}) {
  const activeRef = useRef<HTMLLIElement>(null)
  const typed = query.trim().length > 0

  // Keep the highlighted row in view when arrowing past the fold. 'nearest'
  // scrolls the least it can, so the list doesn't jump under the eye.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (items.length === 0) {
    return (
      <div className="results">
        <div className="results__empty">
          <div className="results__empty-title">
            {typed ? `No songs match “${query.trim()}”` : 'No songs in the library yet'}
          </div>
          <div className="results__empty-hint">
            {typed
              ? 'Search matches song names and tags. Check the spelling, or try a shorter word.'
              : 'Open Library and choose the folder your music lives in.'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="results">
      <div className="results__target">
        {typed
          ? `${items.length} found${activeBank ? ` · + adds to “${activeBank.name}”` : ' · make a bank to add pads'}`
          : 'Jump to a tag — or keep typing to search song names'}
      </div>
      <ul className="sound__list">
        {items.map((item, index) => {
          const active = index === activeIndex
          const key = item.kind === 'tag' ? `tag:${item.tag}` : item.track.id
          return (
            <li
              key={key}
              ref={active ? activeRef : null}
              className={`sound__row results__row${active ? ' results__row--active' : ''}`}
              onMouseMove={() => onHover(index)}
              onClick={() => onActivate(item)}
              draggable={item.kind === 'track'}
              onDragStart={(e) => {
                if (item.kind !== 'track') return
                e.dataTransfer.setData(DRAG_TYPE, JSON.stringify([item.track.id]))
                e.dataTransfer.effectAllowed = 'copy'
              }}
            >
              {item.kind === 'tag' ? (
                <>
                  <span className="results__kind">tag</span>
                  <span className="sound__name">{item.tag}</span>
                  <span className="sound__status">
                    {item.count} song{item.count === 1 ? '' : 's'}
                  </span>
                </>
              ) : (
                <>
                  <span className="sound__name">{item.track.name}</span>
                  <span className="sound__tags">
                    {item.track.tags.map((tag) => (
                      <span key={tag} className="sound__tag">
                        {tag}
                      </span>
                    ))}
                  </span>
                  <button
                    className="sound__play"
                    title={activeBank ? `Add to “${activeBank.name}”` : 'Make a bank first'}
                    disabled={!activeBank}
                    onClick={(e) => {
                      e.stopPropagation() // adding is not playing
                      onAddToBank(item.track.id)
                    }}
                  >
                    +
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
