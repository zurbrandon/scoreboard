// The technician's control surface. Big controls, minimal text, everything
// visible at a glance (PRD: UI Principles). Holds no business logic — it only
// reads state and dispatches commands.

import { useAppState, useDispatch } from '../store/react'
import { teamOnSide } from '../core/sides'
import type { Scene } from '../core/state'
import { TeamControl } from './TeamControl'
import { MusicPanel } from './MusicPanel'
import { ProjectorDisplayPicker } from './ProjectorDisplayPicker'
import { SHORTCUT_LEGEND, useOperatorKeyboard } from './useOperatorKeyboard'

const SCENES: { scene: Scene; label: string }[] = [
  { scene: 'scoreboard', label: 'Scoreboard' },
  { scene: 'cszLogo', label: 'CSz Logo' },
  { scene: 'theaterLogo', label: 'Theater Logo' },
  { scene: 'text', label: 'Text' },
  { scene: 'slideshow', label: 'Slideshow' },
  { scene: 'black', label: 'Black' },
]

export function OperatorApp() {
  const dispatch = useDispatch()
  useOperatorKeyboard(dispatch)

  const half = useAppState((s) => s.half)
  const scene = useAppState((s) => s.scene)
  const audienceScore = useAppState((s) => s.audienceScore)
  const slideshowUrl = useAppState((s) => s.slideshowUrl)

  const anyDirty = useAppState(
    (s) =>
      s.teams.blue.pendingScore !== s.teams.blue.liveScore ||
      s.teams.red.pendingScore !== s.teams.red.liveScore,
  )

  const leftTeam = teamOnSide('left', half)
  const rightTeam = teamOnSide('right', half)

  function openProjector() {
    window.open(`${window.location.pathname}?view=projector`, 'showboard-projector')
  }

  return (
    <div className="operator">
      <header className="operator__header">
        <h1>Showboard — Operator</h1>
        <div className="operator__header-right">
          <button className="pill" onClick={() => dispatch({ type: 'half.toggle' })}>
            {half === 'first' ? '1st Half' : '2nd Half'} · swap
          </button>
          <ProjectorDisplayPicker />
          {/* In Electron the projector is already a native window. */}
          {!window.showboard && (
            <button className="pill" onClick={openProjector}>
              Open projector ↗
            </button>
          )}
        </div>
      </header>

      <div className="operator__stage">
        <TeamControl team={leftTeam} side="left" />

        <div className="operator__center">
          <button
            className={`reveal ${anyDirty ? 'reveal--armed' : ''}`}
            onClick={() => dispatch({ type: 'score.reveal' })}
          >
            REVEAL
          </button>
          <button
            className="silent-btn"
            onClick={() => dispatch({ type: 'score.commitSilent' })}
            title="Push the pending score with no animation or music"
          >
            update silently
          </button>
          <button
            className="link-btn"
            onClick={() => dispatch({ type: 'score.revertPending' })}
          >
            revert pending
          </button>
        </div>

        <TeamControl team={rightTeam} side="right" />
      </div>

      <section className="operator__scenes">
        {SCENES.map(({ scene: s, label }) => (
          <button
            key={s}
            className={`scene-btn ${scene === s ? 'scene-btn--active' : ''}`}
            onClick={() => dispatch({ type: 'display.set', scene: s })}
          >
            {label}
          </button>
        ))}
      </section>

      <section className="operator__extras">
        <div className="extra">
          <span className="extra__label">Audience</span>
          <button className="btn btn--sm" onClick={() => dispatch({ type: 'audience.decrement' })}>
            −
          </button>
          <strong className="extra__value">{audienceScore}</strong>
          <button className="btn btn--sm" onClick={() => dispatch({ type: 'audience.increment' })}>
            +
          </button>
        </div>

        <MusicPanel />

        <div className="extra">
          <span className="extra__label">Slideshow</span>
          <input
            className="url-input"
            type="url"
            placeholder="Published Google Slides link…"
            value={slideshowUrl}
            onChange={(e) => dispatch({ type: 'slideshow.setUrl', url: e.target.value })}
          />
        </div>
      </section>

      <footer className="operator__legend">
        {SHORTCUT_LEGEND.map(([keys, action]) => (
          <span key={keys} className="legend-item">
            <kbd>{keys}</kbd> {action}
          </span>
        ))}
      </footer>
    </div>
  )
}
