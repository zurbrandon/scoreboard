// The technician's control surface: a narrow column with scene tabs on top,
// the active scene's config in the middle, and a persistent reveal deck pinned
// to the bottom. Preview/Program: picking a tab only previews a scene; the deck
// (Reveal / update silently / Black) is what actually changes the projector.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, Reorder, useDragControls } from 'motion/react'
import { MdScoreboard, MdViewCarousel, MdSlideshow } from 'react-icons/md'
import type { IconType } from 'react-icons'
import { useAppState, useDispatch } from '../store/react'
import { teamOnSide } from '../core/sides'
import { LOGO_LIBRARY } from '../core/logos'
import type { ImageSlide, LogoSlide, Scene, TextSlide, TextTemplate } from '../core/state'
import { TeamControl } from './TeamControl'
import { SettingsPanel } from './SettingsPanel'
import { useOperatorKeyboard } from './useOperatorKeyboard'

const SCENE_TABS: { scene: Scene; label: string; Icon: IconType }[] = [
  { scene: 'scoreboard', label: 'Score', Icon: MdScoreboard },
  { scene: 'slides', label: 'Slides', Icon: MdViewCarousel },
  { scene: 'slideshow', label: 'Pre-show', Icon: MdSlideshow },
]

const ON_AIR_LABEL: Record<Scene, string> = {
  scoreboard: 'Score',
  slides: 'Slides',
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

  // Slides deck: dirty when the selected slide isn't the one that's live. `live`
  // holds the exact committed object, so a reference check catches un-published
  // edits (an edit replaces the item with a new object) and selection changes.
  const slidesDirty = useAppState((s) => {
    const sel = s.slides.items.find((i) => i.id === s.slides.selectedId)
    return !!sel && sel !== s.slides.live
  })
  const slideshowDirty = useAppState((s) => {
    const slide = s.slideshow.slides.find((sl) => sl.id === s.slideshow.selectedId)
    return !slide || slide.url !== s.slideshow.liveUrl
  })
  // A live-type text slide mirrors keystrokes, so its reveal shouldn't animate.
  const selectedSlideIsLiveText = useAppState((s) => {
    const sel = s.slides.items.find((i) => i.id === s.slides.selectedId)
    return sel?.type === 'text' && sel.liveType
  })

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
    } else if (activeTab === 'slides') {
      dispatch({ type: 'slide.commit' })
      const animate = withReveal && !selectedSlideIsLiveText
      dispatch({ type: animate ? 'display.reveal' : 'display.set', scene: 'slides' })
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
    playing && stopArmed && activeTab === 'scoreboard' && programScene === 'scoreboard' && !anyDirty

  // The reveal button's single action: kill a playing reveal, or fire a new one.
  const primaryAction = () => (canStop ? dispatch({ type: 'reveal.stop' }) : reveal())

  useOperatorKeyboard(dispatch, { selectScene: setActiveTab, reveal: primaryAction, black })

  // Latest deck, read at key-press time so "show slide N" always maps to the
  // current ordering (not a value baked in when the effect first ran).
  const slideItems = useAppState((s) => s.slides.items)
  const slidesRef = useRef(slideItems)
  slidesRef.current = slideItems

  // Macro-pad / keyboard global shortcuts (Electron only). Main registers them
  // OS-wide and forwards each press here. We run the EXPLICIT action — not the
  // tab-dependent button logic — and sync the on-screen tab so the operator UI
  // follows whichever folder the pad is on.
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
          setActiveTab('scoreboard')
          dispatch({ type: 'display.set', scene: 'scoreboard' })
          return dispatch({ type: 'score.reveal' })
        case 'silent':
          setActiveTab('scoreboard')
          dispatch({ type: 'display.set', scene: 'scoreboard' })
          return dispatch({ type: 'score.commitSilent' })
        case 'stop':
          return dispatch({ type: 'reveal.stop' })
        case 'black':
          return dispatch({ type: 'display.set', scene: 'black' })
        case 'slide.show': {
          const slide = slidesRef.current[action.index]
          if (!slide) return
          setActiveTab('slides')
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
    activeTab === 'scoreboard'
      ? anyDirty || programScene !== 'scoreboard' || half === 'end'
      : activeTab === 'slides'
        ? programScene !== 'slides' || slidesDirty
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
        {SCENE_TABS.map(({ scene, label, Icon }) => (
          <button
            key={scene}
            className={`scene-tab ${activeTab === scene ? 'scene-tab--active' : ''}`}
            onClick={() => setActiveTab(scene)}
          >
            {activeTab === scene && (
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
        {activeTab === 'scoreboard' && <ScoreboardConfig />}
        {activeTab === 'slides' && <SlidesConfig />}
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

const newSlideId = (p: string) =>
  `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// The unified Slides deck: logo and text slides in one selectable/reorderable
// list, plus an "add slide" menu with presets.
function SlidesConfig() {
  const dispatch = useDispatch()
  const items = useAppState((s) => s.slides.items)
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

  async function onFiles(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      try {
        const src = await fileToLogoSrc(file)
        dispatch({ type: 'slide.addLogo', id: newSlideId('logo'), name: file.name.replace(/\.[^.]+$/, ''), src })
      } catch (err) {
        console.warn('[slide] could not read image; skipping:', err)
      }
    }
    setAddOpen(false)
  }

  return (
    <div className="cards">
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
          <span className="slide-add__label">Add a slide</span>
          {LOGO_PRESETS.map((p) => (
            <button
              key={p.name}
              className="slide-add__item"
              onClick={() => {
                dispatch({ type: 'slide.addLogo', id: newSlideId('logo'), name: p.name, src: p.src })
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
              dispatch({ type: 'slide.addImage', id: newSlideId('image') })
              setAddOpen(false)
            }}
          >
            Image — drag one in
          </button>
          <button
            className="slide-add__item"
            onClick={() => {
              dispatch({ type: 'slide.addText', id: newSlideId('text'), template: 'basic' })
              setAddOpen(false)
            }}
          >
            Text — headline + body
          </button>
          <button
            className="slide-add__item"
            onClick={() => {
              dispatch({ type: 'slide.addText', id: newSlideId('text'), template: 'quadrants' })
              setAddOpen(false)
            }}
          >
            Text — four quadrants
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
