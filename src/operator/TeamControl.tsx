// Controls for one team. Edits always target PENDING; live is shown for
// reference. The panel is placed by side so the operator mirrors the audience.

import { useAppState, useDispatch } from '../store/react'
import type { Side } from '../core/sides'
import type { TeamId } from '../core/state'

export function TeamControl({ team, side }: { team: TeamId; side: Side }) {
  const dispatch = useDispatch()
  const name = useAppState((s) => s.teams[team].name)
  const mood = useAppState((s) => s.teams[team].mood)
  const liveScore = useAppState((s) => s.teams[team].liveScore)
  const pendingScore = useAppState((s) => s.teams[team].pendingScore)

  const inc = team === 'blue' ? 'blue.increment' : 'red.increment'
  const dec = team === 'blue' ? 'blue.decrement' : 'red.decrement'
  const dirty = pendingScore !== liveScore

  return (
    <section className={`team-control team-control--${team}`} data-side={side}>
      <input
        className="team-control__name"
        value={name}
        aria-label={`${team} team name`}
        onChange={(e) => dispatch({ type: 'team.setName', team, name: e.target.value })}
      />

      <div className="team-control__scores">
        <label className="team-control__pending">
          <span>Pending</span>
          <input
            type="number"
            value={pendingScore}
            aria-label={`${team} pending score`}
            onChange={(e) =>
              dispatch({
                type: 'team.setScore',
                team,
                // Empty field parses to 0; keeps the input usable while typing.
                value: e.target.value === '' ? 0 : parseInt(e.target.value, 10),
              })
            }
          />
        </label>
        <div className="team-control__live">
          <span>Live</span>
          <strong>{liveScore}</strong>
        </div>
      </div>

      {dirty && (
        <div className="team-control__diff">
          will reveal {liveScore} → <b>{pendingScore}</b>
        </div>
      )}

      <div className="team-control__buttons">
        <button className="btn btn--dec" onClick={() => dispatch({ type: dec })}>
          −
        </button>
        <button className="btn btn--inc" onClick={() => dispatch({ type: inc })}>
          +
        </button>
      </div>

      <input
        className="team-control__mood"
        value={mood}
        placeholder="mood (emoji)"
        aria-label={`${team} team mood`}
        onChange={(e) => dispatch({ type: 'team.setMood', team, mood: e.target.value })}
      />
    </section>
  )
}
