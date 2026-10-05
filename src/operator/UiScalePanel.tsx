// How large the control surfaces draw themselves. The booth PC is a smaller,
// lower-grade panel wearing a thick Windows title bar and taskbar, so the layout
// that fits comfortably on a Mac display crowds it — but the right number is
// something you can only find by looking at the actual screen, which is why this
// is a live knob rather than a constant. Electron-only; the browser prototype
// has the browser's own zoom.

import { useEffect, useState } from 'react'

const MIN = 0.6
const MAX = 1.4
const STEP = 0.05

export function UiScalePanel() {
  const bridge = window.showboard
  const [scale, setScale] = useState<number | null>(null)

  useEffect(() => {
    if (!bridge) return
    let active = true
    bridge.getUiScale().then((value) => {
      if (active) setScale(value)
    })
    return () => {
      active = false
    }
  }, [bridge])

  // Until main has answered we don't know the real value, and rendering a
  // default would make the slider jump under the pointer.
  if (!bridge || scale === null) return null

  const apply = (next: number) => {
    // Round to 2dp: snapping to STEP alone leaves float noise (0.85 lands as
    // 0.8500000000000001), which would persist into the settings file.
    const snapped = Math.round(Math.round(next / STEP) * STEP * 100) / 100
    const clamped = Math.min(MAX, Math.max(MIN, snapped))
    setScale(clamped)
    bridge.setUiScale(clamped)
  }

  return (
    <div className="music-panel__row">
      <input
        type="range"
        className="ui-scale__slider"
        aria-label="Controller size"
        min={MIN}
        max={MAX}
        step={STEP}
        value={scale}
        onChange={(e) => apply(Number(e.target.value))}
      />
      <span className="ui-scale__value">{Math.round(scale * 100)}%</span>
      <button className="pill" onClick={() => apply(1)} disabled={scale === 1}>
        Reset
      </button>
    </div>
  )
}
