// Controls for one team, laid out compactly so both teams sit side by side.
// Edits always target PENDING; live is shown for reference. The panel is placed
// by side so the operator mirrors the audience.

import { useEffect, useRef, useState } from 'react'
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react'
import { useAppState, useDispatch } from '../store/react'
import { BufferedInput } from './BufferedField'
import type { Side } from '../core/sides'
import type { TeamId } from '../core/state'
import { formatScore } from '../core/score'

// The add row is explicit (+1 / +5 / +10). The −1 button steps by 1, or by 10
// while a modifier is held — Command on Mac, Shift elsewhere.
const ADD_STEPS = [1, 5, 10] as const
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

export function TeamControl({
  team,
  side,
  pot = 0,
  onAward,
}: {
  team: TeamId
  side: Side
  // Experiment: a neutral "pot" of points is staged elsewhere; when it's loaded
  // this card arms as a tap target so a single tap awards the pot to this team.
  pot?: number
  onAward?: (team: TeamId) => void
}) {
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
  const add = (n: number) => dispatch({ type: 'team.bumpScore', team, delta: n })
  const subtract = (e: { metaKey: boolean; shiftKey: boolean }) =>
    dispatch({ type: 'team.bumpScore', team, delta: -(bigStepHeld(e) ? BIG_STEP : 1) })

  // Keep the exact text the operator is typing (e.g. "3." mid-entry) so a
  // trailing decimal point survives round-tripping through the number. null =
  // not editing, so the field mirrors the store (and any +/- changes).
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? formatScore(pendingScore)

  const armed = pot > 0 && !!onAward

  return (
    <section className={`team-control team-control--${team} ${armed ? 'team-control--armed' : ''}`} data-side={side}>
      <div className="team-control__head">
        <BufferedInput
          className="team-control__name"
          value={name}
          aria-label={`${team} team name`}
          onCommit={(v) => dispatch({ type: 'team.setName', team, name: v })}
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

        <div className="team-control__buttons">
          {/* +1 stays the widest: it's the tap a show runs on. */}
          <div className="team-control__addrow">
            {ADD_STEPS.map((n) => (
              <button
                key={n}
                className={`team-btn team-btn--inc ${n === 1 ? 'team-btn--main' : 'team-btn--jump'}`}
                aria-label={`Add ${n} to ${team}`}
                onClick={() => add(n)}
              >
                +{n}
              </button>
            ))}
          </div>
          <button
            className={`team-btn team-btn--dec ${big ? 'team-btn--big' : ''}`}
            aria-label={`Subtract ${step} from ${team}`}
            onClick={subtract}
          >
            −{step}
          </button>
        </div>
      </div>

      {armed && (
        <button
          className="team-control__award"
          onClick={() => onAward!(team)}
          title={`Award ${formatScore(pot)} to ${name || team}`}
        >
          <span className="team-control__award-plus">+{formatScore(pot)}</span>
          <span className="team-control__award-label">Give {name || team}</span>
        </button>
      )}
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
