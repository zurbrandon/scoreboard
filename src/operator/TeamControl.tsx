// Controls for one team, laid out compactly so both teams sit side by side.
// Edits always target PENDING; live is shown for reference. The panel is placed
// by side so the operator mirrors the audience.

import { useAppState, useDispatch } from '../store/react'
import type { Side } from '../core/sides'
import type { TeamId } from '../core/state'

// Keep only the last emoji/grapheme the OS picker inserted, so the mood is a
// single symbol even if the field ends up with more than one character.
function lastGrapheme(raw: string): string {
  if (!raw) return ''
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    const parts = [...seg.segment(raw)].map((s) => s.segment)
    return parts[parts.length - 1] ?? ''
  } catch {
    // Older engines without Intl.Segmenter: fall back to code-point split.
    const cps = [...raw]
    return cps[cps.length - 1] ?? ''
  }
}

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

// A single-emoji field. Focusing it and hitting the OS emoji shortcut
// (⌘⌃Space on macOS, Win + . on Windows) opens the system emoji picker, so the
// operator has every emoji instead of a fixed handful.
function MoodBox({ team }: { team: TeamId }) {
  const dispatch = useDispatch()
  const mood = useAppState((s) => s.teams[team].mood)

  return (
    <div className="moodbox">
      <input
        className="moodbox__input"
        value={mood}
        placeholder="＋"
        aria-label={`${team} mood emoji`}
        title="Click, then open your emoji picker (⌘⌃Space on Mac, Win + . on Windows)"
        onChange={(e) => dispatch({ type: 'team.setMood', team, mood: lastGrapheme(e.target.value) })}
      />
      {mood && (
        <button
          className="moodbox__clear"
          aria-label="Clear mood"
          // Keep focus off the button so a click doesn't steal it from the field.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => dispatch({ type: 'team.setMood', team, mood: '' })}
        >
          ✕
        </button>
      )}
    </div>
  )
}
