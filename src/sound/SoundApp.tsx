// The soundboard window. Two surfaces, deliberately unequal:
//
//   • The board — pads, always there, owning the space. This is what a show
//     touches, and ninety percent of the time the song you want is already on it.
//   • Search — a drop-down over the board for the other ten percent: the one
//     specific song you need right now. Click a result and it plays; + puts it on
//     a bank for later.
//
// Tagging lives behind the Library button, in its own full-window mode, because
// it's an hour of work you do once and never during a show.
//
// This window never plays audio itself. It dispatches a cue and the operator
// window's audio controller does the playing, which guarantees one song at a
// time and lets this window be moved or closed mid-show without cutting it.

import { useEffect, useRef, useState } from 'react'
import { useAppState, useDispatch } from '../store/react'
import type { SoundTrackInfo } from '../shared/bridge'
import { useSoundLibrary } from './useSoundLibrary'
import { BankPanel } from './BankPanel'
import { NowPlaying } from './NowPlaying'
import { SearchResults } from './SearchResults'
import { LibraryManager } from './LibraryManager'
import { makePads } from './pads'

export function SoundApp() {
  const { tracks, tags, folder } = useSoundLibrary()
  const banks = useAppState((s) => s.soundBanks)
  const dispatch = useDispatch()

  const [managing, setManaging] = useState(false)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  // Which bank the + on a search result drops onto. Lifted out of the board so
  // search can target it; falls back to the first bank so a deleted one can't
  // leave the panel pointing at nothing.
  const [activeBankId, setActiveBankId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const activeBank = banks.find((b) => b.id === activeBankId) ?? banks[0] ?? null

  function closeSearch() {
    setSearchOpen(false)
    setQuery('')
    searchRef.current?.blur()
  }

  // Escape closes the panel from anywhere, not just from the field. Clicking a
  // result's + moves focus onto that button, and Escape has to keep working
  // there or the way out of search depends on where you last clicked.
  useEffect(() => {
    if (!searchOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen])

  if (managing) {
    return (
      <LibraryManager
        tracks={tracks}
        tags={tags}
        folder={folder}
        activeBank={activeBank}
        onClose={() => setManaging(false)}
      />
    )
  }

  return (
    <div className="sound">
      <header className="sound__topbar">
        <h1>Sound</h1>
        <input
          ref={searchRef}
          className="sound__search"
          value={query}
          placeholder="Search for a song…"
          onFocus={() => setSearchOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setSearchOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeSearch()
          }}
        />
        <button className="pill" onClick={() => setManaging(true)}>
          Library
        </button>
      </header>

      <NowPlaying />

      <div className="sound__board">
        <BankPanel
          banks={banks}
          tracks={tracks}
          activeBankId={activeBank?.id ?? null}
          onSelectBank={setActiveBankId}
        />

        {searchOpen && (
          <>
            {/* Clicking anywhere off the panel closes it, so getting back to the
                pads is never a hunt for a close button. */}
            <div className="results__scrim" onClick={closeSearch} />
            <SearchResults
              tracks={tracks}
              query={query}
              activeBank={activeBank}
              onPickTag={(tag) => {
                setQuery(tag)
                searchRef.current?.focus()
              }}
              onPlay={(track: SoundTrackInfo) => {
                dispatch({ type: 'sound.play', id: track.id })
                closeSearch() // played it; get out of the way
              }}
              onAddToBank={(track: SoundTrackInfo) => {
                if (!activeBank) return
                dispatch({ type: 'soundPad.add', bankId: activeBank.id, pads: makePads([track]) })
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
