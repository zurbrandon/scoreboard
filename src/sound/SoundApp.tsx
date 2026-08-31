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

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppState, useDispatch } from '../store/react'

import { useSoundLibrary } from './useSoundLibrary'
import { BankPanel } from './BankPanel'
import { NowPlaying } from './NowPlaying'
import { SearchResults } from './SearchResults'
import { moveIndex, searchItems, type SearchItem } from './search'
import { LibraryManager } from './LibraryManager'
import { makePads, makeTagPad } from './pads'
import { BoardPicker } from './BoardPicker'
import { isTypingTarget } from '../shared/typingTarget'

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
  // Which row Enter acts on. The list and the keyboard read the same items, so
  // Enter can't fire a different row than the one highlighted.
  const [activeIndex, setActiveIndex] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  const items = useMemo(() => searchItems(tracks, query), [tracks, query])

  const activeBank = banks.find((b) => b.id === activeBankId) ?? banks[0] ?? null

  function closeSearch() {
    setSearchOpen(false)
    setQuery('')
    setActiveIndex(0)
    searchRef.current?.blur()
  }

  // A tag narrows the search to that tag; a song plays and gets out of the way.
  function activate(item: SearchItem) {
    if (item.kind === 'tag') {
      setQuery(item.tag)
      setActiveIndex(0)
      searchRef.current?.focus()
      return
    }
    dispatch({ type: 'sound.play', id: item.track.id })
    closeSearch()
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // Stop the caret jumping to the ends of the text while arrowing the list.
      e.preventDefault()
      setSearchOpen(true)
      setActiveIndex((i) => moveIndex(i, e.key === 'ArrowDown' ? 1 : -1, items.length))
      return
    }
    if (e.key === 'Enter') {
      const item = items[activeIndex]
      if (item) activate(item)
      return
    }
    if (e.key === 'Escape') closeSearch()
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
        <h1>Sound</h1>
        <input
          ref={searchRef}
          className="sound__search sound__search--hero"
          value={query}
          placeholder="Search for a song…"
          onFocus={() => setSearchOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setSearchOpen(true)
            setActiveIndex(0) // new results, start from the top
          }}
          onKeyDown={onSearchKey}
        />
        <BoardPicker tracks={tracks} tags={tags} />
        <button className="pill" onClick={() => setManaging(true)}>
          Library
        </button>
      </header>

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
              items={items}
              query={query}
              activeIndex={activeIndex}
              activeBank={activeBank}
              onActivate={activate}
              onHover={setActiveIndex}
              onAddTagPad={(tag, mode) => {
                if (!activeBank) return
                dispatch({ type: 'soundPad.add', bankId: activeBank.id, pads: [makeTagPad(tag, mode)] })
              }}
              onAddToBank={(trackId) => {
                const track = tracks.find((t) => t.id === trackId)
                if (!activeBank || !track) return
                dispatch({ type: 'soundPad.add', bankId: activeBank.id, pads: makePads([track]) })
              }}
            />
          </>
        )}
      </div>

      <NowPlaying />
    </div>
  )
}
