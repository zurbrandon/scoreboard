// Where a song starts, as a popover on the button that opens it — the same
// shape as tagging, because it's the same kind of job: something you set about
// a song while you're looking at it in the library.
//
// The two ways in matter for different reasons. Typing is for when you already
// know the number (you probably do — it's written down in the app you're
// replacing). Capturing is for when you don't: audition the song, listen for
// where it kicks in, and press the button at that moment. Capture writes into
// the same field typing does, so a capture that lands a few seconds late is
// nudged rather than redone.

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { MdFlag, MdPlayArrow, MdStop } from 'react-icons/md'
import type { SoundProgress, SoundTrackInfo } from '../shared/bridge'
import { formatTimecode, parseTimecode } from '../shared/timecode'
import { useDispatch } from '../store/react'

const SILENT: SoundProgress = { name: '', trackId: '', position: 0, duration: 0, playing: false }

export function StartEditor({
  track,
  anchor,
  onClose,
}: {
  track: SoundTrackInfo
  /** Where the button that opened it sits, in viewport coordinates. */
  anchor: DOMRect
  onClose: () => void
}) {
  const [text, setText] = useState(track.startAt ? formatTimecode(track.startAt) : '')
  const [progress, setProgress] = useState<SoundProgress>(SILENT)
  // Where the thumb sits mid-drag, so the four-a-second position stream doesn't
  // yank it back under the finger. Same trick as the now-playing bar.
  const [scrub, setScrub] = useState<number | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const bridge = window.showboard
  const dispatch = useDispatch()

  // Only THIS song's playhead is worth capturing. Auditioning something else
  // while this is open shouldn't offer to stamp the wrong song's position.
  const live = progress.playing && progress.trackId === track.id

  useEffect(() => {
    if (!bridge) return
    return bridge.onSoundProgress(setProgress)
  }, [bridge])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const parsed = parseTimecode(text)
  // Empty means "no start time" and is a valid thing to save; anything else that
  // doesn't parse is a half-typed value, and saving is held until it does.
  const valid = text.trim() === '' || parsed !== null

  function commitScrub() {
    if (scrub === null) return
    dispatch({ type: 'sound.seek', seconds: scrub })
    setScrub(null)
  }

  function save() {
    if (!bridge || !valid) return
    bridge.setSoundStart(track.id, text.trim() === '' ? null : parsed)
    onClose()
  }

  const HEIGHT = 250
  const below = anchor.bottom + HEIGHT < window.innerHeight
  const style: CSSProperties = {
    position: 'fixed',
    left: Math.max(8, Math.min(anchor.left, window.innerWidth - 260)),
    ...(below ? { top: anchor.bottom + 6 } : { bottom: window.innerHeight - anchor.top + 6 }),
  }

  return (
    <div
      ref={boxRef}
      className="startpop"
      style={style}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save()
      }}
    >
      <div className="startpop__head">Starts at</div>

      <input
        className="startpop__input"
        value={text}
        autoFocus
        placeholder="0:00"
        aria-label="Start time"
        aria-invalid={!valid}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.target.select()}
      />

      {/* The transport lives IN here. It has to: the popover closes on a click
          outside it, so a play button on the row — or the scrubber in the
          now-playing bar — would dismiss the very thing you're aiming at. The
          first cut of this shipped exactly that, a capture flow you couldn't
          reach. Everything the job needs is now inside the box. */}
      <div className="startpop__transport">
        <button
          className="startpop__play"
          title={live ? 'Stop' : 'Play this song'}
          onClick={() =>
            live
              ? dispatch({ type: 'sound.stop' })
              : dispatch({ type: 'sound.play', id: track.id })
          }
        >
          {live ? <MdStop /> : <MdPlayArrow />}
        </button>
        <input
          className="startpop__scrub"
          type="range"
          min={0}
          max={progress.duration > 0 ? progress.duration : 1}
          step={0.1}
          value={scrub ?? progress.position}
          disabled={!live || progress.duration === 0}
          aria-label="Find the spot"
          onChange={(e) => setScrub(Number(e.target.value))}
          onPointerUp={commitScrub}
          onKeyUp={commitScrub}
          onBlur={commitScrub}
        />
        <span className="startpop__clock">{formatTimecode(scrub ?? progress.position)}</span>
      </div>

      {/* Arms only while THIS song is sounding, and names the position it would
          stamp — so the button previews itself rather than being a leap. */}
      <button
        className="startpop__grab"
        disabled={!live}
        title={live ? 'Use where the song is right now' : 'Press play, then catch the moment it kicks in'}
        onClick={() => setText(formatTimecode(scrub ?? progress.position))}
      >
        <MdFlag />
        {live ? `Start here — ${formatTimecode(scrub ?? progress.position)}` : 'Press play to find the spot'}
      </button>

      <div className="startpop__row">
        <button
          className="startpop__clear"
          disabled={text.trim() === ''}
          onClick={() => setText('')}
        >
          Clear
        </button>
        <button className="startpop__save" disabled={!valid} onClick={save}>
          Save
        </button>
      </div>
    </div>
  )
}
