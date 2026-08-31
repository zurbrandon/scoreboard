// The back of a pad. Everything you'd want to change about a button, in the
// space the button already occupies — so editing the board never means leaving
// it, and the pad you're editing stays where it sits among its neighbours.
//
// Deliberately not a modal: mid-show you want to fix a label and get out, and a
// dialog that covers the board is the wrong shape for that.

import { useEffect, useRef, useState } from 'react'
import { MdCheck, MdDeleteOutline } from 'react-icons/md'
import type { SoundBank, SoundPad, SoundPadMode } from '../core/state'

export function PadEditor({
  pad,
  bank,
  banks,
  /** How many songs currently carry this pad's tag; 0 for a track pad. */
  taggedCount,
  /** The song a track pad points at, for the "what is this actually" line. */
  trackName,
  onRename,
  onSetMode,
  onMoveToBank,
  onRemove,
  onClose,
}: {
  pad: SoundPad
  bank: SoundBank
  banks: SoundBank[]
  taggedCount: number
  trackName: string | null
  onRename: (label: string) => void
  onSetMode: (mode: SoundPadMode) => void
  onMoveToBank: (bankId: string) => void
  onRemove: () => void
  onClose: () => void
}) {
  const [label, setLabel] = useState(pad.label)
  const nameRef = useRef<HTMLInputElement>(null)

  // Land in the name field with the text selected: renaming is far and away the
  // most common reason to open this, so it should take one keystroke.
  useEffect(() => {
    nameRef.current?.select()
  }, [])

  // Commit on the way out rather than per-keystroke, so a half-typed name never
  // reaches the board — and never an empty one, which would leave a blank button.
  function commit() {
    const next = label.trim()
    if (next && next !== pad.label) onRename(next)
  }

  function close() {
    commit()
    onClose()
  }

  return (
    <div
      className="pad-edit"
      // The face sits on a pad, and a pad plays a song when clicked. Every stray
      // click that lands here must stop before it reaches that handler.
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation() // Escape belongs to this card, not to the search panel
          onClose() // discard: Escape shouldn't be a way to rename by accident
        }
        if (e.key === 'Enter') close()
      }}
    >
      <input
        ref={nameRef}
        className="pad-edit__name"
        value={label}
        aria-label="Pad name"
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commit}
      />

      {/* What the button actually plays. The label is a show cue — "SHOOT OUT" —
          so after a week nothing on the face says where the sound comes from. */}
      <p className="pad-edit__source" title={pad.kind === 'tag' ? pad.tag : (trackName ?? '')}>
        {pad.kind === 'tag'
          ? `#${pad.tag} · ${taggedCount} song${taggedCount === 1 ? '' : 's'}`
          : (trackName ?? 'file missing')}
      </p>

      {pad.kind === 'tag' && (
        <div className="pad-edit__modes" role="group" aria-label="How this pad picks">
          {(['random', 'continuous'] as const).map((mode) => (
            <button
              key={mode}
              className={`pad-edit__mode${pad.mode === mode ? ' pad-edit__mode--on' : ''}`}
              aria-pressed={pad.mode === mode}
              onClick={() => onSetMode(mode)}
              title={
                mode === 'random'
                  ? 'Plays one song from the tag, then stops'
                  : 'Keeps playing through the tag — house music'
              }
            >
              {mode === 'random' ? 'One song' : 'Keeps playing'}
            </button>
          ))}
        </div>
      )}

      {/* Dragging a pad to another tab already works, but only to a tab you can
          see. With eight banks this is the one that always works. Its own row:
          bank names are long, and squeezed next to the buttons it read as "In…". */}
      {banks.length > 1 && (
        <select
          className="pad-edit__bank"
          value={bank.id}
          aria-label="Move to bank"
          onChange={(e) => onMoveToBank(e.target.value)}
        >
          {banks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.id === bank.id ? `In ${b.name}` : `Move to ${b.name}`}
            </option>
          ))}
        </select>
      )}

      <div className="pad-edit__row">
        <button className="pad-edit__remove" onClick={onRemove} title="Take this pad off the board">
          <MdDeleteOutline /> Remove
        </button>
        <button className="pad-edit__done" onClick={close} title="Done (Enter)">
          <MdCheck />
        </button>
      </div>
    </div>
  )
}
