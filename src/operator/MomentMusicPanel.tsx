// Two folder pickers for the run-out / run-in moment songs (Electron only). The
// tracks themselves are loaded into the audio service at app startup (main.tsx),
// so this panel only chooses the folders and shows status — it doesn't need to
// be open for the triggers to play.

import { useEffect, useState } from 'react'
import type { MomentKind } from '../core/state'

type Info = Record<MomentKind, { folder: string | null; count: number }>

export function MomentMusicPanel() {
  const bridge = window.showboard
  const [info, setInfo] = useState<Info>({
    out: { folder: null, count: 0 },
    in: { folder: null, count: 0 },
  })

  useEffect(() => {
    if (!bridge) return
    const off = bridge.onMomentTracks(({ kind, folder, tracks }) => {
      setInfo((prev) => ({ ...prev, [kind]: { folder, count: tracks.length } }))
    })
    bridge.requestMomentTracks()
    return off
  }, [bridge])

  if (!bridge) return null

  const row = (kind: MomentKind, label: string) => {
    const { folder, count } = info[kind]
    const folderLabel = folder ? folder.split('/').pop() : null
    return (
      <div className="music-panel__row">
        <button className="pill" onClick={() => bridge.chooseMomentFolder(kind)}>
          {label}…
        </button>
        <span className="music-panel__status">
          {count === 0 ? 'no songs' : `${count} song${count === 1 ? '' : 's'}`}
          {folderLabel && ` · ${folderLabel}`}
        </span>
      </div>
    )
  }

  return (
    <div className="extra music-panel">
      {row('out', 'Run-out folder')}
      {row('in', 'Run-in folder')}
    </div>
  )
}
