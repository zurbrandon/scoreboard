// The bulk-tagging bar. It only exists while something is selected, because
// tagging is the one thing this window does that changes stored data — it should
// be visibly a mode you entered, not a control sitting armed all the time.

import { useState } from 'react'
import type { SoundTrackInfo } from '../shared/bridge'
import { normalizeTag } from '../shared/soundTags'
import { suggestTags, tagsForSelection } from './search'

export function TagEditor({
  selected,
  allTags,
  onClear,
}: {
  selected: SoundTrackInfo[]
  allTags: string[]
  onClear: () => void
}) {
  const [input, setInput] = useState('')
  const bridge = window.showboard
  const { all, some } = tagsForSelection(selected)
  const suggestions = suggestTags(allTags, input, all)

  function apply(raw: string) {
    const tag = normalizeTag(raw)
    if (!tag || !bridge) return
    bridge.setSoundTags(selected.map((t) => t.id), [tag], [])
    setInput('')
  }

  function remove(tag: string) {
    bridge?.setSoundTags(selected.map((t) => t.id), [], [tag])
  }

  return (
    <div className="tag-editor">
      <div className="tag-editor__row">
        <span className="tag-editor__count">
          {selected.length} selected
        </span>
        <input
          className="tag-editor__input"
          value={input}
          placeholder="Add a tag…"
          list="sound-tag-suggestions"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply(input)
            if (e.key === 'Escape') setInput('')
          }}
        />
        <datalist id="sound-tag-suggestions">
          {suggestions.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
        <button className="pill" disabled={normalizeTag(input) === null} onClick={() => apply(input)}>
          Add tag
        </button>
        <button className="pill" onClick={onClear}>
          Clear selection
        </button>
      </div>

      {(all.length > 0 || some.length > 0) && (
        <div className="tag-editor__row tag-editor__row--tags">
          {all.map((tag) => (
            <button key={tag} className="sound__tag sound__tag--removable" onClick={() => remove(tag)}>
              {tag} ✕
            </button>
          ))}
          {/* Partial tags read as partial: removing one shouldn't quietly imply
              it was on everything selected. */}
          {some.map((tag) => (
            <button
              key={tag}
              className="sound__tag sound__tag--partial"
              title="On some of the selected songs"
              onClick={() => remove(tag)}
            >
              {tag} ✕
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
