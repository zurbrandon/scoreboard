// Global settings overlay — app-wide config that isn't tied to a single scene.
// For now: bumper music and (in Electron) the projector display. Room to grow
// into defaults/presets later. Opened from the gear in the operator header.

import { MusicPanel } from './MusicPanel'
import { ProjectorDisplayPicker } from './ProjectorDisplayPicker'

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
