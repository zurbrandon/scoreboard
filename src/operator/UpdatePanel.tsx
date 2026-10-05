// Operator-driven updates. Three deliberate steps — check, download, install —
// because this app spends its evenings mid-show and must never decide on its
// own to swap itself out or restart. Nothing here happens without a click.
// Electron-only; the browser prototype has nothing to update.

import { useEffect, useState } from 'react'
import type { UpdateStatus } from '../shared/bridge'

export function UpdatePanel() {
  const bridge = window.showboard
  const [status, setStatus] = useState<UpdateStatus | null>(null)

  useEffect(() => {
    if (!bridge) return
    let active = true
    bridge.getUpdateStatus().then((s) => {
      if (active) setStatus(s)
    })
    const off = bridge.onUpdateStatus(setStatus)
    return () => {
      active = false
      off()
    }
  }, [bridge])

  if (!bridge || !status) return null

  const busy = status.phase === 'checking' || status.phase === 'downloading'

  return (
    <div className="music-panel__row">
      {status.phase === 'ready' ? (
        <button className="pill" onClick={() => bridge.installUpdate()}>
          Restart & install {status.available}
        </button>
      ) : status.phase === 'available' ? (
        <button className="pill" onClick={() => bridge.downloadUpdate()}>
          Download {status.available}
        </button>
      ) : (
        <button className="pill" disabled={busy} onClick={() => bridge.checkForUpdate()}>
          {status.phase === 'checking' ? 'Checking…' : 'Check for updates'}
        </button>
      )}

      <span className="music-panel__status">{describe(status)}</span>
    </div>
  )
}

function describe(s: UpdateStatus): string {
  switch (s.phase) {
    case 'checking':
      return `Version ${s.version}`
    case 'available':
      return `Version ${s.available} is available — you're on ${s.version}.`
    case 'current':
      return `Version ${s.version} — up to date.`
    case 'downloading':
      return `Downloading ${s.available ?? ''} — ${s.percent ?? 0}%`
    case 'ready':
      // Worth being explicit: the install happens by quitting, which on this
      // app means the projector goes down too.
      return `Ready to install. This closes the projector and reopens it.`
    case 'error':
      return s.message ?? 'Update check failed.'
    default:
      return `Version ${s.version}`
  }
}
