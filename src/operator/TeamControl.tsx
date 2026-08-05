// Controls for one team, laid out compactly so both teams sit side by side.
// Edits always target PENDING; live is shown for reference. The panel is placed
// by side so the operator mirrors the audience.

import { useState } from 'react'
import { useAppState, useDispatch } from '../store/react'
import type { Side } from '../core/sides'
import type { TeamId } from '../core/state'

// A small curated set for the mood picker — quick to reach in a dark booth.
const MOOD_CHOICES = [
  '🔥', '🎉', '😂', '👏', '💀', '🎭', '🏆', '👑',
  '🤡', '⭐', '🦈', '🐻', '🚀', '💪', '❤️', '🙈',
]

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

function MoodBox({ team }: { team: TeamId }) {
  const dispatch = useDispatch()
  const mood = useAppState((s) => s.teams[team].mood)
  const [open, setOpen] = useState(false)

  function pick(value: string) {
    dispatch({ type: 'team.setMood', team, mood: value })
    setOpen(false)
  }

  return (
    <div className="moodbox">
      <button
        className="moodbox__btn"
        aria-label={`${team} mood`}
        onClick={() => setOpen((o) => !o)}
      >
        {mood || <span className="moodbox__empty">＋</span>}
      </button>
      {open && (
        <div className="moodbox__pop">
          {MOOD_CHOICES.map((choice) => (
            <button key={choice} className="moodbox__choice" onClick={() => pick(choice)}>
              {choice}
            </button>
          ))}
          <button className="moodbox__choice" aria-label="Clear mood" onClick={() => pick('')}>
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
