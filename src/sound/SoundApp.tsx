// The soundboard window. Two surfaces, deliberately unequal:
//
//   • The board — pads, always there, owning the space. This is what a show
//     touches, and ninety percent of the time the song you want is already on it.
//   • Search — one of the tabs, for the other ten percent: the one specific
//     song you need right now. Results are pads too, so the window has one
//     interaction model instead of a list sitting on top of a grid. Tap a song
//     and it plays; drag it onto a bank's tab to keep it. Search used to be a
//     hero field above the board, which gave the most prominent real estate in
//     the window to the thing you need least often.
//
// Tagging lives behind the Library button, in its own full-window mode, because
// it's an hour of work you do once and never during a show.
//
// This window never plays audio itself. It dispatches a cue and the operator
// window's audio controller does the playing, which guarantees one song at a
// time and lets this window be moved or closed mid-show without cutting it.

import { useEffect, useMemo, useRef, useState } from 'react'
import { MdClose } from 'react-icons/md'
import { useAppState, useDispatch } from '../store/react'

import { useSoundLibrary } from './useSoundLibrary'
import { BankPanel } from './BankPanel'
import { NowPlaying } from './NowPlaying'
import { SearchGrid } from './SearchGrid'
import { filterTracks, moveIndex, topTags } from './search'
import { LibraryManager } from './LibraryManager'
import { BoardPicker } from './BoardPicker'
import { isTypingTarget } from '../shared/typingTarget'

