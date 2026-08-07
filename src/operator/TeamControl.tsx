// Controls for one team, laid out compactly so both teams sit side by side.
// Edits always target PENDING; live is shown for reference. The panel is placed
// by side so the operator mirrors the audience.

import { useEffect, useRef, useState } from 'react'
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react'
import { useAppState, useDispatch } from '../store/react'
import type { Side } from '../core/sides'
import type { TeamId } from '../core/state'
import { formatScore } from '../core/score'

// The +/- buttons normally step by 1; holding a modifier steps by 10. Mac uses
// Command; elsewhere (Windows/Linux) uses Shift.
const BIG_STEP = 10
function bigStepHeld(e: { metaKey: boolean; shiftKey: boolean }): boolean {
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)
  return isMac ? e.metaKey : e.shiftKey
}

// Live-tracks whether the big-step modifier is currently down, so the button
// labels can show +10 / -10 the moment the key is held.
function useBigStep(): boolean {
  const [big, setBig] = useState(false)
  useEffect(() => {
    const sync = (e: KeyboardEvent) => setBig(bigStepHeld(e))
    const reset = () => setBig(false)
    window.addEventListener('keydown', sync)
    window.addEventListener('keyup', sync)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', sync)
      window.removeEventListener('keyup', sync)
      window.removeEventListener('blur', reset)
    }
  }, [])
  return big
}

export function TeamControl({ team, side }: { team: TeamId; side: Side }) {
  const dispatch = useDispatch()
  const name = useAppState((s) => s.teams[team].name)
  const liveScore = useAppState((s) => s.teams[team].liveScore)
  const pendingScore = useAppState((s) => s.teams[team].pendingScore)

  const inc = team === 'blue' ? 'blue.increment' : 'red.increment'
  const dec = team === 'blue' ? 'blue.decrement' : 'red.decrement'
  const dirty = pendingScore !== liveScore
  const big = useBigStep()
  const step = big ? BIG_STEP : 1
  // Read the modifier off the click itself so the amount is exact even if the
  // key state and the label ever disagree by a hair.
  const bump = (e: { metaKey: boolean; shiftKey: boolean }, sign: 1 | -1) =>
    dispatch({ type: 'team.bumpScore', team, delta: sign * (bigStepHeld(e) ? BIG_STEP : 1) })

  // Keep the exact text the operator is typing (e.g. "3." mid-entry) so a
  // trailing decimal point survives round-tripping through the number. null =
  // not editing, so the field mirrors the store (and any +/- changes).
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? formatScore(pendingScore)

  return (
    <section className={`team-control team-control--${team}`} data-side={side}>
      <div className="team-control__head">
        <input
          className="team-control__name"
          value={name}
          aria-label={`${team} team name`}
          onChange={(e) => dispatch({ type: 'team.setName', team, name: e.target.value })}
        />
        <MoodBox team={team} />
      </div>

      <div className="team-control__body">
        <div className="team-control__scoreblock">
          <span className="team-control__cap">Pending</span>
          <input
            className="team-control__pendinginput"
            type="text"
            inputMode="decimal"
            value={shown}
            aria-label={`${team} pending score`}
            onFocus={(e) => e.target.select()}
            onBlur={() => setDraft(null)}
            onChange={(e) => {
              const raw = e.target.value
              // Accept only number-ish input: optional sign, digits, one dot.
              if (!/^-?\d*\.?\d*$/.test(raw)) return
              setDraft(raw)
              const n = parseFloat(raw)
              dispatch({ type: 'team.setScore', team, value: Number.isFinite(n) ? n : 0 })
            }}
            onKeyDown={(e) => {
              // ↑/↓ step by 1, keeping the decimal part (3.5 → 4.5 → 5.5).
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setDraft(null)
                dispatch({ type: inc })
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setDraft(null)
                dispatch({ type: dec })
              }
            }}
          />
          <span className={`team-control__liveline ${dirty ? 'team-control__liveline--dirty' : ''}`}>
            live {dirty ? `${formatScore(liveScore)} → ` : ''}
            <b>{formatScore(dirty ? pendingScore : liveScore)}</b>
          </span>
        </div>

        <div className={`team-control__buttons ${big ? 'team-control__buttons--big' : ''}`}>
          <button
            className="team-btn team-btn--inc"
            aria-label={`Add ${step} to ${team}`}
            onClick={(e) => bump(e, 1)}
          >
            +{step}
          </button>
          <button
            className="team-btn team-btn--dec"
            aria-label={`Subtract ${step} from ${team}`}
            onClick={(e) => bump(e, -1)}
          >
            −{step}
          </button>
        </div>
      </div>
    </section>
  )
}

// Click the swatch to open a full emoji picker (search + all emoji). Rendered
// with EmojiStyle.NATIVE so it draws the system font — no network, which keeps
// it working offline in the booth.
function MoodBox({ team }: { team: TeamId }) {
  const dispatch = useDispatch()
  const mood = useAppState((s) => s.teams[team].mood)
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Close on click-outside or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="moodbox" ref={boxRef}>
      <button
        className="moodbox__btn"
        aria-label={`${team} mood`}
        onClick={() => setOpen((o) => !o)}
      >
        {mood || <span className="moodbox__empty">＋</span>}
      </button>
      {mood && !open && (
        <button
          className="moodbox__clear"
          aria-label="Clear mood"
          onClick={(e) => {
            e.stopPropagation()
            dispatch({ type: 'team.setMood', team, mood: '' })
          }}
        >
          ✕
        </button>
      )}
      {open && (
        <div className={`moodbox__pop moodbox__pop--${team}`}>
          <EmojiPicker
            onEmojiClick={(data) => {
              dispatch({ type: 'team.setMood', team, mood: data.emoji })
              setOpen(false)
            }}
            emojiStyle={EmojiStyle.NATIVE}
            theme={Theme.DARK}
            lazyLoadEmojis
            skinTonesDisabled
            previewConfig={{ showPreview: false }}
            width={300}
            height={380}
          />
        </div>
      )}
    </div>
  )
}
