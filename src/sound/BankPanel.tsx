// The soundboard proper: tabs of big buttons. A pad is one tap — the song starts
// and whatever was playing stops. That's the whole interaction, and everything
// here is in service of finding the right button fast during a show.

import { useMemo, useState } from 'react'
import { useDispatch } from '../store/react'
import type { SoundBank, SoundPad } from '../core/state'
import type { SoundTrackInfo } from '../shared/bridge'
import { MdLocalOffer } from 'react-icons/md'
import { newId } from '../shared/ids'
import { makePads, tracksByIds } from './pads'

/** Payload for a drag out of the library list. */
export const DRAG_TYPE = 'application/x-showboard-tracks'
/** Payload for dragging a pad within its bank. A distinct type so the grid can
 *  tell "reorder what's here" from "add something new" during dragover, where
 *  the data itself can't be read yet — only its types. */
const PAD_DRAG_TYPE = 'application/x-showboard-pad'

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
  const [renamingPad, setRenamingPad] = useState<string | null>(null)
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

  function commitPadLabel(bankId: string, pad: SoundPad, value: string) {
    dispatch({
      type: 'soundPad.relabel',
      bankId,
      padId: pad.id,
      label: value.trim() || pad.label,
    })
    setRenamingPad(null)
  }

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
            // Dragging onto a tab switches to it, so you can drop into a bank
            // you aren't looking at.
            onDragOver={(e) => {
              e.preventDefault()
              onSelectBank(bank.id) // drop into a bank you aren't looking at
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
              </>
            )}
          </div>
        ))}
        <button className="banks__tab banks__tab--add" onClick={addBank} title="New bank">
          +
        </button>
      </div>

      <div className="banks__toolbar">
        <button className="pill" onClick={() => setRenamingBank(active!.id)}>
          Rename bank
        </button>
        <button
          className="pill"
          onClick={() => {
            if (!active) return
            // A bank can hold forty pads; deleting one by mis-click would be a
            // bad afternoon.
            const ok =
              active.pads.length === 0 ||
              window.confirm(`Delete "${active.name}" and its ${active.pads.length} pads?`)
            if (ok) dispatch({ type: 'soundBank.remove', id: active.id })
          }}
        >
          Delete bank
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
            const missing =
              pad.kind === 'tag' ? taggedCount === 0 : !tracks.some((t) => t.id === pad.trackId)
            const fire = () => {
              if (missing) return
              if (pad.kind === 'tag') dispatch({ type: 'sound.playTag', tag: pad.tag, mode: pad.mode })
              else dispatch({ type: 'sound.play', id: pad.trackId })
            }
            return (
              <div
                key={pad.id}
                className={`pad${missing ? ' pad--missing' : ''}${pad.kind === 'tag' ? ' pad--tag' : ''}${
                  dragPadId === pad.id ? ' pad--dragging' : ''
                }`}
                // Not draggable mid-rename, or the text can't be selected.
                draggable={renamingPad !== pad.id}
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
                onClick={fire}
                onDoubleClick={() => setRenamingPad(pad.id)}
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
                {renamingPad === pad.id ? (
                  <input
                    className="pad__rename"
                    defaultValue={pad.label}
                    autoFocus
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => commitPadLabel(active.id, pad, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitPadLabel(active.id, pad, e.currentTarget.value)
                      if (e.key === 'Escape') setRenamingPad(null)
                    }}
                  />
                ) : (
                  <span className="pad__label">{pad.label}</span>
                )}
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
                <button
                  className="pad__remove"
                  title="Remove pad"
                  onClick={(e) => {
                    e.stopPropagation() // removing a pad must never also fire it
                    dispatch({ type: 'soundPad.remove', bankId: active.id, padId: pad.id })
                  }}
                >
                  ✕
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
