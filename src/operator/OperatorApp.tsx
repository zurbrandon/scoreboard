// The technician's control surface: a narrow column with scene tabs on top,
// the active scene's config in the middle, and a persistent reveal deck pinned
// to the bottom. Preview/Program: picking a tab only previews a scene; the deck
// (Reveal / update silently / Black) is what actually changes the projector.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, Reorder, useDragControls } from 'motion/react'
import { MdScoreboard, MdViewCarousel, MdSportsEsports } from 'react-icons/md'
import type { IconType } from 'react-icons'
import { useAppState, useDispatch } from '../store/react'
import { teamOnSide } from '../core/sides'
import { LOGO_LIBRARY } from '../core/logos'
import type { ImageSlide, LogoSlide, OperatorTab, Scene, ShowBeat, ShowSlide, SlideDeck, SlideshowSlide, TextSlide, TextTemplate } from '../core/state'
import type { Command } from '../core/commands'
import { REVEAL_STYLES, type RevealStyle } from '../core/state'
import { DUCK_STEP } from '../shared/hotkeys'
import { pickMomentVisual } from '../moments'
import { GifSearch } from './GifSearch'
import { WASH_PULSE_MS } from '../projector/WashOverlay'
import { TeamControl } from './TeamControl'
import { SettingsPanel } from './SettingsPanel'
import { useOperatorKeyboard } from './useOperatorKeyboard'

const TABS: { tab: OperatorTab; label: string; Icon: IconType }[] = [
  { tab: 'show', label: 'Show', Icon: MdViewCarousel },
  { tab: 'score', label: 'Score', Icon: MdScoreboard },
  { tab: 'games', label: 'Games', Icon: MdSportsEsports },
]

const ON_AIR_LABEL: Record<Scene, string> = {
  scoreboard: 'Score',
  slides: 'Slide',
  black: 'Black',
  moment: 'Moment',
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
  { kind: 'team-emoji', icon: '🙂', title: 'Team emoji' },
]
const FX_SCREEN: { kind: string; icon: string; title: string }[] = [
  { kind: 'wash-blue', icon: '🔵', title: 'Blue wash' },
  { kind: 'wash-red', icon: '🔴', title: 'Red wash' },
]
const FX_VERDICTS: { kind: string; icon: string; title: string }[] = [
  { kind: 'success', icon: '✅', title: 'Success!' },
  { kind: 'nope', icon: '❌', title: 'Nope!' },
]

// Effects a slide's Reveal cue can auto-fire — every overlay effect, flattened
// for the cue picker on a show beat.
const CUE_EFFECT_OPTIONS = [...FX_BURSTS, ...FX_SCREEN, ...FX_VERDICTS]
// Sentinel value for the music picker's "No music (fade out)" choice — distinct
// from '' (Continue) and from any real track id.
const CUE_SILENCE = '__silence__'

