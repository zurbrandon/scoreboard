// The soundboard proper: tabs of big buttons. A pad is one tap — the song starts
// and whatever was playing stops. That's the whole interaction, and everything
// here is in service of finding the right button fast during a show.

import { useState } from 'react'
import { useDispatch } from '../store/react'
import type { SoundBank, SoundPad } from '../core/state'
import type { SoundTrackInfo } from '../shared/bridge'
import { newId } from '../shared/ids'

/** Payload for a drag out of the library list. */
export const DRAG_TYPE = 'application/x-showboard-tracks'

export function BankPanel({
  banks,
  tracks,
  selected,
  onClearSelection,
}: {
  banks: SoundBank[]
  tracks: SoundTrackInfo[]
  selected: SoundTrackInfo[]
  onClearSelection: () => void
}) {
  const dispatch = useDispatch()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [renamingBank, setRenamingBank] = useState<string | null>(null)
  const [renamingPad, setRenamingPad] = useState<string | null>(null)
  const [dropActive, setDropActive] = useState(false)

  // Fall back to the first bank rather than tracking selection in state, so a
  // deleted bank can't leave the panel pointing at nothing.
  const active = banks.find((b) => b.id === activeId) ?? banks[0] ?? null

  function addBank() {
    const id = newId('bank')
    dispatch({ type: 'soundBank.add', id, name: `Bank ${banks.length + 1}` })
    setActiveId(id)
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

  function padsFor(trackIds: string[]): SoundPad[] {
    return trackIds
      .map((trackId) => tracks.find((t) => t.id === trackId))
      .filter((t): t is SoundTrackInfo => !!t)
      .map((t) => ({ id: newId('pad'), trackId: t.id, label: t.name }))
  }

  function addTracks(trackIds: string[]) {
    if (!active || trackIds.length === 0) return
    const pads = padsFor(trackIds)
    if (pads.length > 0) dispatch({ type: 'soundPad.add', bankId: active.id, pads })
  }

  if (banks.length === 0) {
    return (
      <div className="banks banks--empty">
        <p className="sound__empty">
          Banks are tabs of pads — "high energy beats", "musical numbers". Make one, then
          drag songs over from the left, or select them and use Add selected.
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
            onClick={() => setActiveId(bank.id)}
            onDoubleClick={() => setRenamingBank(bank.id)}
            // Dragging onto a tab switches to it, so you can drop into a bank
            // you aren't looking at.
            onDragOver={(e) => {
              e.preventDefault()
              setActiveId(bank.id)
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
        <button
          className="pill"
          disabled={selected.length === 0}
          onClick={() => {
            addTracks(selected.map((t) => t.id))
            onClearSelection()
          }}
        >
          Add selected{selected.length > 0 ? ` (${selected.length})` : ''}
        </button>
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
          setDropActive(true)
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDropActive(false)
          try {
            const ids = JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as string[]
            if (Array.isArray(ids)) addTracks(ids)
          } catch {
            // A drag from outside the app: nothing to add, nothing to report.
          }
        }}
      >
        {active?.pads.length === 0 ? (
          <p className="sound__empty">Drag songs here, or select them on the left and Add selected.</p>
        ) : (
          active?.pads.map((pad) => {
            const missing = !tracks.some((t) => t.id === pad.trackId)
            return (
              <div
                key={pad.id}
                className={`pad${missing ? ' pad--missing' : ''}`}
                onClick={() => !missing && dispatch({ type: 'sound.play', id: pad.trackId })}
                onDoubleClick={() => setRenamingPad(pad.id)}
                title={missing ? `Missing file: ${pad.trackId}` : pad.trackId}
              >
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
                {missing && <span className="pad__missing">file missing</span>}
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
