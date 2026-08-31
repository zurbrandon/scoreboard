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
    if (!bridge) {
      // Browser dev build: there's no disk to scan, which makes the soundboard
      // the one window with no data of its own and so the one window you cannot
      // work on in a browser at all. A library can be pasted into
      // sessionStorage to unblock that — sessionStorage rather than a global so
      // it survives the reloads that iterating on this window requires:
      //   sessionStorage.setItem('showboard.devLibrary', JSON.stringify(
      //     { folder: '/fake', tags: ['pizza'], tracks: [{ id:'t1', name:'Pizza Party', url:'', tags:['pizza'] }] }))
      if (import.meta.env.DEV) {
        try {
          const raw = sessionStorage.getItem('showboard.devLibrary')
          if (raw) setLibrary({ ...EMPTY, ...(JSON.parse(raw) as Partial<SoundLibraryUpdate>) })
        } catch {
          // Bad JSON in a dev-only escape hatch: not worth a crash.
        }
      }
      return
    }
    const off = bridge.onSoundLibrary(setLibrary)
    bridge.requestSoundLibrary()
    return off
  }, [])

  return library
}
