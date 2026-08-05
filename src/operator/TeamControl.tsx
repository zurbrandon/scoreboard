// Controls for one team, laid out compactly so both teams sit side by side.
// Edits always target PENDING; live is shown for reference. The panel is placed
// by side so the operator mirrors the audience.

import { useEffect, useRef, useState } from 'react'
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react'
import { useAppState, useDispatch } from '../store/react'
import type { Side } from '../core/sides'
import type { TeamId } from '../core/state'

export function TeamControl({ team, side }: { team: TeamId; side: Side }) {
  const dispatch = useDispatch()
  const name = useAppState((s) => s.teams[team].name)
  const liveScore = useAppState((s) => s.teams[team].liveScore)
  const pendingScore = useAppState((s) => s.teams[team].pendingScore)

  const inc = team === 'blue' ? 'blue.increment' : 'red.increment'
  const dec = team === 'blue' ? 'blue.decrement' : 'red.decrement'
  const dirty = pendingScore !== liveScore

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
            type="number"
            value={pendingScore}
            aria-label={`${team} pending score`}
            onChange={(e) =>
              dispatch({
                type: 'team.setScore',
                team,
                value: e.target.value === '' ? 0 : parseInt(e.target.value, 10),
              })
            }
          />
          <span className={`team-control__liveline ${dirty ? 'team-control__liveline--dirty' : ''}`}>
            live {dirty ? `${liveScore} → ` : ''}
            <b>{dirty ? pendingScore : liveScore}</b>
          </span>
        </div>

        <div className="team-control__buttons">
          <button className="team-btn team-btn--inc" onClick={() => dispatch({ type: inc })}>
            +
          </button>
          <button className="team-btn team-btn--dec" onClick={() => dispatch({ type: dec })}>
            −
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