export function SoundApp() {
  const { tracks, tags, folder } = useSoundLibrary()
  const banks = useAppState((s) => s.soundBanks)
  const dispatch = useDispatch()

  const [managing, setManaging] = useState(false)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  // Tapping a tag PINS it rather than overwriting the query, so tags AND
  // together and tapping two of them drills in. filterTracks already worked
  // this way for the Library; search just never used it.
  const [pinned, setPinned] = useState<string[]>([])
  // Which bank the + on a search result drops onto. Lifted out of the board so
  // search can target it; falls back to the first bank so a deleted one can't
  // leave the panel pointing at nothing.
  const [activeBankId, setActiveBankId] = useState<string | null>(null)
  // Which row Enter acts on. The list and the keyboard read the same items, so
  // Enter can't fire a different row than the one highlighted.
  const [activeIndex, setActiveIndex] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  const songs = useMemo(() => filterTracks(tracks, query, pinned), [tracks, query, pinned])
  // Tag options are counted against what's ALREADY narrowed, so a pill tells you
  // how many it would leave you with rather than how many exist in the library —
  // and a pill that would leave you with nothing simply isn't offered. Pinned
  // tags stay on the row regardless, or clearing one would be impossible.
  const tagOptions = useMemo(() => {
    const counts = topTags(songs, 40)
    const missing = pinned.filter((t) => !counts.some((c) => c.tag === t)).map((tag) => ({ tag, count: 0 }))
    return [...missing, ...counts].sort((a, b) => a.tag.localeCompare(b.tag))
  }, [songs, pinned])

  const activeBank = banks.find((b) => b.id === activeBankId) ?? banks[0] ?? null

  function closeSearch() {
    setSearchOpen(false)
    setQuery('')
    setPinned([])
    setActiveIndex(0)
    searchRef.current?.blur()
  }

  // Playing does NOT close search. A search is often a set rather than a single
  // shot — you look up "rap beats", fire one, and want the next from the same
  // handful a minute later. Closing would make that a re-search every time, so
  // search behaves like the tab it looks like and stays put until you leave it
  // (Esc, or picking another tab).
  function playTrack(track: { id: string }) {
    dispatch({ type: 'sound.play', id: track.id })
  }

  // A tag pill is a filter: on, off, and they AND together.
  function togglePin(tag: string) {
    setPinned((p) => (p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]))
    setActiveIndex(0)
    searchRef.current?.focus()
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // Stop the caret jumping to the ends of the text while arrowing the list.
      e.preventDefault()
      setSearchOpen(true)
      setActiveIndex((i) => moveIndex(i, e.key === 'ArrowDown' ? 1 : -1, songs.length))
      return
    }
    if (e.key === 'Enter') {
      const track = songs[activeIndex]
      if (track) playTrack(track)
      return
    }
    if (e.key === 'Escape') closeSearch()
    if (e.key === 'Backspace' && query === '' && pinned.length > 0) {
      // An empty field and a Backspace means "undo the last narrowing", the way
      // any chip field behaves.
      setPinned((p) => p.slice(0, -1))
    }
  }

  function openSearch() {
    setSearchOpen(true)
    searchRef.current?.focus()
  }

  // Both board shortcuts have to work from anywhere in the window rather than
  // from the field, because clicking a result's + moves focus onto that button —
  // and if the way out of search depended on where you last clicked, it wouldn't
  // be a way out.
  //
  // "/" is the way in: hands are on the keyboard, the song you want isn't on a
  // pad, and reaching for the mouse to click the field costs a beat you don't
  // have mid-show. It's also an ordinary character, so it only counts as a
  // shortcut when the keystroke isn't already headed into a text field — which
  // is also why the toggle-closed half only fires when focus has moved off the
  // field. With the caret in the search box, "/" is just a slash.
  useEffect(() => {
    if (managing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchOpen) closeSearch()
        return
      }
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      e.preventDefault()
      if (searchOpen) closeSearch()
      else openSearch()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [managing, searchOpen])

  // The transport is pinned to the bottom and lives outside the mode switch, so
  // it's in the same place whichever surface you're on — including while
  // auditioning songs in the library.
  if (managing) {
    return (
      <div className="sound">
        <LibraryManager
          tracks={tracks}
          tags={tags}
          folder={folder}
          activeBank={activeBank}
          onClose={() => setManaging(false)}
        />
        <NowPlaying />
      </div>
    )
  }

  return (
    <div className="sound">
      <header className="sound__topbar">
        {/* See the operator's header: the board's name is worth more in this
            slot than the word "Sound", so the picker leads and the heading is
            kept for screen readers only. Library stays on the right — it's a
            place you go, not a thing you're looking at. */}
        <h1 className="vis-hidden">Sound</h1>
        <BoardPicker tracks={tracks} />
        <button className="pill sound__library" onClick={() => setManaging(true)}>
          Library
        </button>
      </header>

      <div className="sound__board">
        <BankPanel
          banks={banks}
          tracks={tracks}
          activeBankId={activeBank?.id ?? null}
          onSelectBank={setActiveBankId}
          searchActive={searchOpen}
          onOpenSearch={openSearch}
          onCloseSearch={closeSearch}
          searchField={
            <>
              <input
                ref={searchRef}
                className="banks__search"
                value={query}
                placeholder="Search for a song…"
                autoFocus
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActiveIndex(0) // new results, start from the top
                }}
                onKeyDown={onSearchKey}
              />
              {/* Clears the text only, not the tag pills — those are visibly on
                  and carry their own ✕. Search is live, so there's no Enter to
                  undo; this is the only way back to an empty field without
                  holding Backspace. */}
              {query !== '' && (
                <button
                  className="banks__clear"
                  title="Clear the search text"
                  aria-label="Clear the search text"
                  onClick={() => {
                    setQuery('')
                    setActiveIndex(0)
                    searchRef.current?.focus()
                  }}
                >
                  <MdClose />
                </button>
              )}
            </>
          }
          searchGrid={
            <SearchGrid
              songs={songs}
              tags={tagOptions}
              pinned={pinned}
              query={query}
              activeIndex={activeIndex}
              onPlay={playTrack}
              onTogglePin={togglePin}
              onHover={setActiveIndex}
            />
          }
          // What a drop produces is decided (and tested) in drops.ts; this just
          // puts it on the bank that was dropped on.
          onAddPadsToBank={(bankId, pads) => dispatch({ type: 'soundPad.add', bankId, pads })}
        />
      </div>

      <NowPlaying />
    </div>
  )
}
