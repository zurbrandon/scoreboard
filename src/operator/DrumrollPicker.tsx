// Lets the operator pick a custom Final-score drum roll (Electron only). Until
// one is chosen, the finale falls back to a random bumper. The chosen file is
// persisted by main and pushed to the audio controller at startup.

import { useEffect, useState } from 'react'

export function DrumrollPicker() {
  const bridge = window.showboard
  const [file, setFile] = useState<string | null>(null)

  useEffect(() => {
    if (!bridge) return
    const off = bridge.onDrumroll(({ file }) => setFile(file))
    bridge.requestDrumroll()
    return off
  }, [bridge])

  if (!bridge) return null

  const name = file ? file.split('/').pop() : null
  return (
    <div className="music-panel__row">
      <button className="pill" onClick={() => bridge.chooseDrumroll()}>
        Choose drum roll…
      </button>
      <span className="music-panel__status">
        {name ? `♪ ${name}` : 'No custom drum roll — a random bumper plays for now.'}
      </span>
    </div>
  )
}
