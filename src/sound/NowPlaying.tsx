// What's sounding, and how to stop it. Present whatever started the song — a
// pad, an audition, or a reveal bumper fired from the operator window — because
// "what am I hearing right now" doesn't care which button caused it.
//
// Two ways to stop, because they're different gestures mid-show: Stop is nearly
// immediate (a short ramp, so no speaker pop), Fade is the slow musical one that
// takes the music down under whatever happens next.

import { useEffect, useRef, useState } from 'react'
import { useDispatch } from '../store/react'
import type { SoundProgress } from '../shared/bridge'
import { formatTimecode } from '../shared/timecode'

const SILENT: SoundProgress = { name: '', trackId: '', position: 0, duration: 0, playing: false }

export function NowPlaying() {
  const dispatch = useDispatch()
  const [progress, setProgress] = useState<SoundProgress>(SILENT)
  // Where the thumb sits while the operator is dragging it. Without this the
  // position stream arriving four times a second yanks the thumb back under
  // their finger, which reads as the bar fighting them.
  const [dragging, setDragging] = useState<number | null>(null)
  // After letting go, hold the thumb at the target until the stream catches up
  // — the next tick still carries the pre-seek position, and snapping back for
  // one frame looks like the seek failed.
  const pending = useRef<number | null>(null)

  useEffect(() => {
    const bridge = window.showboard
    if (!bridge) return // browser dev build: nothing plays here
    return bridge.onSoundProgress((next) => {
      if (pending.current !== null && Math.abs(next.position - pending.current) < 1.5) {
        pending.current = null // the seek landed; follow the song again
      }
      setProgress(next)
    })
  }, [])

  // Duration is 0 until metadata loads; the scrub falls back to a max of 1 so it
  // renders empty rather than dividing by zero or jumping to full.
  const { name, position, duration, playing } = progress

  function commitScrub() {
    if (dragging === null) return
    pending.current = dragging
    dispatch({ type: 'sound.seek', seconds: dragging })
    setDragging(null)
  }


  return (
    <div className={`now-playing${playing ? ' now-playing--live' : ''}`}>
      <span className="now-playing__name">{playing ? name : 'Nothing playing'}</span>

      <input
        className="now-playing__scrub"
        type="range"
        min={0}
        max={duration > 0 ? duration : 1}
        step={0.5}
        value={dragging ?? pending.current ?? position}
        disabled={!playing || duration === 0}
        aria-label="Scrub the playing track"
        onChange={(e) => setDragging(Number(e.target.value))}
        // Seek once, on release, rather than on every pixel of the drag: each
        // one restarts decoding, and a drag would fire dozens.
        onPointerUp={() => commitScrub()}
        onKeyUp={() => commitScrub()}
        onBlur={() => commitScrub()}
      />

      <span className="now-playing__time">
        {formatTimecode(position)} {duration > 0 && `/ ${formatTimecode(duration)}`}
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
