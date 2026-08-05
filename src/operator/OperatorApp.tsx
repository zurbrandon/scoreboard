// The technician's control surface: a narrow column with scene tabs on top,
// the active scene's config in the middle, and a persistent reveal deck pinned
// to the bottom. Preview/Program: picking a tab only previews a scene; the deck
// (Reveal / update silently / Black) is what actually changes the projector.

import { useState } from 'react'
import { useAppState, useDispatch } from '../store/react'
import { teamOnSide } from '../core/sides'
import { LOGO_LIBRARY } from '../core/logos'
import type { Scene, TextTemplate } from '../core/state'
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
  // Any un-published board change (scores, half, audience, or ribbons) arms Reveal.
  const anyDirty = useAppState(
    (s) =>
      s.teams.blue.pendingScore !== s.teams.blue.liveScore ||
      s.teams.red.pendingScore !== s.teams.red.liveScore ||
      s.half !== s.halfLive ||
      s.audience.score !== s.audienceLive.score ||
      s.audience.label !== s.audienceLive.label ||
      s.audience.visible !== s.audienceLive.visible ||
      s.ribbons.home !== s.ribbonsLive.home ||
      s.ribbons.away !== s.ribbonsLive.away ||
      s.ribbons.visible !== s.ribbonsLive.visible,
  )

  const draftLogoId = useAppState((s) => s.logo.draftId)
  const liveLogoId = useAppState((s) => s.logo.liveId)
  const textDirty = useAppState((s) => {
    const c = s.text.cards.find((card) => card.id === s.text.selectedId)
    if (!c) return true
    const L = s.text.live
    return (
      c.id !== L.cardId ||
      c.template !== L.template ||
      c.headline !== L.headline ||
      c.body !== L.body ||
      c.liveText !== L.liveText ||
      c.quads.some((q, i) => q !== L.quads[i])
    )
  })
  const slideshowDirty = useAppState((s) => {
    const slide = s.slideshow.slides.find((sl) => sl.id === s.slideshow.selectedId)
    return !slide || slide.url !== s.slideshow.liveUrl
  })

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
    } else if (activeTab === 'slideshow') {
      dispatch({ type: 'slideshow.commit' })
      dispatch({ type: 'display.set', scene: 'slideshow' })
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
          ? programScene !== 'text' || textDirty
          : activeTab === 'slideshow'
            ? programScene !== 'slideshow' || slideshowDirty
            : programScene !== activeTab

  return (
    <div className="operator">
      <div className="operator__topbar">
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
      </div>

      <div className="scene-config">
        {activeTab === 'scoreboard' && <ScoreboardConfig />}
        {activeTab === 'logo' && <LogoConfig />}
        {activeTab === 'text' && <TextConfig />}
        {activeTab === 'slideshow' && <SlideshowConfig />}
      </div>

      <footer className="deck">
        <div className="deck__row">
          <button
            className={`deck-black ${programScene === 'black' ? 'deck-black--active' : ''}`}
            onClick={black}
          >
            Black screen
          </button>
          <button className={`reveal ${armed ? 'reveal--armed' : ''}`} onClick={reveal}>
            REVEAL
          </button>
          <button className="silent-btn" onClick={silent}>
            update silently
          </button>
        </div>
        <div className="deck__onair">
          <span className="deck__onair-dot" />
          on air · {ON_AIR_LABEL[programScene]}
        </div>
      </footer>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

function ScoreboardConfig() {
  const dispatch = useDispatch()
  const half = useAppState((s) => s.half)
  const audienceScore = useAppState((s) => s.audience.score)
  const audienceLabel = useAppState((s) => s.audience.label)
  const audienceVisible = useAppState((s) => s.audience.visible)
  const ribbonHome = useAppState((s) => s.ribbons.home)
  const ribbonAway = useAppState((s) => s.ribbons.away)
  const ribbonsVisible = useAppState((s) => s.ribbons.visible)
  // Default at the usage site (not in the selector) so useSyncExternalStore
  // still sees a stable reference; loadPersisted guarantees the field exists.
  const musicLibrary = useAppState((s) => s.music.library) ?? []
  const nextTrackId = useAppState((s) => s.music.nextTrackId) ?? null
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

      <h3 className="section-head">Custom</h3>
      <div className="extra ribbons-row">
        <input
          className="ribbon-input ribbon-input--blue"
          value={ribbonHome}
          placeholder="Home"
          aria-label="Home label (Blue)"
          onChange={(e) => dispatch({ type: 'ribbons.setHome', value: e.target.value })}
        />
        <input
          className="ribbon-input ribbon-input--red"
          value={ribbonAway}
          placeholder="Away"
          aria-label="Away label (Red)"
          onChange={(e) => dispatch({ type: 'ribbons.setAway', value: e.target.value })}
        />
        <label className="switch" title={ribbonsVisible ? 'Showing on the board' : 'Hidden'}>
          <input
            type="checkbox"
            checked={ribbonsVisible}
            onChange={(e) => dispatch({ type: 'ribbons.setVisible', visible: e.target.checked })}
          />
          <span className="switch__track">
            <span className="switch__thumb" />
          </span>
        </label>
      </div>

      <div className="extra audience-row">
        <input
          className="audience-label"
          value={audienceLabel}
          aria-label="Audience label"
          onChange={(e) => dispatch({ type: 'audience.setLabel', label: e.target.value })}
        />
        <button className="btn btn--sm" onClick={() => dispatch({ type: 'audience.decrement' })}>
          −
        </button>
        <strong className="extra__value">{audienceScore}</strong>
        <button className="btn btn--sm" onClick={() => dispatch({ type: 'audience.increment' })}>
          +
        </button>
        <label className="switch" title={audienceVisible ? 'Showing on the board' : 'Hidden'}>
          <input
            type="checkbox"
            checked={audienceVisible}
            onChange={(e) => dispatch({ type: 'audience.setVisible', visible: e.target.checked })}
          />
          <span className="switch__track">
            <span className="switch__thumb" />
          </span>
        </label>
      </div>
      <h3 className="section-head">Audio</h3>
      <div className="extra nextsong-row">
        <span className="nextsong__label">🎵 Next song</span>
        <select
          className="nextsong__select"
          value={nextTrackId ?? ''}
          disabled={musicLibrary.length === 0}
          aria-label="Next song"
          title={
            musicLibrary.length === 0 ? 'Load bumpers in Settings to pick a song' : undefined
          }
          onChange={(e) => dispatch({ type: 'music.setNextTrack', id: e.target.value || null })}
        >
          <option value="">🎲 Random</option>
          {musicLibrary.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
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

const TEMPLATE_OPTIONS: { value: TextTemplate; label: string }[] = [
  { value: 'basic', label: 'Headline + body' },
  { value: 'quadrants', label: 'Four quadrants' },
  { value: 'live', label: 'Live typing' },
]

function TextConfig() {
  const dispatch = useDispatch()
  const cards = useAppState((s) => s.text.cards)
  const selectedId = useAppState((s) => s.text.selectedId)
  // A live-template card mirrors keystrokes to the projector, but only once it's
  // the card that's actually on air (Text scene showing, and this card revealed).
  const programScene = useAppState((s) => s.scene)
  const liveCardId = useAppState((s) => s.text.live.cardId)

  return (
    <div className="cards">
      {cards.map((card) => {
        const isOnAir = programScene === 'text' && liveCardId === card.id
        // For a live card that's on air, republish on every keystroke.
        const setField = (field: 'headline' | 'body' | 'liveText', value: string) => {
          dispatch({ type: 'text.setField', id: card.id, field, value })
          if (card.template === 'live' && isOnAir) dispatch({ type: 'text.commit' })
        }
        return (
          <div
            key={card.id}
            className={`text-card ${card.id === selectedId ? 'text-card--active' : ''}`}
            onClick={() => dispatch({ type: 'text.selectCard', id: card.id })}
          >
            <div className="text-card__head">
              <select
                className="text-card__template"
                value={card.template}
                aria-label="Card template"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) =>
                  dispatch({
                    type: 'text.setTemplate',
                    id: card.id,
                    template: e.target.value as TextTemplate,
                  })
                }
              >
                {TEMPLATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {card.template === 'live' && isOnAir && (
                <span className="text-card__livebadge">● LIVE</span>
              )}
              {cards.length > 1 && (
                <button
                  className="text-card__remove"
                  aria-label="Remove card"
                  onClick={(e) => {
                    e.stopPropagation()
                    dispatch({ type: 'text.removeCard', id: card.id })
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {card.template === 'basic' && (
              <>
                <textarea
                  className="text-card__headline"
                  value={card.headline}
                  placeholder="Headline (e.g. Skiing)"
                  aria-label="Card headline"
                  rows={1}
                  onChange={(e) => setField('headline', e.target.value)}
                />
                <textarea
                  className="text-card__body"
                  value={card.body}
                  placeholder={'Body — press Return for a new line\n(e.g. but with pizza sauce)'}
                  aria-label="Card body"
                  rows={1}
                  onChange={(e) => setField('body', e.target.value)}
                />
              </>
            )}

            {card.template === 'quadrants' && (
              <div className="quad-inputs">
                {(['Top left', 'Top right', 'Bottom left', 'Bottom right'] as const).map(
                  (label, i) => (
                    <input
                      key={i}
                      className="text-card__quad"
                      value={card.quads[i]}
                      placeholder={label}
                      aria-label={label}
                      onChange={(e) =>
                        dispatch({ type: 'text.setQuad', id: card.id, index: i, value: e.target.value })
                      }
                    />
                  ),
                )}
              </div>
            )}

            {card.template === 'live' && (
              <>
                <textarea
                  className="text-card__live"
                  value={card.liveText}
                  placeholder="Type here — goes straight to the screen once revealed"
                  aria-label="Live text"
                  rows={2}
                  onChange={(e) => setField('liveText', e.target.value)}
                />
                <span className="text-card__hint">
                  {isOnAir
                    ? 'Live — every keystroke shows on the projector.'
                    : 'Press Reveal to go on air, then it types live.'}
                </span>
              </>
            )}
          </div>
        )
      })}
      <button
        className="add-card"
        onClick={() =>
          dispatch({
            type: 'text.addCard',
            id: `card-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          })
        }
      >
        + Add card
      </button>
    </div>
  )
}

function SlideshowConfig() {
  const dispatch = useDispatch()
  const slides = useAppState((s) => s.slideshow.slides)
  const selectedId = useAppState((s) => s.slideshow.selectedId)

  return (
    <div className="cards">
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          className={`text-card ${slide.id === selectedId ? 'text-card--active' : ''}`}
          onClick={() => dispatch({ type: 'slideshow.selectSlide', id: slide.id })}
        >
          <div className="text-card__head">
            <span className="slide-card__num">Slide {i + 1}</span>
            {slides.length > 1 && (
              <button
                className="text-card__remove"
                aria-label="Remove slide"
                onClick={(e) => {
                  e.stopPropagation()
                  dispatch({ type: 'slideshow.removeSlide', id: slide.id })
                }}
              >
                ✕
              </button>
            )}
          </div>
          <input
            className="slide-card__url"
            type="url"
            value={slide.url}
            placeholder="Published Google Slides link…"
            aria-label={`Slide ${i + 1} link`}
            onChange={(e) =>
              dispatch({ type: 'slideshow.setSlideUrl', id: slide.id, url: e.target.value })
            }
          />
        </div>
      ))}
      <button
        className="add-card"
        onClick={() =>
          dispatch({
            type: 'slideshow.addSlide',
            id: `slide-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          })
        }
      >
        + Add slide
      </button>
      <span className="music-panel__status">
        Paste a published (embed) link, pick a slide, then press Reveal to show it.
      </span>
    </div>
  )
}
