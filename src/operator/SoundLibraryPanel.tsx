// Settings entry point for the soundboard: choose the library folder and open
// the window. The folder scan recurses, so pointing this at the folder that
// holds the existing music folders yields one library rather than a second one.

import { useSoundLibrary } from '../sound/useSoundLibrary'

export function SoundLibraryPanel() {
  const { folder, tracks, tags } = useSoundLibrary()
  const bridge = window.showboard
  if (!bridge) return null // Electron-only: the scan lives in main

  const folderLabel = folder ? folder.split('/').pop() : null

  return (
    <div className="extra music-panel">
      <div className="music-panel__row">
        <button className="pill" onClick={() => bridge.chooseSoundFolder()}>
          Sound library folder…
        </button>
        <button className="pill" onClick={() => bridge.openSoundWindow()}>
          Open soundboard window
        </button>
      </div>
      <div className="music-panel__row">
        <span className="music-panel__status">
          {tracks.length === 0
            ? 'no songs found'
            : `${tracks.length} song${tracks.length === 1 ? '' : 's'}`}
          {tags.length > 0 && ` · ${tags.length} tag${tags.length === 1 ? '' : 's'}`}
          {folderLabel && ` · ${folderLabel}`}
        </span>
      </div>
    </div>
  )
}
