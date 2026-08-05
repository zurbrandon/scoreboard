// Operator's bumper controls. Two ways to load bumpers depending on host:
//   • Electron: choose a music folder (persisted); main scans and pushes tracks.
//   • Browser (dev): pick MP3 files directly (object URLs).
// Everything else — sound-check, volume, music-on-reveal, status — is shared.

import { useEffect, useRef, useState } from 'react'
import { useAppState, useDispatch } from '../store/react'
import { useAudio } from '../services/audioContext'

export function MusicPanel() {
  const dispatch = useDispatch()
  const audio = useAudio()
  const music = useAppState((s) => s.music)
  const fileInput = useRef<HTMLInputElement>(null)
  const [folder, setFolder] = useState<string | null>(null)

  const bridge = window.showboard
  const isElectron = !!bridge

  // Electron: receive tracks scanned from the chosen folder and load them.
  useEffect(() => {
    if (!bridge) return
    const off = bridge.onTracks(({ folder: f, tracks }) => {
      setFolder(f)
      audio.setTracks(tracks)
    })
    bridge.requestTracks() // ask for whatever folder was persisted
    return off
  }, [bridge, audio])

  function loadBumpers() {
    if (bridge) bridge.chooseMusicFolder()
    else fileInput.current?.click()
  }

  const folderLabel = folder ? folder.split('/').pop() : null

  return (
    <div className="extra music-panel">
      <div className="music-panel__row">
        <button className="pill" onClick={loadBumpers}>
          {isElectron ? 'Choose music folder…' : 'Load bumpers…'}
        </button>
        {!isElectron && (
          <input
            ref={fileInput}
            type="file"
            accept="audio/*"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              audio.setTracks(
                files.map((f, i) => ({
                  id: `${i}:${f.name}`,
                  name: f.name.replace(/\.[^.]+$/, ''),
                  url: URL.createObjectURL(f),
                })),
              )
              e.target.value = ''
            }}
          />
        )}
        <button className="pill" disabled={music.librarySize === 0} onClick={() => audio.test()}>
          ▶ Test
        </button>
        <span className="music-panel__status">
          {music.librarySize === 0
            ? 'no bumpers loaded'
            : `${music.librarySize} bumper${music.librarySize === 1 ? '' : 's'}`}
          {folderLabel && ` · ${folderLabel}`}
          {music.lastTrackName && ` · last: ${music.lastTrackName}`}
        </span>
      </div>

      <div className="music-panel__row">
        <label className="extra__label" htmlFor="vol">
          Volume
        </label>
        <input
          id="vol"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={music.volume}
          onChange={(e) => dispatch({ type: 'music.setVolume', volume: Number(e.target.value) })}
        />
        <label className="extra__checkbox">
          <input
            type="checkbox"
            checked={music.enabled}
            onChange={(e) => dispatch({ type: 'music.setEnabled', enabled: e.target.checked })}
          />
          music on reveal
        </label>
      </div>
    </div>
  )
}
