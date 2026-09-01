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
import { MdContentCut } from 'react-icons/md'
import type { SoundProgress, SoundTrackInfo } from '../shared/bridge'
import { formatTimecode, parseTimecode } from '../shared/timecode'

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
  const boxRef = useRef<HTMLDivElement>(null)
  const bridge = window.showboard

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

  function save() {
    if (!bridge || !valid) return
    bridge.setSoundStart(track.id, text.trim() === '' ? null : parsed)
    onClose()
  }

  const HEIGHT = 196
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

      {/* Enabled only while this song is the one sounding, and it says the
          position it would stamp, so the button is its own preview. */}
      <button
        className="startpop__grab"
        disabled={!live}
        title={
          live
            ? 'Use where the song is right now'
            : 'Play this song, then press this when it kicks in'
        }
        onClick={() => setText(formatTimecode(progress.position))}
      >
        <MdContentCut />
        {live ? `Start here — ${formatTimecode(progress.position)}` : 'Play it, then grab the spot'}
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
