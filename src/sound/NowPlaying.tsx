// What's sounding, and how to stop it. Present whatever started the song — a
// pad, an audition, or a reveal bumper fired from the operator window — because
// "what am I hearing right now" doesn't care which button caused it.
//
// Two ways to stop, because they're different gestures mid-show: Stop is nearly
// immediate (a short ramp, so no speaker pop), Fade is the slow musical one that
// takes the music down under whatever happens next.

import { useEffect, useState } from 'react'
import { useDispatch } from '../store/react'
import type { SoundProgress } from '../shared/bridge'

const SILENT: SoundProgress = { name: '', position: 0, duration: 0, playing: false }

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function NowPlaying() {
  const dispatch = useDispatch()
  const [progress, setProgress] = useState<SoundProgress>(SILENT)

  useEffect(() => {
    const bridge = window.showboard
    if (!bridge) return // browser dev build: nothing plays here
    return bridge.onSoundProgress(setProgress)
  }, [])

  // Duration is 0 until metadata loads; the scrub falls back to a max of 1 so it
  // renders empty rather than dividing by zero or jumping to full.
  const { name, position, duration, playing } = progress

  return (
    <div className={`now-playing${playing ? ' now-playing--live' : ''}`}>
      <span className="now-playing__name">{playing ? name : 'Nothing playing'}</span>

      <input
        className="now-playing__scrub"
        type="range"
        min={0}
        max={duration > 0 ? duration : 1}
        step={0.5}
        value={position}
        disabled={!playing || duration === 0}
        aria-label="Scrub the playing track"
        onChange={(e) => dispatch({ type: 'sound.seek', seconds: Number(e.target.value) })}
      />

      <span className="now-playing__time">
        {clock(position)} {duration > 0 && `/ ${clock(duration)}`}
      </span>

      <button className="pill" disabled={!playing} onClick={() => dispatch({ type: 'sound.stop' })}>
        Stop
      </button>
      <button className="pill" disabled={!playing} onClick={() => dispatch({ type: 'audio.fadeOut' })}>
        Fade
      </button>
    </div>
  )
}
