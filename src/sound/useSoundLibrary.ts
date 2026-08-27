// Subscribes to the sound library main pushes over the bridge. The library is
// deliberately NOT in app state: it's derived from disk, it can be large, and it
// carries sbmedia:// URLs that mean nothing to the persisted state file. Every
// window gets the same push, so the soundboard and Settings stay in step without
// either one owning the data.

import { useEffect, useState } from 'react'
import type { SoundLibraryUpdate } from '../shared/bridge'

const EMPTY: SoundLibraryUpdate = { folder: null, tracks: [], tags: [] }

export function useSoundLibrary(): SoundLibraryUpdate {
  const [library, setLibrary] = useState<SoundLibraryUpdate>(EMPTY)

  useEffect(() => {
    const bridge = window.showboard
    if (!bridge) return // browser dev build: no library to scan
    const off = bridge.onSoundLibrary(setLibrary)
    bridge.requestSoundLibrary()
    return off
  }, [])

  return library
}
