// The soundboard's preset control — the sound window's answer to the Show tab's
// TemplatePicker, and deliberately the same object: same dropdown, same "you're
// on X" dot, same Update / Rename / Delete per row. Someone who has used one has
// used the other. It reuses the .tpl__* styles for exactly that reason.
//
// A preset here is the whole set of tabs, not one tab, because that's the unit
// people mean by "my setup".

import { useEffect, useRef, useState } from 'react'
import { useAppState, useDispatch } from '../store/react'
import type { SavedBoard, SoundBank } from '../core/state'
import type { SoundTrackInfo } from '../shared/bridge'
import { newId } from '../shared/ids'
import { boardSignature, captureBoard, relinkPads } from './boards'

export function BoardPicker({ tracks }: { tracks: SoundTrackInfo[] }) {
  const dispatch = useDispatch()
  const banks = useAppState((s) => s.soundBanks)
  const savedBoards = useAppState((s) => s.savedBoards)
  const activeId = useAppState((s) => s.activeBoard)

  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [confirmUpdateId, setConfirmUpdateId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  const activeBoard = savedBoards.find((b) => b.id === activeId) ?? null
  const dirty = activeBoard ? boardSignature(banks) !== boardSignature(activeBoard.banks) : false
  const padCount = banks.reduce((n, b) => n + b.pads.length, 0)

  // Loading throws away every tab. That's fine when the board is already saved,
  // and an afternoon's work when it isn't — so ask, but only when there's
  // actually something unsaved to lose.
  function confirmDiscard(): boolean {
    if (padCount === 0) return true
    if (activeBoard && !dirty) return true
    return window.confirm(
      activeBoard
        ? `Replace the board? Your changes to “${activeBoard.name}” haven't been saved.`
        : `Replace the board? Its ${padCount} pad${padCount === 1 ? '' : 's'} aren't saved to a preset.`,
    )
  }

  function load(nextBanks: SoundBank[], id: string | null) {
    if (!confirmDiscard()) return
    dispatch({ type: 'soundBoard.load', banks: nextBanks, activeId: id })
    setOpen(false)
  }

  // Fresh ids so the preset and the board on screen never share a pad, then
  // re-pointed at this machine's copies of the songs.
  const loadSaved = (b: SavedBoard) => load(relinkPads(captureBoard(b.banks), tracks), b.id)

  function saveNew() {
    const name = newName.trim()
    if (!name) return
    dispatch({ type: 'soundBoard.saveNew', id: newId('board'), name, banks: captureBoard(banks) })
    setNewName('')
  }

  return (
    <div className="tpl sound__boards" ref={rootRef}>
      <button className={`tpl__button ${open ? 'tpl__button--open' : ''}`} onClick={() => setOpen((o) => !o)}>
        <span className="tpl__button-label">{activeBoard ? activeBoard.name : 'Board…'}</span>
        {dirty && <span className="tpl__dot" title="Unsaved changes to this board" />}
        <span className="tpl__chev" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="tpl__menu">
          {/* The label shows even with nothing under it. The operator's picker
              always has rows here because two templates ship with the app; no
              boards ship, because the standard board is built from whatever
              tags your library happens to have. So this section was invisible
              until you saved something — which made saving, updating, renaming
              and reloading a board look like features the soundboard didn't
              have, when they were only features you hadn't discovered. */}
          <div className="tpl__label">Your boards</div>
          {savedBoards.length === 0 && (
            <p className="tpl__empty">
              None yet. Name this one below to keep it — then it lands here to reload, update or
              rename.
            </p>
          )}
          {savedBoards.map((b) => {
            const isActive = b.id === activeId
            const pads = b.banks.reduce((n, bank) => n + bank.pads.length, 0)
            return (
              <div key={b.id} className={`tpl__row ${isActive ? 'tpl__row--active' : ''}`}>
                {renamingId === b.id ? (
                  <input
                    className="tpl__input"
                    value={renameText}
                    autoFocus
                    aria-label="Rename board"
                    onChange={(e) => setRenameText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && renameText.trim()) {
                        dispatch({ type: 'soundBoard.rename', id: b.id, name: renameText.trim() })
                        setRenamingId(null)
                      } else if (e.key === 'Escape') setRenamingId(null)
                    }}
                    onBlur={() => setRenamingId(null)}
                  />
                ) : (
                  <button
                    className="tpl__name"
                    onClick={() => loadSaved(b)}
                    title={`Load this board — ${b.banks.length} tab${b.banks.length === 1 ? '' : 's'}, ${pads} pad${pads === 1 ? '' : 's'}`}
                  >
                    <span className="tpl__check" aria-hidden>
                      {isActive ? '●' : ''}
                    </span>
                    {b.name}
                  </button>
                )}
                {confirmUpdateId === b.id ? (
                  <span className="tpl__confirm">
                    <span className="tpl__confirm-q">Update?</span>
                    <button
                      className="tpl__pill tpl__pill--yes"
                      onClick={() => {
                        dispatch({ type: 'soundBoard.update', id: b.id, banks: captureBoard(banks) })
                        setConfirmUpdateId(null)
                      }}
                    >
                      Yes
                    </button>
                    <button className="tpl__pill tpl__pill--no" onClick={() => setConfirmUpdateId(null)}>
                      No
                    </button>
                  </span>
                ) : (
                  renamingId !== b.id && (
                    <span className="tpl__row-actions">
                      {isActive && dirty && (
                        <button
                          className="tpl__pill"
                          title="Save the board's changes back into this preset"
                          onClick={() => setConfirmUpdateId(b.id)}
                        >
                          Update
                        </button>
                      )}
                      <button
                        className="tpl__icon"
                        title="Rename"
                        onClick={() => {
                          setRenamingId(b.id)
                          setRenameText(b.name)
                        }}
                      >
                        ✎
                      </button>
                      <button
                        className="tpl__icon tpl__icon--del"
                        title="Delete board"
                        onClick={() => dispatch({ type: 'soundBoard.remove', id: b.id })}
                      >
                        ✕
                      </button>
                    </span>
                  )
                )}
              </div>
            )
          })}

          {/* One way to start fresh, exactly like the template picker's "Blank".
              There used to be three, and two of them built a board out of your
              library: "A pad for every tag" and a "ComedySportz — Standard"
              that shared its name with the board that now ships — so the menu
              listed the same words twice, once as something you were on and
              once as something that would replace it. Reasonable in isolation,
              confusing in a list. The builders are still in boards.ts if a way
              back is ever wanted; nothing calls them.

              Export / Import went for the same reason: the operator has no
              such section, and two pickers that are meant to be one control
              shouldn't disagree about what's in them. The board-file code and
              its tests are untouched, so this is a menu entry away from
              returning. */}
          <div className="tpl__label">Start fresh</div>
          <button className="tpl__name tpl__name--builtin" onClick={() => load([], null)}>
            <span className="tpl__check" aria-hidden></span>
            Blank — start from scratch
          </button>


          <div className="tpl__new">
            <input
              className="tpl__input"
              value={newName}
              placeholder="Save this board as…"
              aria-label="New board name"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveNew()}
            />
            <button className="tpl__pill tpl__pill--save" onClick={saveNew} disabled={!newName.trim()}>
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
