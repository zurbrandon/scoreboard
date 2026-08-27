import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createStore } from './store/store'
import { StoreProvider } from './store/react'
import { attachRevealService } from './services/revealService'
import { attachGifOverlayService } from './services/gifOverlayService'
import { createAudioController } from './services/audioController'
import { attachSoundProgress } from './services/soundProgressService'
import { AudioProvider } from './services/audioContext'
import { OperatorApp } from './operator/OperatorApp'
import { ProjectorApp } from './projector/ProjectorApp'
import { SoundApp } from './sound/SoundApp'
import './styles.css'

// One build serves all three windows. The view is chosen by ?view=projector or
// ?view=sound. Default is the operator (the technician's control surface).
const params = new URLSearchParams(window.location.search)
const view = params.get('view')
const isProjector = view === 'projector'
const isSound = view === 'sound'
const role = isProjector ? 'projector' : isSound ? 'sound' : 'operator'

const store = createStore(role)
if (import.meta.env.DEV) (window as unknown as { __store: typeof store }).__store = store
document.title = isProjector
  ? 'Showboard — Projector'
  : isSound
    ? 'Showboard — Sound'
    : 'Showboard — Operator'

// The reveal sequence is timed by the authority (operator). The projector only
// observes revealPhase, so it must never run these services. Audio plays from
// the operator window alone — the soundboard window asks for playback by
// dispatching, so exactly one song can ever be sounding and closing that window
// never cuts the music.
const audio = role === 'operator' ? createAudioController(store) : null
if (import.meta.env.DEV && audio) (window as unknown as { __audio: typeof audio }).__audio = audio
if (role === 'operator') attachRevealService(store)
if (role === 'operator') attachGifOverlayService(store)

// In Electron, auto-load the persisted music folder's bumpers at startup so
// they're ready no matter whether the Settings panel is open. (The operator's
// MusicPanel only mounts while Settings is open, so loading can't live there.)
if (audio && window.showboard) {
  window.showboard.onTracks((update) => audio.setTracks(update.tracks))
  window.showboard.requestTracks()
  window.showboard.onDrumroll((update) => audio.setDrumroll(update.track))
  window.showboard.requestDrumroll()
  window.showboard.onMomentTracks((update) => audio.setMomentTracks(update.kind, update.tracks))
  window.showboard.requestMomentTracks()
  // The soundboard window dispatches cues; this window is what plays them, so
  // it needs the library even though it never shows it.
  window.showboard.onSoundLibrary((update) => audio.setSoundTracks(update.tracks))
  window.showboard.requestSoundLibrary()
  // Tell the soundboard window what's sounding, so its now-playing bar can show
  // a song this window started.
  attachSoundProgress(audio, window.showboard)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={store}>
      {isSound ? (
        <SoundApp />
      ) : isProjector || !audio ? (
        <ProjectorApp />
      ) : (
        <AudioProvider controller={audio}>
          <OperatorApp />
        </AudioProvider>
      )}
    </StoreProvider>
  </StrictMode>,
)
