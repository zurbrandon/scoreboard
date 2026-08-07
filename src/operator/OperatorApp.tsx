// The technician's control surface: a narrow column with scene tabs on top,
// the active scene's config in the middle, and a persistent reveal deck pinned
// to the bottom. Preview/Program: picking a tab only previews a scene; the deck
// (Reveal / update silently / Black) is what actually changes the projector.

import { useRef, useState } from 'react'
import { useAppState, useDispatch } from '../store/react'
import { teamOnSide } from '../core/sides'
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

// Overlay effects — fire on top of whatever scene is showing. Two groups:
// particle bursts and full-screen light effects. Add more by extending these
// (and the matching kind in EffectOverlay).
const FX_BURSTS: { kind: string; icon: string; title: string }[] = [
  { kind: 'confetti', icon: '🎉', title: 'Confetti cannon' },
  { kind: 'streamers', icon: '🎊', title: 'Streamers' },
  { kind: 'fireworks', icon: '🎆', title: 'Fireworks' },
  { kind: 'hearts', icon: '❤️', title: 'Hearts' },
  { kind: 'stars', icon: '⭐', title: 'Stars' },
]
const FX_SCREEN: { kind: string; icon: string; title: string }[] = [
  { kind: 'wash-blue', icon: '🔵', title: 'Blue wash' },
  { kind: 'wash-red', icon: '🔴', title: 'Red wash' },
]
const FX_VERDICTS: { kind: string; icon: string; title: string }[] = [
  { kind: 'success', icon: '✅', title: 'Success!' },
  { kind: 'nope', icon: '❌', title: 'Nope!' },
]

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
      c.quads.some((q, i) => q !== L.quads[i])
    )
  })
  const slideshowDirty = useAppState((s) => {
    const slide = s.slideshow.slides.find((sl) => sl.id === s.slideshow.selectedId)
    return !slide || slide.url !== s.slideshow.liveUrl
  })
  // A live-type text card mirrors keystrokes, so its reveal shouldn't animate.
  const selectedTextIsLive = useAppState(
    (s) => !!s.text.cards.find((c) => c.id === s.text.selectedId)?.liveType,
  )

  // Fall back to the scoreboard if a persisted scene is no longer a valid tab.
  const [activeTab, setActiveTab] = useState<Scene>(
    SCENE_TABS.some((t) => t.scene === programScene) ? programScene : 'scoreboard',
  )
  const [settingsOpen, setSettingsOpen] = useState(false)

  // The deck pushes the ACTIVE tab to the projector. Nothing else changes what's
  // on air. Reveal plays an entrance animation (display.reveal); silent cuts in
  // quietly (display.set). Live-type text and the slideshow never animate.
  function pushActive(withReveal: boolean) {
    if (activeTab === 'scoreboard') {
      dispatch({ type: 'display.set', scene: 'scoreboard' })
      dispatch({ type: withReveal ? 'score.reveal' : 'score.commitSilent' })
    } else if (activeTab === 'logo') {
      dispatch({ type: 'logo.commit' })
      dispatch({ type: withReveal ? 'display.reveal' : 'display.set', scene: 'logo' })
    } else if (activeTab === 'text') {
      dispatch({ type: 'text.commit' })
      const animate = withReveal && !selectedTextIsLive
      dispatch({ type: animate ? 'display.reveal' : 'display.set', scene: 'text' })
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
        <div className="deck__onair">
          <span className="deck__onair-dot" />
          on air · {ON_AIR_LABEL[programScene]}
        </div>
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
        <div className="fx-row">
          {FX_BURSTS.map((fx) => (
            <button
              key={fx.kind}
              className="fx-btn"
              title={fx.title}
              aria-label={fx.title}
              onClick={() => dispatch({ type: 'effect.fire', kind: fx.kind })}
            >
              {fx.icon}
            </button>
          ))}
          <span className="fx-divider" aria-hidden="true" />
          {FX_SCREEN.map((fx) => (
            <button
              key={fx.kind}
              className="fx-btn"
              title={fx.title}
              aria-label={fx.title}
              onClick={() => dispatch({ type: 'effect.fire', kind: fx.kind })}
            >
              {fx.icon}
            </button>
          ))}
          <span className="fx-divider" aria-hidden="true" />
          {FX_VERDICTS.map((fx) => (
            <button
              key={fx.kind}
              className="fx-btn"
              title={fx.title}
              aria-label={fx.title}
              onClick={() => dispatch({ type: 'effect.fire', kind: fx.kind })}
            >
              {fx.icon}
            </button>
          ))}
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
          Final score
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

// Resolve a logo's stored src (bundled path or data: URL) for an <img>.
function logoImgSrc(src: string): string {
  return src.startsWith('data:') ? src : `${import.meta.env.BASE_URL}${src}`
}

// Read an uploaded image, downscale it (max dimension) and return a PNG data URL
// so it persists in state without any file management. Transparency preserved.
async function fileToLogoSrc(file: File, maxDim = 800): Promise<string> {
  const dataUrl: string = await new Promise((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => res(fr.result as string)
    fr.onerror = () => rej(fr.error)
    fr.readAsDataURL(file)
  })
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  if (scale >= 1) return dataUrl // already small enough
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

function LogoConfig() {
  const dispatch = useDispatch()
  const logos = useAppState((s) => s.logos)
  const draftId = useAppState((s) => s.logo.draftId)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function onFiles(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      try {
        const src = await fileToLogoSrc(file)
        const id = `logo-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
        dispatch({ type: 'logo.add', id, name: file.name.replace(/\.[^.]+$/, ''), src })
      } catch (err) {
        console.warn('[logo] could not read image; skipping:', err)
      }
    }
  }

  return (
    <div className="logo-list">
      {logos.map((logo) => (
        <div
          key={logo.id}
          className={`logo-card ${draftId === logo.id ? 'logo-card--active' : ''}`}
          onClick={() => dispatch({ type: 'logo.select', id: logo.id })}
        >
          <div className="logo-card__preview">
            <img src={logoImgSrc(logo.src)} alt={logo.name} />
          </div>
          <input
            className="logo-card__site"
            type="text"
            value={logo.website}
            placeholder="website (shown under the logo)"
            aria-label={`${logo.name} website`}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => dispatch({ type: 'logo.setWebsite', id: logo.id, website: e.target.value })}
          />
          <button
            className="logo-card__remove"
            aria-label={`Remove ${logo.name}`}
            onClick={(e) => {
              e.stopPropagation()
              setConfirmingId(logo.id)
            }}
          >
            ✕
          </button>
          {confirmingId === logo.id && (
            <div className="logo-card__confirm" onClick={(e) => e.stopPropagation()}>
              <span className="logo-card__confirm-q">Remove this logo?</span>
              <div className="logo-card__confirm-row">
                <button
                  className="logo-card__confirm-yes"
                  onClick={() => {
                    dispatch({ type: 'logo.remove', id: logo.id })
                    setConfirmingId(null)
                  }}
                >
                  Remove
                </button>
                <button className="logo-card__confirm-no" onClick={() => setConfirmingId(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <button className="logo-add" onClick={() => fileInput.current?.click()}>
        <span className="logo-add__plus">+</span>
        Add logo
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void onFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

const TEMPLATE_OPTIONS: { value: TextTemplate; label: string }[] = [
  { value: 'basic', label: 'Headline + body' },
  { value: 'quadrants', label: 'Four quadrants' },
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
        // When live-type is on and this card is on air, republish on every edit
        // so keystrokes mirror to the projector — works with either layout.
        const commitIfLive = () => {
          if (card.liveType && isOnAir) dispatch({ type: 'text.commit' })
        }
        const setField = (field: 'headline' | 'body', value: string) => {
          dispatch({ type: 'text.setField', id: card.id, field, value })
          commitIfLive()
        }
        const setQuad = (index: number, value: string) => {
          dispatch({ type: 'text.setQuad', id: card.id, index, value })
          commitIfLive()
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
                aria-label="Card layout"
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
              <label
                className="text-card__livetoggle switch"
                title="Live type: mirror keystrokes to the screen while this card is on air"
                onClick={(e) => e.stopPropagation()}
              >
                <span className={`text-card__livelabel ${card.liveType ? 'is-on' : ''}`}>
                  {card.liveType && isOnAir ? '● LIVE' : 'Live'}
                </span>
                <input
                  type="checkbox"
                  checked={card.liveType}
                  onChange={(e) =>
                    dispatch({ type: 'text.setLiveType', id: card.id, value: e.target.checked })
                  }
                />
                <span className="switch__track">
                  <span className="switch__thumb" />
                </span>
              </label>
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
                      onChange={(e) => setQuad(i, e.target.value)}
                    />
                  ),
                )}
              </div>
            )}

            {card.liveType && (
              <span className="text-card__hint">
                {isOnAir
                  ? 'Live — every keystroke shows on the projector.'
                  : 'Reveal to put this on air, then it types live.'}
              </span>
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
