// The soundboard window. M2 is the shell: it proves the library scan arrives
// here and gives the folder a home. Search, tagging and pads land on top of
// this in M3/M4.
//
// This window never plays audio. It dispatches, and the operator window's audio
// controller does the playing — one song at a time, and closing this window
// can't cut the music.

import { useSoundLibrary } from './useSoundLibrary'

export function SoundApp() {
  const { folder, tracks, tags } = useSoundLibrary()
  const bridge = window.showboard

  return (
    <div className="sound">
      <header className="sound__topbar">
        <h1>Sound</h1>
        <div className="sound__folder">
          <button className="pill" onClick={() => bridge?.chooseSoundFolder()}>
            Sound library folder…
          </button>
          <span className="sound__status">
            {tracks.length === 0
              ? 'no songs found'
              : `${tracks.length} song${tracks.length === 1 ? '' : 's'}`}
            {tags.length > 0 && ` · ${tags.length} tag${tags.length === 1 ? '' : 's'}`}
            {folder && ` · ${folder}`}
          </span>
        </div>
      </header>

      <div className="sound__body">
        {tracks.length === 0 ? (
          <p className="sound__empty">
            Choose a folder above. Subfolders are included, so you can point this at the
            folder that holds your existing music folders and get everything at once.
          </p>
        ) : (
          <ul className="sound__list">
            {tracks.map((track) => (
              <li key={track.id} className="sound__row">
                <span className="sound__name">{track.name}</span>
                <span className="sound__tags">
                  {track.tags.map((tag) => (
                    <span key={tag} className="sound__tag">
                      {tag}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
