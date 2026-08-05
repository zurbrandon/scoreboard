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
import { SettingsPanel } from './SettingsPanel'
import { useOperatorKeyboard } from './useOperatorKeyboard'

const SCENE_TABS: { scene: Scene; label: string }[] = [
  { scene: 'scoreboard', label: 'Score' },
  { scene: 'logo', label: 'Logo' },
  { scene: 'text', label: 'Text' },
  { scene: 'slideshow', label: 'Pre-show' },
]

const ON_AIR_LABEL: Record<Scene, string> = {
  scoreboard: 'Score',
  logo: 'Logo',
  text: 'Text',
  slideshow: 'Pre-show',
  black: 'Black',
}

export function OperatorApp() {
  const dispatch = useDispatch()
  const programScene = useAppState((s) => s.scene)
  const half = useAppState((s) => s.half)
  const anyDirty = useAppState(
    (s) =>
      s.teams.blue.pendingScore !== s.teams.blue.liveScore ||
      s.teams.red.pendingScore !== s.teams.red.liveScore,
  )

  const draftLogoId = useAppState((s) => s.logo.draftId)
  const liveLogoId = useAppState((s) => s.logo.liveId)
  const draftText = useAppState((s) => s.text.draft)
  const liveText = useAppState((s) => s.text.live)

  // Fall back to the scoreboard if a persisted scene is no longer a valid tab.
  const [activeTab, setActiveTab] = useState<Scene>(
    SCENE_TABS.some((t) => t.scene === programScene) ? programScene : 'scoreboard',
  )
  const [settingsOpen, setSettingsOpen] = useState(false)

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
    } else if (activeTab === 'text') {
      dispatch({ type: 'text.commit' })
      dispatch({ type: 'display.set', scene: 'text' })
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
      ? anyDirty || programScene !== 'scoreboard' || half === 'end'
      : activeTab === 'logo'
        ? programScene !== 'logo' || draftLogoId !== liveLogoId
        : activeTab === 'text'
          ? programScene !== 'text' || draftText !== liveText
          : programScene !== activeTab

  return (
    <div className="operator">
      <header className="operator__header">
        <h1>Showboard</h1>
        <div className="operator__header-right">
          {!window.showboard && (
            <button className="pill" onClick={openProjector}>
              Open projector ↗
            </button>
          )}
          <button
            className="pill icon-pill"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            ⚙
          </button>
        </div>
      </header>

      <nav className="scene-tabs">
        {SCENE_TABS.map(({ scene, label }) => (
          <button
            key={scene}
            className={`scene-tab ${activeTab === scene ? 'scene-tab--active' : ''}`}
            onClick={() => setActiveTab(scene)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="scene-config">
        {activeTab === 'scoreboard' && <ScoreboardConfig />}
        {activeTab === 'logo' && <LogoConfig />}
        {activeTab === 'text' && <TextConfig />}
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

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
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
      <div className="phase-toggle">
        <button
          className={`phase-seg ${half === 'first' ? 'phase-seg--active' : ''}`}
          onClick={() => dispatch({ type: 'half.set', half: 'first' })}
        >
          1st Half
        </button>
        <button
          className={`phase-seg ${half === 'second' ? 'phase-seg--active' : ''}`}
          onClick={() => dispatch({ type: 'half.set', half: 'second' })}
        >
          2nd Half
        </button>
        <button
          className={`phase-seg phase-seg--end ${half === 'end' ? 'phase-seg--active' : ''}`}
          onClick={() => dispatch({ type: 'half.set', half: 'end' })}
        >
          Show end
        </button>
      </div>
      <div className="teams-row">
        <TeamControl team={leftTeam} side="left" />
        <TeamControl team={rightTeam} side="right" />
      </div>
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

function TextConfig() {
  const dispatch = useDispatch()
  const draft = useAppState((s) => s.text.draft)
  const live = useAppState((s) => s.text.live)
  return (
    <div className="config-block">
      <span className="config-block__label">On-screen text</span>
      <textarea
        className="text-input"
        rows={4}
        placeholder="Type what should show on the projector…"
        value={draft}
        onChange={(e) => dispatch({ type: 'text.setDraft', value: e.target.value })}
      />
      <span className="music-panel__status">
        {draft === live ? 'Showing this when the text scene is on air.' : 'Press Reveal to push your changes.'}
      </span>
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
