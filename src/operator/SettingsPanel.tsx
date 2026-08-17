// Global settings overlay — app-wide config that isn't tied to a single scene.
// For now: bumper music and (in Electron) the projector display. Room to grow
// into defaults/presets later. Opened from the gear in the operator header.

import { MusicPanel } from './MusicPanel'
import { MomentMusicPanel } from './MomentMusicPanel'
import { DrumrollPicker } from './DrumrollPicker'
import { ProjectorDisplayPicker } from './ProjectorDisplayPicker'
import { SlideshowLibraryPanel } from './SlideshowLibraryPanel'

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-panel__header">
          <h2>Settings</h2>
          <button className="pill" onClick={onClose}>
            Done
          </button>
        </div>

        <section className="settings-section">
          <h3>Bumper music</h3>
          <MusicPanel />
        </section>

        <section className="settings-section">
          <h3>Slideshows</h3>
          <SlideshowLibraryPanel />
        </section>

        {window.showboard && (
          <section className="settings-section">
            <h3>Final-score drum roll</h3>
            <DrumrollPicker />
          </section>
        )}

        {window.showboard && (
          <section className="settings-section">
            <h3>Run-out / Run-in music</h3>
            <MomentMusicPanel />
            <span className="music-panel__status">
              A random song from each folder plays on the matching bottom-row button.
            </span>
          </section>
        )}

        {window.showboard && (
          <section className="settings-section">
            <h3>Projector</h3>
            <ProjectorDisplayPicker />
            <span className="music-panel__status">
              Choose which display the projector fullscreens onto.
            </span>
          </section>
        )}
      </div>
    </div>
  )
}
