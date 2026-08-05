// The technician's control surface: a narrow column with scene tabs on top,
// the active scene's config in the middle, and a persistent reveal deck pinned
// to the bottom. Preview/Program: picking a tab only previews a scene; the deck
// (Reveal / update silently / Black) is what actually changes the projector.

import { useState } from 'react'
import { useAppState, useDispatch } from '../store/react'
import { teamOnSide } from '../core/sides'
import { LOGO_LIBRARY } from '../core/logos'
import type { Scene } from '../core/state'
import { TeamControl } from './TeamControl'
import { MusicPanel } from './MusicPanel'
import { ProjectorDisplayPicker } from './ProjectorDisplayPicker'
import { useOperatorKeyboard } from './useOperatorKeyboard'

const SCENE_TABS: { scene: Scene; label: string; primary?: boolean }[] = [
  { scene: 'scoreboard', label: 'Scoreboard', primary: true },
  { scene: 'logo', label: 'Logo' },
  { scene: 'text', label: 'Text' },
  { scene: 'slideshow', label: 'Slideshow' },
]

const ON_AIR_LABEL: Record<Scene, string> = {
  scoreboard: 'Scoreboard',
  logo: 'Logo',
  text: 'Text',
  slideshow: 'Slideshow',
  black: 'Black',
}

export function OperatorApp() {
  const dispatch = useDispatch()
  const programScene = useAppState((s) => s.scene)
  const anyDirty = useAppState(
    (s) =>
      s.teams.blue.pendingScore !== s.teams.blue.liveScore ||
      s.teams.red.pendingScore !== s.teams.red.liveScore,
  )

  const draftLogoId = useAppState((s) => s.logo.draftId)
  const liveLogoId = useAppState((s) => s.logo.liveId)

  // Fall back to the scoreboard if a persisted scene is no longer a valid tab.
  const [activeTab, setActiveTab] = useState<Scene>(
    SCENE_TABS.some((t) => t.scene === programScene) ? programScene : 'scoreboard',
  )

  // The deck pushes the ACTIVE tab to the projector. Nothing else changes what's
  // on air. Scoreboard reveal animates / silent commits quietly; logo commits the
  // picked logo; other scenes just cut in (no animation yet).
  function pushActive(withReveal: boolean) {
    if (activeTab === 'scoreboard') {
      dispatch({ type: 'display.set', scene: 'scoreboard' })
      dispatch({ type: withReveal ? 'score.reveal' : 'score.commitSilent' })
    } else if (activeTab === 'logo') {
      dispatch({ type: 'logo.commit' })
      dispatch({ type: 'display.set', scene: 'logo' })
    } else {
      dispatch({ type: 'display.set', scene: activeTab })
    }
  }
  const reveal = () => pushActive(true)
  const silent = () => pushActive(false)
  const black = () => dispatch({ type: 'display.set', scene: 'black' })

  useOperatorKeyboard(dispatch, { selectScene: setActiveTab, reveal, black })

  function openProjector() {
    window.open(`${window.location.pathname}?view=projector`, 'showboard-projector')
  }

  // Reveal is "armed" when pressing it would actually change what's on air.
  const armed =
    activeTab === 'scoreboard'
      ? anyDirty || programScene !== 'scoreboard'
      : activeTab === 'logo'
        ? programScene !== 'logo' || draftLogoId !== liveLogoId
        : programScene !== activeTab

  return (
    <div className="operator">
      <header className="operator__header">
        <h1>Showboard</h1>
        <div className="operator__header-right">
          <ProjectorDisplayPicker />
          {!window.showboard && (
            <button className="pill" onClick={openProjector}>
              Open projector ↗
            </button>
          )}
        </div>
      </header>

      <nav className="scene-tabs">
        {SCENE_TABS.map(({ scene, label, primary }) => (
          <button
            key={scene}
            className={[
              'scene-tab',
              primary ? 'scene-tab--primary' : '',
              activeTab === scene ? 'scene-tab--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setActiveTab(scene)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="scene-config">
        {activeTab === 'scoreboard' && <ScoreboardConfig />}
        {activeTab === 'logo' && <LogoConfig />}
        {activeTab === 'text' && (
          <p className="scene-config__hint">
            Text screen. Editable text is coming next — for now, Reveal shows the text scene.
          </p>
        )}
        {activeTab === 'slideshow' && <SlideshowConfig />}
      </div>

      <footer className="deck">
        <div className="deck__onair">
          <span className="deck__onair-dot" />
          on air · {ON_AIR_LABEL[programScene]}
        </div>
        <div className="deck__row">
          <button
            className={`deck-black ${programScene === 'black' ? 'deck-black--active' : ''}`}
            onClick={black}
          >
            Black
          </button>
          <button className={`reveal ${armed ? 'reveal--armed' : ''}`} onClick={reveal}>
            REVEAL
          </button>
          <div className="deck__spacer" />
        </div>
        <button className="silent-btn" onClick={silent}>
          update silently
        </button>
      </footer>
    </div>
  )
}

function ScoreboardConfig() {
  const dispatch = useDispatch()
  const half = useAppState((s) => s.half)
  const audienceScore = useAppState((s) => s.audienceScore)
  const leftTeam = teamOnSide('left', half)
  const rightTeam = teamOnSide('right', half)

  return (
    <>
      <button className="pill half-toggle" onClick={() => dispatch({ type: 'half.toggle' })}>
        {half === 'first' ? '1st Half' : '2nd Half'} · swap sides
      </button>
      <TeamControl team={leftTeam} side="left" />
      <TeamControl team={rightTeam} side="right" />
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
    </>
  )
}

function LogoConfig() {
  const dispatch = useDispatch()
  const draftId = useAppState((s) => s.logo.draftId)
  return (
    <div className="logo-picker">
      {LOGO_LIBRARY.map((logo) => (
        <button
          key={logo.id}
          className={`logo-tile ${draftId === logo.id ? 'logo-tile--active' : ''}`}
          onClick={() => dispatch({ type: 'logo.select', id: logo.id })}
        >
          <img src={`${import.meta.env.BASE_URL}logos/${logo.file}`} alt="" />
          <span>{logo.name}</span>
        </button>
      ))}
    </div>
  )
}

function SlideshowConfig() {
  const dispatch = useDispatch()
  const slideshowUrl = useAppState((s) => s.slideshowUrl)
  return (
    <div className="config-block">
      <span className="config-block__label">Slideshow link</span>
      <input
        className="url-input"
        type="url"
        placeholder="Published Google Slides link…"
        value={slideshowUrl}
        onChange={(e) => dispatch({ type: 'slideshow.setUrl', url: e.target.value })}
      />
      <span className="music-panel__status">
        Paste a published (embed) link, then press Reveal to show it.
      </span>
    </div>
  )
}