// Each random reveal style pairs its winner animation (a CSS class the projector
// applies) with an accompanying particle effect. null = just the base confetti.
const REVEAL_STYLE_FX: Record<RevealStyle, string | null> = {
  pop: null,
  slam: 'streamers',
  bounce: 'fireworks',
  throb: 'stars',
}
const pickRevealStyle = (): RevealStyle =>
  REVEAL_STYLES[Math.floor(Math.random() * REVEAL_STYLES.length)]

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

  // Slides deck: dirty when the selected slide isn't the one that's live. `live`
  // holds the exact committed object, so a reference check catches un-published
  // edits (an edit replaces the item with a new object) and selection changes.
  const slidesDirty = useAppState((s) => {
    const sel = s.slides.items.find((i) => i.id === s.slides.selectedId)
    return !!sel && sel !== s.slides.live
  })
  // A live-type text slide mirrors keystrokes, so its reveal shouldn't animate.
  const selectedSlideIsLiveText = useAppState((s) => {
    const sel = s.slides.items.find((i) => i.id === s.slides.selectedId)
    return sel?.type === 'text' && sel.liveType
  })
  const allSlides = useAppState((s) => s.slides.items)
  const selectedSlideId = useAppState((s) => s.slides.selectedId)

  const [activeTab, setActiveTab] = useState<OperatorTab>('score')
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Show/Games share one selection; keep it inside the active deck so Reveal
  // always pushes a slide from the deck you're looking at.
  const activeDeck: SlideDeck | null = activeTab === 'score' ? null : activeTab
  useEffect(() => {
    if (!activeDeck) return
    const inDeck = allSlides.filter((s) => s.deck === activeDeck)
    if (!inDeck.some((s) => s.id === selectedSlideId)) {
      dispatch({ type: 'slide.select', id: inDeck[0]?.id ?? '' })
    }
  }, [activeDeck, allSlides, selectedSlideId, dispatch])

  // The deck pushes the ACTIVE tab to the projector. Nothing else changes what's
  // on air. Reveal plays an entrance animation (display.reveal); silent cuts in
  // quietly (display.set). Live-type text and the slideshow never animate.
  // Reveal the scoreboard with a random celebration style. A normal reveal also
  // fires the style's accompanying particle effect (the finale runs its own
  // sequence, so it skips the extra burst).
  function revealScoreboard() {
    const style = pickRevealStyle()
    dispatch({ type: 'display.set', scene: 'scoreboard' })
    dispatch({ type: 'score.reveal', style })
    const fx = REVEAL_STYLE_FX[style]
    if (fx && half !== 'end') dispatch({ type: 'effect.fire', kind: fx })
  }

  function pushActive(withReveal: boolean) {
    if (activeTab === 'score') {
      if (withReveal) {
        revealScoreboard()
      } else {
        dispatch({ type: 'display.set', scene: 'scoreboard' })
        dispatch({ type: 'score.commitSilent' })
      }
    } else {
      // Show / Games — publish the selected slide from the active deck.
      dispatch({ type: 'slide.commit' })
      const animate = withReveal && !selectedSlideIsLiveText
      dispatch({ type: animate ? 'display.reveal' : 'display.set', scene: 'slides' })
    }
  }
  const reveal = () => pushActive(true)
  const silent = () => pushActive(false)
  const black = () => dispatch({ type: 'display.set', scene: 'black' })

  // Kill switch: while a scoreboard reveal/finale is actually playing (and nothing
  // has been edited), the otherwise-idle REVEAL button becomes STOP — one press
  // fades the sound and jumps to the end frame. Scoped to the scoreboard tab while
  // it's the live scene, so leaving the tab hands the button back to normal Reveal
  // (and a fresh reveal elsewhere supersedes this one anyway). A pending edit wins:
  // anyDirty flips it back to REVEAL. A 400ms arm delay stops a double-tap on the
  // reveal you just fired from instantly killing it.
  const revealPhase = useAppState((s) => s.revealPhase)
  const revealSettled = useAppState((s) => s.revealSettled)
  const audioPlaying = useAppState((s) => s.audioPlaying)
  // "Playing" = the reveal animation is running, OR its sound is still going
  // (a bumper can outlast the animation). A settled/frozen finale is not playing.
  const playing = (revealPhase !== 'idle' && !revealSettled) || audioPlaying
  const [stopArmed, setStopArmed] = useState(false)
  useEffect(() => {
    if (!playing) return setStopArmed(false)
    const t = setTimeout(() => setStopArmed(true), 400)
    return () => clearTimeout(t)
  }, [playing])
  const canStop =
    playing && stopArmed && activeTab === 'score' && programScene === 'scoreboard' && !anyDirty

  // The reveal button's single action: kill a playing reveal, or fire a new one.
  const primaryAction = () => (canStop ? dispatch({ type: 'reveal.stop' }) : reveal())

  useOperatorKeyboard(dispatch, { selectScene: setActiveTab, reveal: primaryAction, black })

  // Latest SHOW deck, read at key-press time so the pad's "show slide N" maps to
  // the current run-of-show order (not a value baked in when the effect first ran).
  const showItems = allSlides.filter((s) => s.deck === 'show')
  const slidesRef = useRef(showItems)
  slidesRef.current = showItems

  // Quick-trigger a show beat straight from the deck (captains get their own
  // buttons since they come out several times a show). Reveals the first beat of
  // that kind in the Show deck; the button is disabled when it isn't there.
  const hasBeat = (beat: ShowBeat) => showItems.some((s) => s.type === 'show' && s.beat === beat)
  const revealBeat = (beat: ShowBeat) => {
    const slide = showItems.find((s) => s.type === 'show' && s.beat === beat)
    if (!slide) return
    setActiveTab('show')
    dispatch({ type: 'slide.select', id: slide.id })
    dispatch({ type: 'slide.commit' })
    dispatch({ type: 'display.reveal', scene: 'slides' })
  }
  const runOut = () => dispatch({ type: 'moment.play', kind: 'out', visual: pickMomentVisual('out') })
  const runIn = () => dispatch({ type: 'moment.play', kind: 'in', visual: pickMomentVisual('in') })
  // The pad's Reveal / Silent act on the ACTIVE folder (like the on-screen deck),
  // and the third dial scrubs that folder's slides + presses to cycle folders. The
  // onHotkey effect closes over its scope once, so these read live values via a ref.
  const padRef = useRef({
    reveal: () => {},
    silent: () => {},
    nav: (_dir: 1 | -1) => {},
    cycleTab: () => {},
  })
  padRef.current = {
    reveal: () => pushActive(true),
    silent: () => pushActive(false),
    // Move the selection within the active deck (preview only; clamps at the ends).
    nav: (dir) => {
      if (!activeDeck) return
      const deckItems = allSlides.filter((s) => s.deck === activeDeck)
      const at = deckItems.findIndex((s) => s.id === selectedSlideId)
      const target = deckItems[Math.min(deckItems.length - 1, Math.max(0, (at < 0 ? 0 : at) + dir))]
      if (target) dispatch({ type: 'slide.select', id: target.id })
    },
    cycleTab: () => {
      const order: OperatorTab[] = ['show', 'score', 'games']
      setActiveTab(order[(order.indexOf(activeTab) + 1) % order.length])
    },
  }

  // Macro-pad / keyboard global shortcuts (Electron only). Main registers them
  // OS-wide and forwards each press here. Reveal / Silent act on the active folder
  // (like the on-screen deck); the number keys jump straight to a Show slide.
  useEffect(() => {
    if (!window.showboard) return
    return window.showboard.onHotkey((action) => {
      switch (action.type) {
        case 'blue.up':
          return dispatch({ type: 'blue.increment' })
        case 'blue.down':
          return dispatch({ type: 'blue.decrement' })
        case 'red.up':
          return dispatch({ type: 'red.increment' })
        case 'red.down':
          return dispatch({ type: 'red.decrement' })
        case 'reveal':
          // Plays the active folder: the score on Score, the selected slide on
          // Show / Games (mirrors the on-screen REVEAL button).
          return padRef.current.reveal()
        case 'silent':
          return padRef.current.silent()
        case 'slide.prev':
          return padRef.current.nav(-1)
        case 'slide.next':
          return padRef.current.nav(1)
        case 'tab.cycle':
          return padRef.current.cycleTab()
        case 'stop':
          return dispatch({ type: 'reveal.stop' })
        case 'black':
          return dispatch({ type: 'display.set', scene: 'black' })
        case 'moment.out':
          return dispatch({ type: 'moment.play', kind: 'out', visual: pickMomentVisual('out') })
        case 'moment.in':
          return dispatch({ type: 'moment.play', kind: 'in', visual: pickMomentVisual('in') })
        case 'duck.down':
          return dispatch({ type: 'music.nudgeDuck', delta: -DUCK_STEP })
        case 'duck.up':
          return dispatch({ type: 'music.nudgeDuck', delta: +DUCK_STEP })
        case 'slide.show': {
          const slide = slidesRef.current[action.index]
          if (!slide) return
          setActiveTab('show')
          dispatch({ type: 'slide.select', id: slide.id })
          dispatch({ type: 'slide.commit' })
          // Live-type text mirrors keystrokes, so it cuts in without an entrance.
          const animate = !(slide.type === 'text' && slide.liveType)
          return dispatch({ type: animate ? 'display.reveal' : 'display.set', scene: 'slides' })
        }
      }
    })
  }, [dispatch])

  function openProjector() {
    window.open(`${window.location.pathname}?view=projector`, 'showboard-projector')
  }

  // Reveal is "armed" when pressing it would actually change what's on air.
  const armed =
    activeTab === 'score'
      ? anyDirty || programScene !== 'scoreboard' || half === 'end'
      : programScene !== 'slides' || slidesDirty

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
        {TABS.map(({ tab, label, Icon }) => (
          <button
            key={tab}
            className={`scene-tab ${activeTab === tab ? 'scene-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {activeTab === tab && (
              <motion.span
                className="scene-tab__pill"
                layoutId="sceneTabPill"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <Icon className="scene-tab__icon" aria-hidden="true" />
            <span className="scene-tab__label">{label}</span>
          </button>
        ))}
      </nav>
      </div>

      <div className="scene-config">
        {activeTab === 'score' && <ScoreboardConfig />}
        {activeTab === 'show' && <SlidesConfig deck="show" />}
        {activeTab === 'games' && <SlidesConfig deck="games" />}
      </div>

      <footer className="deck">
        <div className="deck__onair">
          <span className="deck__onair-dot" />
          on air · {ON_AIR_LABEL[programScene]}
        </div>
        <div className="deck__main">
          {/* Black screen, styled as a little "screen": a dark box with a light
              border. Lights up when it's actually on air. */}
          <button
            className={`black-box ${programScene === 'black' ? 'black-box--active' : ''}`}
            onClick={black}
            title="Black screen"
          >
            <span className="black-box__label">Black</span>
          </button>

          {/* REVEAL is the anchor; `update silently` flanks it on the right (it's
              about the same width as the Black box on the left, so the circle stays
              centered). The moment / captain quick-triggers sit in a row below. */}
          <motion.button
            className={`reveal ${canStop ? 'reveal--stop' : armed ? 'reveal--armed' : ''}`}
            onClick={primaryAction}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            {canStop ? 'STOP' : 'REVEAL'}
          </motion.button>

          <button className="silent-btn" onClick={silent}>
            update silently
          </button>
        </div>

        {/* Quick triggers: run out / in (random visual + song), and the three
            captain beats — flipped to several times a show, so one tap each. */}
        <div className="deck__triggers">
          <div className="run-stack">
            <button
              className="run-stack__btn run-stack__btn--out"
              title="Team runs out: random goodbye visual + song"
              onClick={runOut}
            >
              <span aria-hidden="true">🏃</span> out
            </button>
            <button
              className="run-stack__btn run-stack__btn--in"
              title="Team runs back in: random welcome visual + song"
              onClick={runIn}
            >
              <span aria-hidden="true">🏃</span> in
            </button>
          </div>
          <div className="cap-row">
            <button
              className="cap-btn cap-btn--blue"
              title="Blue captain on the field"
              disabled={!hasBeat('captain-blue')}
              onClick={() => revealBeat('captain-blue')}
            >
              <span aria-hidden="true">🧢</span> Blue
            </button>
            <button
              className="cap-btn cap-btn--red"
              title="Red captain on the field"
              disabled={!hasBeat('captain-red')}
              onClick={() => revealBeat('captain-red')}
            >
              <span aria-hidden="true">🧢</span> Red
            </button>
            <button
              className="cap-btn cap-btn--both"
              title="Both captains on the field"
              disabled={!hasBeat('captains')}
              onClick={() => revealBeat('captains')}
            >
              <span aria-hidden="true">🧢</span> Both
            </button>
          </div>
        </div>

        <GifSearch />
        <EffectsFab />
      </footer>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

// The discretionary effects, tucked into a corner sparkle. Click and they FAN
// OUT in a radial arc (Path-style) with a staggered spring pop. Stays open so
// several can be fired in a row; closes on a second press or a click anywhere
// outside — and that outside click still lands, so "confetti… then Run out"
// fires the moment and closes the fan in one motion.
// Two concentric arcs so nine options don't crowd one row: an inner ring of the
// verdict + screen effects, an outer ring of the particle bursts.
const FX_RINGS: { radius: number; items: { kind: string; icon: string; title: string }[] }[] = [
  { radius: 104, items: [...FX_VERDICTS, ...FX_SCREEN] }, // success · nope · blue · red
  { radius: 154, items: FX_BURSTS }, // confetti · streamers · fireworks · hearts · stars
]
// Fan from straight-up (a=0) to straight-left (a=π/2) out of the bottom-right corner.
function fxOrbOffset(radius: number, i: number, n: number) {
  const a = n <= 1 ? Math.PI / 4 : (i / (n - 1)) * (Math.PI / 2)
  return { x: -radius * Math.sin(a), y: -radius * Math.cos(a) }
}

function EffectsFab() {
  const dispatch = useDispatch()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const washPress = useRef(0) // ids each wash press so a stale release timer can't fire

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false) // click-away — we don't preventDefault, so the target still gets it
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  return (
    <>
      {/* While open, a corner scrim blocks clicks from falling through to the
          buttons behind the fan (Run out / Run in). It reads as a soft shadow
          radiating from the sparkle, and clicking it just closes the fan. */}
      {open && <div className="fx-scrim" aria-hidden="true" />}
      <div className="fx-fab" ref={rootRef}>
        <AnimatePresence>
        {open &&
          FX_RINGS.flatMap((ring, ri) =>
            ring.items.map((fx, i) => {
              const { x, y } = fxOrbOffset(ring.radius, i, ring.items.length)
              const order = ri === 0 ? i : FX_RINGS[0].items.length + i
              // The team-color washes are press-and-hold (pulse while held);
              // everything else is a one-shot fire on click.
              const wash = fx.kind === 'wash-blue' ? 'blue' : fx.kind === 'wash-red' ? 'red' : null
              return (
                <motion.button
                  key={fx.kind}
                  className="fx-orb"
                  title={wash ? `${fx.title} — hold` : fx.title}
                  aria-label={fx.title}
                  initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                  animate={{ x, y, scale: 1, opacity: 1 }}
                  exit={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                  whileHover={{ scale: 1.25 }}
                  whileTap={{ scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 26, delay: order * 0.022 }}
                  onPointerDown={
                    wash
                      ? () => {
                          const id = ++washPress.current
                          const start = performance.now()
                          dispatch({ type: 'wash.hold', kind: wash })
                          const release = () => {
                            window.removeEventListener('pointerup', release)
                            window.removeEventListener('pointercancel', release)
                            // A tap still gets ONE full pulse: keep it held for at
                            // least one cycle. A newer press cancels this release.
                            const remaining = WASH_PULSE_MS - (performance.now() - start)
                            const fire = () => {
                              if (washPress.current === id) dispatch({ type: 'wash.release' })
                            }
                            if (remaining <= 0) fire()
                            else setTimeout(fire, remaining)
                          }
                          window.addEventListener('pointerup', release)
                          window.addEventListener('pointercancel', release)
                        }
                      : undefined
                  }
                  onClick={wash ? undefined : () => dispatch({ type: 'effect.fire', kind: fx.kind })}
                >
                  {fx.icon}
                </motion.button>
              )
            }),
          )}
      </AnimatePresence>
        <button
          className={`fx-fab__btn ${open ? 'fx-fab__btn--open' : ''}`}
          aria-expanded={open}
          aria-label={open ? 'Close effects' : 'Effects'}
          title={open ? 'Close' : 'Effects'}
          onClick={() => setOpen((v) => !v)}
        >
          <AnimatePresence initial={false}>
            <motion.span
              key={open ? 'x' : 'icon'}
              className={`fab-icon ${open ? 'fab-icon--x' : ''}`}
              initial={{ rotate: -135, scale: 0.3, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 135, scale: 0.3, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.2, 1.2, 0.4, 1] }}
            >
              {open ? '✕' : '✨'}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
    </>
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

// Read a File/Blob into a data URL.
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => res(fr.result as string)
    fr.onerror = () => rej(fr.error)
    fr.readAsDataURL(blob)
  })
}

// Downscale a data-URL image to a max dimension and re-encode. Logos keep PNG
// (transparency); full-screen image slides use JPEG to keep the data URL small.
async function downscaleDataUrl(
  dataUrl: string,
  maxDim: number,
  mime: 'image/png' | 'image/jpeg' = 'image/png',
  quality?: number,
): Promise<string> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  if (scale >= 1 && mime === 'image/png') return dataUrl // already small enough
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL(mime, quality)
}

// Uploaded logo → downscaled PNG data URL (transparency preserved).
async function fileToLogoSrc(file: File, maxDim = 800): Promise<string> {
  return downscaleDataUrl(await blobToDataUrl(file), maxDim)
}

// A dropped file → a downscaled JPEG data URL for a full-screen image slide.
async function fileToImageSrc(file: File): Promise<string> {
  return downscaleDataUrl(await blobToDataUrl(file), 1600, 'image/jpeg', 0.85)
}

// A URL dragged from a website → a data URL. Electron downloads it in main (no
// CORS); browser-dev tries a fetch and otherwise falls back to the live URL.
async function urlToImageSrc(url: string): Promise<string> {
  const bridge = window.showboard
  if (bridge) {
    const downloaded = await bridge.downloadImage(url)
    if (downloaded) return downscaleDataUrl(downloaded, 1600, 'image/jpeg', 0.85)
    return url
  }
  try {
    const res = await fetch(url)
    if (!res.ok) return url
    const dataUrl = await blobToDataUrl(await res.blob())
    return downscaleDataUrl(dataUrl, 1600, 'image/jpeg', 0.85)
  } catch {
    return url // fall back to referencing the URL directly
  }
}

const TEMPLATE_OPTIONS: { value: TextTemplate; label: string }[] = [
  { value: 'basic', label: 'Headline + body' },
  { value: 'quadrants', label: 'Four quadrants' },
]

// Built-in logo presets for the "add slide" menu.
const LOGO_PRESETS = LOGO_LIBRARY.map((l) => ({ name: l.name, src: `logos/${l.file}` }))

// Game templates: pick one and it instantiates the slides that game needs into
// the Games deck, ready to type into. `build` returns the add-commands (ids come
// from `mk`); the first created slide is selected afterward.
const GAMES: { id: string; label: string; build: (mk: () => string) => Command[] }[] = [
  {
    id: 'four-things',
    label: 'Four Things',
    build: (mk) =>
      Array.from(
        { length: 4 },
        () => ({ type: 'slide.addText', id: mk(), template: 'basic', deck: 'games' }) as Command,
      ),
  },
  {
    id: 'spelling-bee',
    label: 'Spelling Bee',
    // Just one slide: a single Comic-Sans headline (the word to spell) on a chalkboard.
    build: (mk) => [
      { type: 'slide.addText', id: mk(), template: 'basic', deck: 'games', theme: 'spellingbee' } as Command,
    ],
  },
]

// The scripted show-intro beats: the label shown on the card / add-menu, and
// which editable field (if any) the operator fills in. Order here is the order
// they're offered in the "add slide" menu — the same as the default sequence.
const SHOW_BEAT_META: Record<ShowBeat, { label: string; field?: 'name' | 'roster'; hint: string }> = {
  ref: { label: 'Welcome your ref', field: 'name', hint: "Referee's name" },
  logo: { label: 'ComedySportz logo', hint: 'Big logo reveal' },
  players: { label: 'Welcome your players', hint: 'Dual red / blue' },
  'team-blue': { label: 'Welcome the Blue team', field: 'roster', hint: 'One player per line' },
  'team-red': { label: 'Welcome the Red team', field: 'roster', hint: 'One player per line' },
  blackout: { label: 'Blackout', hint: 'A beat of black' },
  captains: { label: 'Captains on the field', hint: 'Dual red / blue' },
  'captain-blue': { label: 'Blue captain', field: 'name', hint: "Captain's name" },
  'captain-red': { label: 'Red captain', field: 'name', hint: "Captain's name" },
}
const SHOW_BEAT_ORDER: ShowBeat[] = [
  'ref',
  'logo',
  'players',
  'team-blue',
  'team-red',
  'blackout',
  'captains',
  'captain-blue',
  'captain-red',
]

const newSlideId = (p: string) =>
  `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// One deck (Show or Games): logo/text/image/slideshow slides in a selectable,
// reorderable list, plus an "add slide" menu. Same machinery for both decks —
// they differ only in which slides they hold (filtered by `deck`).
function SlidesConfig({ deck }: { deck: SlideDeck }) {
  const dispatch = useDispatch()
  // Select the stable array (a filtered selector would break useSyncExternalStore),
  // then derive this deck's slides in the body.
  const items = useAppState((s) => s.slides.items).filter((sl) => sl.deck === deck)
  const selectedId = useAppState((s) => s.slides.selectedId)
  const programScene = useAppState((s) => s.scene)
  const liveId = useAppState((s) => s.slides.live?.id ?? null)
  const [addOpen, setAddOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // Drag-to-reorder is driven by a LOCAL id order so the drag stays smooth
  // (no IPC round-trip per move); we persist to the store on drop. `order` holds
  // ids, not slide objects, so edits to a slide always render fresh from `items`.
  const [order, setOrder] = useState<string[]>(() => items.map((s) => s.id))
  const orderRef = useRef(order)
  orderRef.current = order
  const itemsById = new Map(items.map((s) => [s.id, s]))
  // Resync only when the SET of ids changes (add/remove) — never mid-drag or on a
  // pure reorder echo, which would clobber the order the operator is dragging.
  const idSetKey = [...items.map((s) => s.id)].sort().join(',')
  useEffect(() => {
    setOrder((prev) => {
      const live = new Set(items.map((s) => s.id))
      const kept = prev.filter((id) => live.has(id))
      const added = items.map((s) => s.id).filter((id) => !prev.includes(id))
      return [...kept, ...added]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idSetKey])

  const commitOrder = () => dispatch({ type: 'slide.reorder', ids: orderRef.current })

  // Load a game template: REPLACE this deck with the game's slides (clear first,
  // so picking games doesn't pile them up), then select the first. To build by
  // hand instead, skip the picker and use "add slide" below.
  function loadGame(game: (typeof GAMES)[number]) {
    dispatch({ type: 'slide.clearDeck', deck })
    const ids: string[] = []
    game.build(() => {
      const id = newSlideId('game')
      ids.push(id)
      return id
    }).forEach(dispatch)
    if (ids[0]) dispatch({ type: 'slide.select', id: ids[0] })
  }

  async function onFiles(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      try {
        const src = await fileToLogoSrc(file)
        dispatch({ type: 'slide.addLogo', id: newSlideId('logo'), name: file.name.replace(/\.[^.]+$/, ''), src, deck })
      } catch (err) {
        console.warn('[slide] could not read image; skipping:', err)
      }
    }
    setAddOpen(false)
  }

  return (
    <div className="cards">
      {deck === 'games' && (
        <select
          className="game-picker"
          value=""
          aria-label="Choose a game"
          onChange={(e) => {
            const game = GAMES.find((g) => g.id === e.target.value)
            if (game) loadGame(game)
          }}
        >
          <option value="" disabled>
            Choose a game…
          </option>
          {GAMES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      )}
      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="slide-list" as="div">
        <AnimatePresence initial={false}>
          {order.map((id, i) => {
            const slide = itemsById.get(id)
            if (!slide) return null
            return (
              <SlideRow
                key={id}
                id={id}
                index={i}
                selected={id === selectedId}
                onSelect={() => dispatch({ type: 'slide.select', id })}
                onDrop={commitOrder}
              >
                {slide.type === 'logo' && <LogoSlideCard slide={slide} selected={slide.id === selectedId} />}
                {slide.type === 'image' && <ImageSlideCard slide={slide} selected={slide.id === selectedId} />}
                {slide.type === 'slideshow' && (
                  <SlideshowSlideCard slide={slide} selected={slide.id === selectedId} />
                )}
                {slide.type === 'show' && <ShowSlideCard slide={slide} selected={slide.id === selectedId} />}
                {slide.type === 'text' && (
                  <TextSlideCard
                    slide={slide}
                    selected={slide.id === selectedId}
                    isOnAir={programScene === 'slides' && liveId === slide.id}
                  />
                )}
              </SlideRow>
            )
          })}
        </AnimatePresence>
      </Reorder.Group>

      {addOpen ? (
        <div className="slide-add">
          {deck === 'show' && (
            <>
              <span className="slide-add__label">Show beats</span>
              {SHOW_BEAT_ORDER.map((beat) => (
                <button
                  key={beat}
                  className="slide-add__item"
                  onClick={() => {
                    dispatch({ type: 'slide.addShow', id: newSlideId('show'), beat, deck })
                    setAddOpen(false)
                  }}
                >
                  {SHOW_BEAT_META[beat].label}
                </button>
              ))}
              <span className="slide-add__label">Other slides</span>
            </>
          )}
          {deck !== 'show' && <span className="slide-add__label">Add a slide</span>}
          {LOGO_PRESETS.map((p) => (
            <button
              key={p.name}
              className="slide-add__item"
              onClick={() => {
                dispatch({ type: 'slide.addLogo', id: newSlideId('logo'), name: p.name, src: p.src, deck })
                setAddOpen(false)
              }}
            >
              {p.name} logo
            </button>
          ))}
          <button className="slide-add__item" onClick={() => fileInput.current?.click()}>
            Upload logo…
          </button>
          <button
            className="slide-add__item"
            onClick={() => {
              dispatch({ type: 'slide.addImage', id: newSlideId('image'), deck })
              setAddOpen(false)
            }}
          >
            Image — drag one in
          </button>
          <button
            className="slide-add__item"
            onClick={() => {
              dispatch({ type: 'slide.addText', id: newSlideId('text'), template: 'basic', deck })
              setAddOpen(false)
            }}
          >
            Text — headline + body
          </button>
          <button
            className="slide-add__item"
            onClick={() => {
              dispatch({ type: 'slide.addText', id: newSlideId('text'), template: 'quadrants', deck })
              setAddOpen(false)
            }}
          >
            Text — four quadrants
          </button>
          <button
            className="slide-add__item"
            onClick={() => {
              dispatch({ type: 'slide.addSlideshow', id: newSlideId('show'), deck })
              setAddOpen(false)
            }}
          >
            Slideshow — Google Slides link
          </button>
          <button className="slide-add__cancel" onClick={() => setAddOpen(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="add-card" onClick={() => setAddOpen(true)}>
          + Add slide
        </button>
      )}

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

// One reorderable row: a grip rail (the bold slide number, which is also the
// drag handle) beside the slide's card. Dragging starts ONLY from the grip
// (dragListener off + explicit controls), so it never fights a card's click-to-
// select or the image card's drop zone. The order persists on drop.
function SlideRow({
  id,
  index,
  selected,
  onSelect,
  onDrop,
  children,
}: {
  id: string
  index: number
  selected: boolean
  onSelect: () => void
  onDrop: () => void
  children: ReactNode
}) {
  const controls = useDragControls()
  // Tap vs drag on the grip. Start the drag on POINTERDOWN via the controls, so
  // Motion owns the gesture and always releases it cleanly on pointerup (no
  // sticky drag). Motion's onDrag fires only on real movement → that marks it a
  // drag. We decide tap-vs-drag on the raw pointerup (which ALWAYS fires, unlike
  // Motion's onDragEnd, which skips a zero-distance gesture): no movement → tap
  // → select the card.
  const moved = useRef(false)
  return (
    <Reorder.Item
      value={id}
      as="div"
      dragListener={false}
      dragControls={controls}
      onDrag={() => {
        moved.current = true
      }}
      onDragEnd={onDrop}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      className="slide-row"
    >
      <div
        className={`slide-row__grip ${selected ? 'slide-row__grip--active' : ''}`}
        onPointerDown={(e) => {
          moved.current = false
          controls.start(e)
          const cleanup = () => {
            window.removeEventListener('pointerup', onUp)
            window.removeEventListener('pointercancel', cleanup)
          }
          const onUp = () => {
            cleanup()
            if (!moved.current) onSelect() // released without dragging → a tap
          }
          window.addEventListener('pointerup', onUp)
          window.addEventListener('pointercancel', cleanup)
        }}
        title="Tap to select · drag to reorder"
      >
        <span className="slide-row__num">{index + 1}</span>
        <span className="slide-row__dots" aria-hidden="true">⠿</span>
      </div>
      <div className="slide-row__body">{children}</div>
    </Reorder.Item>
  )
}

function LogoSlideCard({ slide, selected }: { slide: LogoSlide; selected: boolean }) {
  const dispatch = useDispatch()
  const [confirming, setConfirming] = useState(false)
  return (
    <div
      className={`logo-card ${selected ? 'logo-card--active' : ''}`}
      onClick={() => dispatch({ type: 'slide.select', id: slide.id })}
    >
      <div className="logo-card__preview">
        <img src={logoImgSrc(slide.src)} alt={slide.name} />
      </div>
      <input
        className="logo-card__site"
        type="text"
        value={slide.website}
        placeholder="website (shown under the logo)"
        aria-label={`${slide.name} website`}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => dispatch({ type: 'slide.setWebsite', id: slide.id, website: e.target.value })}
      />
      <button
        className="logo-card__remove"
        aria-label={`Remove ${slide.name}`}
        onClick={(e) => {
          e.stopPropagation()
          setConfirming(true)
        }}
      >
        ✕
      </button>
      {confirming && (
        <div className="logo-card__confirm" onClick={(e) => e.stopPropagation()}>
          <span className="logo-card__confirm-q">Remove this slide?</span>
          <div className="logo-card__confirm-row">
            <button
              className="logo-card__confirm-yes"
              onClick={() => {
                dispatch({ type: 'slide.remove', id: slide.id })
                setConfirming(false)
              }}
            >
              Remove
            </button>
            <button className="logo-card__confirm-no" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ImageSlideCard({ slide, selected }: { slide: ImageSlide; selected: boolean }) {
  const dispatch = useDispatch()
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const setSrc = (src: string) => dispatch({ type: 'slide.setImage', id: slide.id, src })

  // Handle a drop: a local image file, or an image URL dragged from a website.
  async function ingest(dt: DataTransfer) {
    setBusy(true)
    try {
      const file = Array.from(dt.files).find((f) => f.type.startsWith('image/'))
      if (file) {
        setSrc(await fileToImageSrc(file))
        return
      }
      const url = (dt.getData('text/uri-list') || dt.getData('text/plain')).trim()
      if (url) setSrc(await urlToImageSrc(url))
    } catch (err) {
      console.warn('[slide] could not load dropped image:', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`image-card ${selected ? 'image-card--active' : ''} ${dragOver ? 'image-card--drag' : ''}`}
      onClick={() => dispatch({ type: 'slide.select', id: slide.id })}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        void ingest(e.dataTransfer)
      }}
    >
      {slide.src ? (
        <div className="image-card__preview">
          <img src={slide.src} alt="" />
        </div>
      ) : (
        <button
          className="image-card__drop"
          onClick={(e) => {
            e.stopPropagation()
            fileInput.current?.click()
          }}
        >
          {busy ? 'Loading…' : 'Drag an image here'}
          <span className="image-card__hint">from your desktop or a website — or click to choose</span>
        </button>
      )}
      {slide.src && (
        <button
          className="image-card__replace"
          onClick={(e) => {
            e.stopPropagation()
            fileInput.current?.click()
          }}
        >
          {busy ? 'Loading…' : 'Replace'}
        </button>
      )}
      <button
        className="text-card__remove image-card__remove"
        aria-label="Remove slide"
        onClick={(e) => {
          e.stopPropagation()
          setConfirming(true)
        }}
      >
        ✕
      </button>
      {confirming && (
        <div className="logo-card__confirm" onClick={(e) => e.stopPropagation()}>
          <span className="logo-card__confirm-q">Remove this slide?</span>
          <div className="logo-card__confirm-row">
            <button
              className="logo-card__confirm-yes"
              onClick={() => {
                dispatch({ type: 'slide.remove', id: slide.id })
                setConfirming(false)
              }}
            >
              Remove
            </button>
            <button className="logo-card__confirm-no" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            setBusy(true)
            void fileToImageSrc(f)
              .then(setSrc)
              .finally(() => setBusy(false))
          }
          e.target.value = ''
        }}
      />
    </div>
  )
}

function TextSlideCard({
  slide,
  selected,
  isOnAir,
}: {
  slide: TextSlide
  selected: boolean
  isOnAir: boolean
}) {
  const dispatch = useDispatch()
  // When live-type is on and this slide is on air, republish on every edit so
  // keystrokes mirror to the projector.
  const commitIfLive = () => {
    if (slide.liveType && isOnAir) dispatch({ type: 'slide.commit' })
  }
  const setField = (field: 'headline' | 'body', value: string) => {
    dispatch({ type: 'slide.setField', id: slide.id, field, value })
    commitIfLive()
  }
  const setQuad = (index: number, value: string) => {
    dispatch({ type: 'slide.setQuad', id: slide.id, index, value })
    commitIfLive()
  }
  return (
    <div
      className={`text-card ${selected ? 'text-card--active' : ''}`}
      onClick={() => dispatch({ type: 'slide.select', id: slide.id })}
    >
      <div className="text-card__head">
        <label
          className="text-card__livetoggle switch"
          title="Live type: mirror keystrokes to the screen while this slide is on air"
          onClick={(e) => e.stopPropagation()}
        >
          <span className={`text-card__livelabel ${slide.liveType ? 'is-on' : ''}`}>
            {slide.liveType && isOnAir ? '● LIVE' : 'Live'}
          </span>
          <input
            type="checkbox"
            checked={slide.liveType}
            onChange={(e) => dispatch({ type: 'slide.setLiveType', id: slide.id, value: e.target.checked })}
          />
          <span className="switch__track">
            <span className="switch__thumb" />
          </span>
        </label>
        <button
          className="text-card__remove"
          aria-label="Remove slide"
          onClick={(e) => {
            e.stopPropagation()
            dispatch({ type: 'slide.remove', id: slide.id })
          }}
        >
          ✕
        </button>
      </div>

      <select
        className="text-card__template"
        value={slide.template}
        aria-label="Slide layout"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) =>
          dispatch({ type: 'slide.setTemplate', id: slide.id, template: e.target.value as TextTemplate })
        }
      >
        {TEMPLATE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {slide.template === 'basic' && (
        <>
          <textarea
            className="text-card__headline"
            value={slide.headline}
            placeholder="Headline (e.g. Skiing)"
            aria-label="Headline"
            rows={1}
            onChange={(e) => setField('headline', e.target.value)}
          />
          <textarea
            className="text-card__body"
            value={slide.body}
            placeholder={'Body — press Return for a new line\n(e.g. but with pizza sauce)'}
            aria-label="Body"
            rows={1}
            onChange={(e) => setField('body', e.target.value)}
          />
        </>
      )}

      {slide.template === 'quadrants' && (
        <div className="quad-inputs">
          {(['Top left', 'Top right', 'Bottom left', 'Bottom right'] as const).map((label, i) => (
            <input
              key={i}
              className="text-card__quad"
              value={slide.quads[i]}
              placeholder={label}
              aria-label={label}
              onChange={(e) => setQuad(i, e.target.value)}
            />
          ))}
        </div>
      )}

      {slide.liveType && (
        <span className="text-card__hint">
          {isOnAir
            ? 'Live — every keystroke shows on the projector.'
            : 'Reveal to put this on air, then it types live.'}
        </span>
      )}
    </div>
  )
}

// A slideshow slide: holds one published Google Slides embed link. Reveal plays
// it; Black stops it. (The old Pre-show tab, folded in as a slide type.)
// A scripted show-intro beat in the deck: a labeled card with the beat's name,
// plus its one editable field (a name, a roster, or nothing) inline.
function ShowSlideCard({ slide, selected }: { slide: ShowSlide; selected: boolean }) {
  const dispatch = useDispatch()
  const [confirming, setConfirming] = useState(false)
  const library = useAppState((s) => s.music.library)
  const meta = SHOW_BEAT_META[slide.beat]
  // Merge the effect into the cue (''/none clears it; the reducer drops an empty cue).
  const setCueEffect = (value: string) =>
    dispatch({ type: 'slide.setCue', id: slide.id, cue: { ...slide.cue, effect: value || undefined } })
  // Music is three-way: Continue (''), No music (stop), or a specific track.
  // Rebuild the cue so trackId and silence stay mutually exclusive.
  const setCueMusic = (value: string) => {
    const base: { effect?: string } = { effect: slide.cue?.effect }
    const cue =
      value === CUE_SILENCE
        ? { ...base, silence: true }
        : value
          ? { ...base, trackId: value }
          : base
    dispatch({ type: 'slide.setCue', id: slide.id, cue })
  }
  const musicValue = slide.cue?.silence ? CUE_SILENCE : (slide.cue?.trackId ?? '')
  const teamCls = slide.beat.endsWith('blue') ? 'show-card--blue' : slide.beat.endsWith('red') ? 'show-card--red' : ''
  // The roster is stored as newline-joined names; the team beats edit it as four
  // positional slots (a 2×2 grid). Empty slots stay as blank lines so positions
  // are preserved; the projector filters empties out.
  const rosterSlots = [0, 1, 2, 3].map((i) => slide.roster.split('\n')[i] ?? '')
  const setRosterSlot = (i: number, value: string) => {
    const next = rosterSlots.map((v, j) => (j === i ? value : v)).join('\n')
    dispatch({ type: 'slide.setShowField', id: slide.id, field: 'roster', value: next })
  }
  return (
    <div
      className={`logo-card show-card ${teamCls} ${selected ? 'logo-card--active' : ''}`}
      onClick={() => dispatch({ type: 'slide.select', id: slide.id })}
    >
      <div className="show-card__head">
        <span className="show-card__label">{meta.label}</span>
        {!meta.field && <span className="show-card__hint">{meta.hint}</span>}
      </div>
      {meta.field === 'name' && (
        <input
          className="logo-card__site"
          type="text"
          value={slide.name}
          placeholder={meta.hint}
          aria-label={meta.hint}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => dispatch({ type: 'slide.setShowField', id: slide.id, field: 'name', value: e.target.value })}
        />
      )}
      {meta.field === 'roster' && (
        <div className="show-card__roster-grid" onClick={(e) => e.stopPropagation()}>
          {rosterSlots.map((v, i) => (
            <input
              key={i}
              className="logo-card__site"
              type="text"
              value={v}
              placeholder={`Player ${i + 1}`}
              aria-label={`Player ${i + 1}`}
              onChange={(e) => setRosterSlot(i, e.target.value)}
            />
          ))}
        </div>
      )}
      <div className="show-cue" onClick={(e) => e.stopPropagation()}>
        <select
          className="show-cue__select"
          aria-label="Reveal effect"
          value={slide.cue?.effect ?? ''}
          onChange={(e) => setCueEffect(e.target.value)}
        >
          <option value="">✨ No effect</option>
          {CUE_EFFECT_OPTIONS.map((fx) => (
            <option key={fx.kind} value={fx.kind}>
              {fx.icon} {fx.title}
            </option>
          ))}
        </select>
        <select
          className="show-cue__select"
          aria-label="Reveal music"
          value={musicValue}
          onChange={(e) => setCueMusic(e.target.value)}
          title="Continue the current song, stop it, or start a specific one on reveal"
        >
          <option value="">⏸ Continue current music</option>
          <option value={CUE_SILENCE}>🔇 No music (fade out)</option>
          {library.map((t) => (
            <option key={t.id} value={t.id}>
              🎵 {t.name}
            </option>
          ))}
          {library.length === 0 && (
            <option value="" disabled>
              — no tracks loaded —
            </option>
          )}
        </select>
      </div>
      <button
        className="logo-card__remove"
        aria-label="Remove show beat"
        onClick={(e) => {
          e.stopPropagation()
          setConfirming(true)
        }}
      >
        ✕
      </button>
      {confirming && (
        <div className="logo-card__confirm" onClick={(e) => e.stopPropagation()}>
          <span className="logo-card__confirm-q">Remove this beat?</span>
          <div className="logo-card__confirm-row">
            <button
              className="logo-card__confirm-yes"
              onClick={() => {
                dispatch({ type: 'slide.remove', id: slide.id })
                setConfirming(false)
              }}
            >
              Remove
            </button>
            <button className="logo-card__confirm-no" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SlideshowSlideCard({ slide, selected }: { slide: SlideshowSlide; selected: boolean }) {
  const dispatch = useDispatch()
  const [confirming, setConfirming] = useState(false)
  return (
    <div
      className={`logo-card ${selected ? 'logo-card--active' : ''}`}
      onClick={() => dispatch({ type: 'slide.select', id: slide.id })}
    >
      <div className="logo-card__preview slideshow-card__preview">
        <span className="slideshow-card__tag">▶ Slideshow</span>
      </div>
      <input
        className="logo-card__site"
        type="text"
        value={slide.url}
        placeholder="Published Google Slides link (…/pub?start=true&loop=true)"
        aria-label="Slideshow link"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => dispatch({ type: 'slide.setSlideshowUrl', id: slide.id, url: e.target.value })}
      />
      <button
        className="logo-card__remove"
        aria-label="Remove slideshow slide"
        onClick={(e) => {
          e.stopPropagation()
          setConfirming(true)
        }}
      >
        ✕
      </button>
      {confirming && (
        <div className="logo-card__confirm" onClick={(e) => e.stopPropagation()}>
          <span className="logo-card__confirm-q">Remove this slide?</span>
          <div className="logo-card__confirm-row">
            <button
              className="logo-card__confirm-yes"
              onClick={() => {
                dispatch({ type: 'slide.remove', id: slide.id })
                setConfirming(false)
              }}
            >
              Remove
            </button>
            <button className="logo-card__confirm-no" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
