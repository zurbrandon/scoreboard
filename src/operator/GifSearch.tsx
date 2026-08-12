// GIF search: a corner button (bottom-left, mirroring the effects sparkle) that
// opens a live Giphy search. Opening focuses the field; typing live-searches;
// clicking a result overlays that GIF on the projector on top of whatever's
// showing. Stays open so you can swap GIFs; click-away closes.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useAppState, useDispatch } from '../store/react'
import { giphyReady, searchGifs, type Gif } from '../services/giphy'

export function GifSearch() {
  const dispatch = useDispatch()
  const overlay = useAppState((s) => s.gifOverlay)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Gif[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the search field the moment the popover opens.
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Click-away closes.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Live search, debounced. Empty query → trending, so it's never blank on open.
  useEffect(() => {
    if (!open) return
    const ac = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        setResults(await searchGifs(query, ac.signal))
      } catch (err) {
        if (!ac.signal.aborted) {
          console.warn('[gif] search failed:', err)
          setError(giphyReady ? 'Search failed' : 'No Giphy API key set')
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }, 300)
    return () => {
      clearTimeout(t)
      ac.abort()
    }
  }, [query, open])

  return (
    <div className="gif-search" ref={rootRef}>
      {open && (
        <div className="gif-pop">
          <div className="gif-pop__bar">
            <input
              ref={inputRef}
              className="gif-pop__input"
              type="text"
              placeholder="Search GIFs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {overlay && (
              <button className="gif-pop__clear" onClick={() => dispatch({ type: 'gif.overlay', src: null })}>
                Clear
              </button>
            )}
          </div>
          <div className="gif-pop__grid">
            {results.map((g) => (
              <button
                key={g.id}
                className={`gif-pop__item ${overlay === g.full ? 'gif-pop__item--live' : ''}`}
                title={g.title}
                onClick={() => dispatch({ type: 'gif.overlay', src: g.full })}
              >
                <img src={g.preview} alt={g.title} loading="lazy" />
              </button>
            ))}
            {results.length === 0 && (
              <div className="gif-pop__msg">{error ?? (loading ? 'Searching…' : 'No results')}</div>
            )}
          </div>
        </div>
      )}
      <button
        className={`gif-fab__btn ${open ? 'gif-fab__btn--open' : ''}`}
        aria-label={open ? 'Close GIF search' : 'Search GIFs'}
        title={open ? 'Close' : 'Search GIFs'}
        onClick={() => setOpen((v) => !v)}
      >
        <AnimatePresence initial={false}>
          <motion.span
            key={open ? 'x' : 'icon'}
            className={`fab-icon ${open ? 'fab-icon--x' : ''}`}
            initial={{ rotate: -135, scale: 0.3, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 135, scale: 0.3, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 1.2, 0.4, 1] }}
          >
            {open ? '✕' : '🖼️'}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  )
}
