// The curated slideshow library (Settings). The owner defines named slideshows
// once — each a published embed URL — and the operator later picks one by name
// on a slideshow slide. Google Slides: publish → …/pub?start=true&loop=true.
// Canva: the Present / autoplay share link now works too (the main process
// strips Canva's frame-blocking headers), as does the …/watch?embed embed (the /watch
// form auto-advances; /view makes viewers click through).

import { useState } from 'react'
import { useAppState, useDispatch } from '../store/react'

const newId = () => `ss-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function SlideshowLibraryPanel() {
  const dispatch = useDispatch()
  const slideshows = useAppState((s) => s.savedSlideshows)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  const add = () => {
    const n = name.trim()
    if (!n) return
    dispatch({ type: 'slideshow.save', id: newId(), name: n, url: url.trim() })
    setName('')
    setUrl('')
  }

  return (
    <div className="extra ss-lib">
      {slideshows.map((s) => (
        <div key={s.id} className="ss-lib__row">
          <input
            className="ss-lib__name"
            value={s.name}
            aria-label="Slideshow name"
            onChange={(e) => dispatch({ type: 'slideshow.update', id: s.id, name: e.target.value, url: s.url })}
          />
          <input
            className="ss-lib__url"
            value={s.url}
            placeholder="Published embed link"
            aria-label="Slideshow link"
            onChange={(e) => dispatch({ type: 'slideshow.update', id: s.id, name: s.name, url: e.target.value })}
          />
          <button
            className="ss-lib__del"
            aria-label={`Delete ${s.name}`}
            title="Delete"
            onClick={() => dispatch({ type: 'slideshow.remove', id: s.id })}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="ss-lib__row ss-lib__row--add">
        <input
          className="ss-lib__name"
          value={name}
          placeholder="Name (e.g. ComedySportz)"
          aria-label="New slideshow name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <input
          className="ss-lib__url"
          value={url}
          placeholder="Published embed link"
          aria-label="New slideshow link"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="pill" disabled={!name.trim()} onClick={add}>
          Add
        </button>
      </div>
      <span className="music-panel__status">
        Google Slides: publish → link ending …/pub?start=true&loop=true. Canva: use the Present / autoplay share
        link (or the …/watch?embed embed link) — both play full-screen on the projector.
      </span>
    </div>
  )
}
