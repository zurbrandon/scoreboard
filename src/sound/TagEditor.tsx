// Tagging the current selection, as a popover on the button that opens it.
//
// This used to be a bar pinned to the bottom of the window — far from the rows
// it acted on, and easy to miss entirely. A popover puts the tags under the
// hand that asked for them: open it, the tags you already have are right there,
// click to apply or remove, type to filter or to make a new one.

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { SoundTrackInfo } from '../shared/bridge'
import { normalizeTag } from '../shared/soundTags'
import { suggestTags, tagsForSelection } from './search'

export function TagEditor({
  selected,
  allTags,
  anchor,
  onClose,
}: {
  selected: SoundTrackInfo[]
  allTags: string[]
  /** Where the button that opened it sits, in viewport coordinates. */
  anchor: DOMRect
  onClose: () => void
}) {
  const [input, setInput] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const bridge = window.showboard
  const { all, some } = tagsForSelection(selected)
  const applied = new Set([...all, ...some])
  const suggestions = suggestTags(allTags, input)
  const typed = normalizeTag(input)
  // Offer to create only what doesn't exist — otherwise the popover shows "add
  // rap" above an existing "rap" row, which is two ways to do one thing.
  const isNew = typed !== null && !allTags.includes(typed)

  // Click-away and Escape close it, the way every other popover behaves.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const ids = selected.map((t) => t.id)

  function toggle(tag: string) {
    if (!bridge) return
    // A tag on only some of the selection applies to all of them first — the
    // useful move when you've selected a batch that's partly tagged already.
    if (all.includes(tag)) bridge.setSoundTags(ids, [], [tag])
    else bridge.setSoundTags(ids, [tag], [])
  }

  function create() {
    if (!typed || !bridge) return
    bridge.setSoundTags(ids, [typed], [])
    setInput('')
  }

  // Positioned against the viewport rather than the row, because the list it
  // sits in scrolls — an absolutely positioned popover would be clipped by it.
  // Opens upward when there isn't room below.
  const HEIGHT = 330
  const below = anchor.bottom + HEIGHT < window.innerHeight
  const style: CSSProperties = {
    position: 'fixed',
    left: Math.max(8, Math.min(anchor.left, window.innerWidth - 276)),
    ...(below ? { top: anchor.bottom + 6 } : { bottom: window.innerHeight - anchor.top + 6 }),
  }

  return (
    <div className="tagpop" ref={boxRef} style={style}>
      <div className="tagpop__head">
        Tagging {selected.length} song{selected.length === 1 ? '' : 's'}
      </div>
      <input
        className="tagpop__input"
        value={input}
        autoFocus
        placeholder="Filter or add a tag…"
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') create()
        }}
      />
      <div className="tagpop__list">
        {isNew && (
          <button className="tagpop__row tagpop__row--new" onClick={create}>
            <span className="tagpop__check">+</span>
            Create “{typed}”
          </button>
        )}
        {suggestions.map((tag) => {
          const onAll = all.includes(tag)
          const onSome = some.includes(tag)
          return (
            <button
              key={tag}
              className={`tagpop__row${applied.has(tag) ? ' tagpop__row--on' : ''}`}
              onClick={() => toggle(tag)}
              title={onAll ? 'On all selected — click to remove' : onSome ? 'On some — click to apply to all' : 'Click to apply'}
            >
              <span className="tagpop__check">{onAll ? '✓' : onSome ? '–' : ''}</span>
              {tag}
            </button>
          )
        })}
        {suggestions.length === 0 && !isNew && (
          <div className="tagpop__none">No tags yet — type one and press Enter.</div>
        )}
      </div>
    </div>
  )
}
