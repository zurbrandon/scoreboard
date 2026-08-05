// Lets the technician pick which monitor the projector window fullscreens onto
// (Success Criteria: "Choose the projector display"). Electron-only; renders
// nothing in the browser prototype.

import { useEffect, useState } from 'react'
import type { DisplayInfo } from '../shared/bridge'

export function ProjectorDisplayPicker() {
  const bridge = window.showboard
  const [displays, setDisplays] = useState<DisplayInfo[]>([])

  useEffect(() => {
    if (!bridge) return
    let active = true
    bridge.listDisplays().then((list) => {
      if (active) setDisplays(list)
    })
    return () => {
      active = false
    }
  }, [bridge])

  // Nothing to choose in the browser, or with a single display.
  if (!bridge || displays.length < 2) return null

  return (
    <select
      className="pill"
      aria-label="Projector display"
      defaultValue=""
      onChange={(e) => {
        const id = Number(e.target.value)
        if (!Number.isNaN(id)) bridge.setProjectorDisplay(id)
      }}
    >
      <option value="" disabled>
        Projector display…
      </option>
      {displays.map((d) => (
        <option key={d.id} value={d.id}>
          {d.label} · {d.width}×{d.height}
        </option>
      ))}
    </select>
  )
}
