// The soundboard proper: tabs of big buttons. A pad is one tap — the song starts
// and whatever was playing stops. That's the whole interaction, and everything
// here is in service of finding the right button fast during a show.

import { useEffect, useMemo, useState } from 'react'
import { useDispatch } from '../store/react'
import type { SoundBank } from '../core/state'
import type { SoundTrackInfo } from '../shared/bridge'
import { MdLocalOffer, MdTune } from 'react-icons/md'
import { newId } from '../shared/ids'
import { makePads, tracksByIds } from './pads'
import { PadEditor } from './PadEditor'

/** Payload for a drag out of the library list. */
export const DRAG_TYPE = 'application/x-showboard-tracks'
/** Payload for dragging a pad within its bank. A distinct type so the grid can
 *  tell "reorder what's here" from "add something new" during dragover, where
 *  the data itself can't be read yet — only its types. */
const PAD_DRAG_TYPE = 'application/x-showboard-pad'
/** How long a pad takes to turn over. Kept in step with .pad-flip's transition. */
const PAD_FLIP_MS = 420

export function BankPanel({
  banks,
  tracks,
  activeBankId,
  onSelectBank,
}: {
  banks: SoundBank[]
  tracks: SoundTrackInfo[]
  activeBankId: string | null
  onSelectBank: (id: string) => void
}) {
  const dispatch = useDispatch()
  const [renamingBank, setRenamingBank] = useState<string | null>(null)
  // Which pad is flipped over. One at a time — opening another closes the first,
  // so the board never has two half-finished edits on it.
  const [editingPadId, setEditingPadId] = useState<string | null>(null)
  // The editor outlives the flip by one transition, or closing a pad would show
  // a blank card spinning back rather than the pad turning over.
  const [editorFor, setEditorFor] = useState<string | null>(null)
  const [dropActive, setDropActive] = useState(false)
  // Which pad is being dragged, and where it would land. Held as "the pad we're
  // hovering, and which side" rather than an index, so it survives the list
  // reshuffling underneath as the preview updates.
  const [dragPadId, setDragPadId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; before: boolean } | 'end' | null>(null)

  // Fall back to the first bank, so a deleted one can't leave the board pointing
  // at nothing.
  const active = banks.find((b) => b.id === activeBankId) ?? banks[0] ?? null

  // The order to draw right now: while dragging, the pads with the dragged one
  // lifted out and re-inserted where it would land, so the rest visibly make
  // room instead of the operator guessing where it will go.
  const pads = active?.pads ?? []
  const preview = useMemo(() => {
    if (!dragPadId || !dropTarget) return pads
    const dragged = pads.find((p) => p.id === dragPadId)
    if (!dragged) return pads
    const without = pads.filter((p) => p.id !== dragPadId)
    if (dropTarget === 'end') return [...without, dragged]
    const index = without.findIndex((p) => p.id === dropTarget.id)
    if (index === -1) return pads
    const at = dropTarget.before ? index : index + 1
    return [...without.slice(0, at), dragged, ...without.slice(at)]
  }, [pads, dragPadId, dropTarget])

  function endDrag() {
    setDragPadId(null)
    setDropTarget(null)
  }

  function addBank() {
    const id = newId('bank')
    dispatch({ type: 'soundBank.add', id, name: `Bank ${banks.length + 1}` })
    onSelectBank(id)
    setRenamingBank(id)
  }

  // Renames commit from both Enter and click-away, and both land here so the
  // two paths can't drift. An empty name keeps the old one rather than leaving a
  // blank tab or a blank button.
  function commitBankName(id: string, value: string) {
    const name = value.trim()
    if (name) dispatch({ type: 'soundBank.rename', id, name })
    setRenamingBank(null)
  }

  function openEditor(padId: string) {
    setEditingPadId(padId)
    setEditorFor(padId)
  }

  // Let the closed editor sit on the hidden face until the card has finished
  // turning, then drop it. On a timer rather than transitionend: that event goes
  // missing when the window is backgrounded or animations are suppressed, and a
  // stale editor left mounted would skip its own open — the name would stop
  // arriving selected.
  useEffect(() => {
    if (editingPadId || !editorFor) return
    const t = window.setTimeout(() => setEditorFor(null), PAD_FLIP_MS + 40)
    return () => window.clearTimeout(t)
  }, [editingPadId, editorFor])

  function addTracks(trackIds: string[]) {
    if (!active || trackIds.length === 0) return
    const pads = makePads(tracksByIds(tracks, trackIds))
    if (pads.length > 0) dispatch({ type: 'soundPad.add', bankId: active.id, pads })
  }

  if (banks.length === 0) {
    return (
      <div className="banks banks--empty">
        <p className="sound__empty">
          Banks are tabs of pads — "high energy beats", "musical numbers". Make one, then
          search for songs and use + to put them here.
        </p>
        <button className="pill" onClick={addBank}>
          New bank
        </button>
      </div>
    )
  }

  return (
    <div className="banks">
      <div className="banks__tabs">
        {banks.map((bank) => (
          <div
            key={bank.id}
            className={`banks__tab${bank.id === active?.id ? ' banks__tab--active' : ''}`}
            onClick={() => onSelectBank(bank.id)}
            onDoubleClick={() => setRenamingBank(bank.id)}
            title="Double-click to rename"
            onDragOver={(e) => {
              e.preventDefault()
              // Dragging a PAD onto a tab moves it to that bank, so the active
              // bank must not change under the drag — the pad still belongs to
              // the bank it came from until it lands.
              if (!e.dataTransfer.types.includes(PAD_DRAG_TYPE)) onSelectBank(bank.id)
            }}
            onDrop={(e) => {
              if (!e.dataTransfer.types.includes(PAD_DRAG_TYPE)) return
              e.preventDefault()
              e.stopPropagation()
              if (active && dragPadId && bank.id !== active.id) {
                dispatch({
                  type: 'soundPad.move',
                  fromBankId: active.id,
                  toBankId: bank.id,
                  padId: dragPadId,
                })
              }
              endDrag()
            }}
          >
            {renamingBank === bank.id ? (
              <input
                className="banks__rename"
                defaultValue={bank.name}
                autoFocus
                onFocus={(e) => e.target.select()}
                onBlur={(e) => commitBankName(bank.id, e.target.value)}
                onKeyDown={(e) => {
                  // Commit here rather than relying on blur() to round-trip
                  // through onBlur — Enter should be the definite gesture.
                  if (e.key === 'Enter') commitBankName(bank.id, e.currentTarget.value)
                  if (e.key === 'Escape') setRenamingBank(null)
                }}
              />
            ) : (
              <>
                <span>{bank.name}</span>
                <span className="banks__count">{bank.pads.length}</span>
                {bank.id === active?.id && (
                  <button
                    className="banks__delete"
                    title="Delete this bank"
                    onClick={(e) => {
                      e.stopPropagation()
                      // A bank can hold forty pads; deleting one by mis-click
                      // would be a bad afternoon.
                      const ok =
                        bank.pads.length === 0 ||
                        window.confirm(`Delete “${bank.name}” and its ${bank.pads.length} pads?`)
                      if (ok) dispatch({ type: 'soundBank.remove', id: bank.id })
                    }}
                  >
                    ✕
                  </button>
                )}
              </>
            )}
          </div>
        ))}
        <button className="banks__tab banks__tab--add" onClick={addBank} title="New bank">
          +
        </button>
      </div>

      <div
        className={`banks__grid${dropActive ? ' banks__grid--drop' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (e.dataTransfer.types.includes(PAD_DRAG_TYPE)) {
            // Over the grid's empty space rather than a pad: land at the end.
            if (e.target === e.currentTarget) setDropTarget('end')
            return
          }
          setDropActive(true)
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDropActive(false)
          if (e.dataTransfer.types.includes(PAD_DRAG_TYPE)) {
            if (active && dragPadId) {
              dispatch({
                type: 'soundPad.reorder',
                bankId: active.id,
                ids: preview.map((p) => p.id),
              })
            }
            endDrag()
            return
          }
          try {
            const ids = JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as string[]
            if (Array.isArray(ids)) addTracks(ids)
          } catch {
            // A drag from outside the app: nothing to add, nothing to report.
          }
        }}
      >
        {pads.length === 0 ? (
          <p className="sound__empty">Search for a song and use + to add it here.</p>
        ) : (
          preview.map((pad) => {
            // A tag pad is unavailable when nothing carries its tag (yet); a song
            // pad when its file has gone. Either way it says so rather than being
            // a button that quietly does nothing.
            const taggedCount =
              pad.kind === 'tag' ? tracks.filter((t) => t.tags.includes(pad.tag)).length : 0
            const track = pad.kind === 'track' ? tracks.find((t) => t.id === pad.trackId) : undefined
            const missing = pad.kind === 'tag' ? taggedCount === 0 : !track
            const editing = editingPadId === pad.id
            const fire = () => {
              if (missing) return
              if (pad.kind === 'tag') dispatch({ type: 'sound.playTag', tag: pad.tag, mode: pad.mode })
              else dispatch({ type: 'sound.play', id: pad.trackId })
            }
            return (
              <div
                key={pad.id}
                className={`pad-cell${editing ? ' pad-cell--editing' : ''}${
                  dragPadId === pad.id ? ' pad-cell--dragging' : ''
                }`}
                // Not draggable while flipped, or the text in the name field
                // can't be selected.
                draggable={!editing}
                onDragStart={(e) => {
                  e.dataTransfer.setData(PAD_DRAG_TYPE, pad.id)
                  e.dataTransfer.effectAllowed = 'move'
                  setDragPadId(pad.id)
                }}
                onDragEnd={endDrag}
                onDragOver={(e) => {
                  if (!dragPadId || pad.id === dragPadId) return
                  e.preventDefault()
                  e.stopPropagation() // the grid's end-of-list fallback shouldn't also fire
                  // Left half means "in front of this pad", right half "after" —
                  // the same read as dragging a tab between two others.
                  const box = e.currentTarget.getBoundingClientRect()
                  setDropTarget({ id: pad.id, before: e.clientX < box.left + box.width / 2 })
                }}
              >
                <div className="pad-flip">
                  <div
                    className={`pad pad-face pad-face--front${missing ? ' pad--missing' : ''}${
                      pad.kind === 'tag' ? ' pad--tag' : ''
                    }`}
                    onClick={fire}
                    onDoubleClick={() => openEditor(pad.id)}
                    title={
                      pad.kind === 'tag'
                        ? `${taggedCount} song${taggedCount === 1 ? '' : 's'} tagged “${pad.tag}”`
                        : missing
                          ? `Missing file: ${pad.trackId}`
                          : pad.trackId
                    }
                  >
                    {pad.kind === 'tag' && (
                      <span className="pad__badge" title="Plays from a tag">
                        <MdLocalOffer />
                      </span>
                    )}
                    <span className="pad__label">{pad.label}</span>
                    {/* The mode is the difference between "a run-in" and "house
                        music", so it belongs on the face, not in a tooltip. */}
                    {pad.kind === 'tag' && !missing && (
                      <span className="pad__meta">
                        {pad.mode === 'continuous' ? 'keeps playing' : 'random'} · {taggedCount}
                      </span>
                    )}
                    {missing && (
                      <span className="pad__missing">
                        {pad.kind === 'tag' ? 'nothing tagged' : 'file missing'}
                      </span>
                    )}
                    {/* Where the ✕ used to be. Removing a pad was a single
                        stray click on the button you were reaching for; now it's
                        behind the card, next to the other things you'd want. */}
                    <button
                      className="pad__cog"
                      title="Edit this pad"
                      aria-label={`Edit ${pad.label}`}
                      onClick={(e) => {
                        e.stopPropagation() // editing a pad must never also fire it
                        openEditor(pad.id)
                      }}
                    >
                      <MdTune />
                    </button>
                  </div>

                  <div className="pad pad-face pad-face--back" aria-hidden={!editing}>
                    {editorFor === pad.id && (
                      <PadEditor
                        pad={pad}
                        bank={active}
                        banks={banks}
                        taggedCount={taggedCount}
                        trackName={track?.name ?? null}
                        onRename={(label) =>
                          dispatch({ type: 'soundPad.relabel', bankId: active.id, padId: pad.id, label })
                        }
                        onSetMode={(mode) =>
                          dispatch({ type: 'soundPad.setMode', bankId: active.id, padId: pad.id, mode })
                        }
                        onMoveToBank={(toBankId) => {
                          setEditingPadId(null)
                          dispatch({
                            type: 'soundPad.move',
                            fromBankId: active.id,
                            toBankId,
                            padId: pad.id,
                          })
                        }}
                        onRemove={() => {
                          setEditingPadId(null)
                          dispatch({ type: 'soundPad.remove', bankId: active.id, padId: pad.id })
                        }}
                        onClose={() => setEditingPadId(null)}
                      />
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
