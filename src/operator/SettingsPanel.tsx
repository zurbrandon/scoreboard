// Global settings overlay — app-wide config that isn't tied to a single scene.
// Two tabs: Visuals (everything on screen) and Audio (where sound comes from and
// how loud). Opened from the gear in the operator header.

import { useState } from 'react'
import { MusicPanel, PlaybackControls } from './MusicPanel'
import { MomentMusicPanel } from './MomentMusicPanel'
import { DrumrollPicker } from './DrumrollPicker'
import { ProjectorDisplayPicker } from './ProjectorDisplayPicker'
import { SlideshowLibraryPanel } from './SlideshowLibraryPanel'
import { ScoreboardLogosPanel } from './ScoreboardLogosPanel'

type SettingsTab = 'visuals' | 'audio'

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<SettingsTab>('visuals')
  const isElectron = !!window.showboard

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-panel__header">
          <h2>Settings</h2>
          <button className="pill" onClick={onClose}>
            Done
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${tab === 'visuals' ? 'settings-tab--active' : ''}`}
            onClick={() => setTab('visuals')}
          >
            Visuals
          </button>
          <button
            className={`settings-tab ${tab === 'audio' ? 'settings-tab--active' : ''}`}
            onClick={() => setTab('audio')}
          >
            Audio
          </button>
        </div>

        {tab === 'visuals' && (
          <>
            <section className="settings-section">
              <h3>Scoreboard logos</h3>
              <ScoreboardLogosPanel />
            </section>

            <section className="settings-section">
              <h3>Slideshows</h3>
              <SlideshowLibraryPanel />
            </section>

            {isElectron && (
              <section className="settings-section">
                <h3>Projector</h3>
                <ProjectorDisplayPicker />
                <span className="music-panel__status">
                  Choose which display the projector fullscreens onto.
                </span>
              </section>
            )}
          </>
        )}

        {tab === 'audio' && (
          <>
            <section className="settings-section">
              <h3>Music folders</h3>
              <MusicPanel />
              {isElectron && <MomentMusicPanel />}
              {isElectron && <DrumrollPicker />}
              <span className="music-panel__status">
                {isElectron
                  ? 'Score music plays on reveals; run-out / run-in each play a random song from their folder.'
                  : 'Load a set of bumper MP3s to play on reveals.'}
              </span>
            </section>

            <section className="settings-section">
              <h3>Playback</h3>
              <PlaybackControls />
            </section>
          </>
        )}
      </div>
    </div>
  )
}
