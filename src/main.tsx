import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createStore } from './store/store'
import { StoreProvider } from './store/react'
import { attachRevealService } from './services/revealService'
import { createAudioController } from './services/audioController'
import { AudioProvider } from './services/audioContext'
import { OperatorApp } from './operator/OperatorApp'
import { ProjectorApp } from './projector/ProjectorApp'
import './styles.css'

// One build serves both windows. The view is chosen by ?view=projector.
// Default is the operator (the technician's control surface).
const params = new URLSearchParams(window.location.search)
const isProjector = params.get('view') === 'projector'
const role = isProjector ? 'projector' : 'operator'

const store = createStore(role)
if (import.meta.env.DEV) (window as unknown as { __store: typeof store }).__store = store
document.title = isProjector ? 'Showboard — Projector' : 'Showboard — Operator'

// The reveal sequence is timed by the authority (operator). The projector only
// observes revealPhase, so it must never run these services. Audio plays from
// the operator window, which holds the loaded bumpers.
const audio = role === 'operator' ? createAudioController(store) : null
if (import.meta.env.DEV && audio) (window as unknown as { __audio: typeof audio }).__audio = audio
if (role === 'operator') attachRevealService(store)

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
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={store}>
      {isProjector || !audio ? (
        <ProjectorApp />
      ) : (
        <AudioProvider controller={audio}>
          <OperatorApp />
        </AudioProvider>
      )}
    </StoreProvider>
  </StrictMode>,
)
