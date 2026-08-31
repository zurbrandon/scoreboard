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
import { normSoundBanks } from '../core/state'
import type { SoundTrackInfo } from '../shared/bridge'
import { newId } from '../shared/ids'
import { makeTagPad } from './pads'
import { boardFileName, boardSignature, captureBoard, parseBoardFile, relinkPads, serializeBoard, standardBoard } from './boards'

export function BoardPicker({ tracks, tags }: { tracks: SoundTrackInfo[]; tags: string[] }) {
  const dispatch = useDispatch()
  const banks = useAppState((s) => s.soundBanks)
  const savedBoards = useAppState((s) => s.savedBoards)
  const activeId = useAppState((s) => s.activeBoard)
  const slots = useAppState((s) => s.soundSlots)

  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [confirmUpdateId, setConfirmUpdateId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
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

  async function exportBoard() {
    const bridge = window.showboard
    if (!bridge) return
    const name = activeBoard?.name ?? 'Soundboard'
    const ok = await bridge.exportBoardFile(boardFileName(name), serializeBoard(name, captureBoard(banks)))
    // Cancelling is a normal thing to do, so it isn't worth a message.
    if (ok) setNotice(`Exported “${name}”.`)
  }

  async function importBoard() {
    const bridge = window.showboard
    if (!bridge) return
    const text = await bridge.importBoardFile()
    if (text === null) return // cancelled
    const file = parseBoardFile(text)
    if (!file) {
      setNotice("That doesn't look like a soundboard file.")
      return
    }
    // Through the same normalizer the live board uses, so a hand-edited file
    // can't put a pad on the board that the board itself would reject.
    const banksIn = relinkPads(captureBoard(normSoundBanks(file.banks)), tracks)
    const missing = banksIn.reduce(
      (n, b) => n + b.pads.filter((p) => p.kind === 'track' && !tracks.some((t) => t.id === p.trackId)).length,
      0,
    )
    if (!confirmDiscard()) return
    // Imported boards are saved as well as loaded: a board you can't find again
    // after the next Import isn't much of a share.
    const id = newId('board')
    dispatch({ type: 'soundBoard.saveNew', id, name: file.name, banks: captureBoard(banksIn) })
    dispatch({ type: 'soundBoard.load', banks: banksIn, activeId: id })
    setOpen(false)
    // Say it plainly rather than letting them find out mid-show.
    if (missing > 0) {
      window.alert(
        `Imported “${file.name}”, but ${missing} song${missing === 1 ? " isn't" : "s aren't"} in your library — ` +
          `${missing === 1 ? 'that pad shows' : 'those pads show'} as missing. Tag pads are unaffected.`,
      )
    }
  }

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
          {savedBoards.length > 0 && <div className="tpl__label">Your boards</div>}
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

          <div className="tpl__label">Start fresh</div>
          <button className="tpl__name tpl__name--builtin" onClick={() => load([], null)}>
            <span className="tpl__check" aria-hidden></span>
            Empty board
          </button>
          {/* Built from this machine's tags rather than from a canned song list:
              a tag pad names a tag, so this is the one starting point that means
              the same thing in anyone's library. */}
          {tags.length > 0 && (
            <button
              className="tpl__name tpl__name--builtin"
              title="One tab, with a pad for each tag in your library"
              onClick={() =>
                load(
                  [{ id: newId('bank'), name: 'Tags', pads: tags.map((t) => makeTagPad(t, 'random')) }],
                  null,
                )
              }
            >
              <span className="tpl__check" aria-hidden></span>
              A pad for every tag ({tags.length})
            </button>
          )}

          {/* Built from this machine's slots and tags, so it means the same
              thing in anyone's library — a canned song list would arrive as a
              board of missing pads. */}
          <button
            className="tpl__name tpl__name--builtin"
            title="Your show cues in one tab, the rest of your tags in another"
            onClick={() => load(standardBoard(slots, tags), null)}
          >
            <span className="tpl__check" aria-hidden></span>
            ComedySportz — Standard
          </button>

          <div className="tpl__label">Share</div>
          <div className="tpl__row">
            <button
              className="tpl__name tpl__name--builtin"
              disabled={padCount === 0}
              title={padCount === 0 ? 'Nothing on the board to export' : 'Write this board to a file'}
              onClick={exportBoard}
            >
              <span className="tpl__check" aria-hidden></span>
              Export this board…
            </button>
          </div>
          <div className="tpl__row">
            <button
              className="tpl__name tpl__name--builtin"
              title="Open a board someone sent you"
              onClick={importBoard}
            >
              <span className="tpl__check" aria-hidden></span>
              Import a board…
            </button>
          </div>
          {notice && <div className="tpl__notice">{notice}</div>}

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
