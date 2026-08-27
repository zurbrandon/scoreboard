// Reports what's sounding to the soundboard window, on a timer.
//
// A timer rather than audio events because position doesn't fire an event as it
// advances, and rather than app state because this ticks continuously — routing
// it through state would push a full state broadcast to every window several
// times a second, waking the projector mid-animation for something only the
// soundboard displays (Principles: "Keep Features Independent").
//
// Only the operator window plays audio, so only it runs this.

import type { AudioController } from './audioController'
import type { ShowboardBridge, SoundProgress } from '../shared/bridge'

const TICK_MS = 250 // four times a second: smooth enough to read, cheap enough to ignore

export function attachSoundProgress(
  audio: AudioController,
  bridge: ShowboardBridge,
): () => void {
  let lastSent: SoundProgress | null = null

  const timer = setInterval(() => {
    const progress = audio.getProgress()
    // While nothing is playing there's nothing to say — but the first silent
    // tick still goes out, so the bar clears instead of freezing on the last
    // position of a song that already ended.
    if (!progress.playing && lastSent && !lastSent.playing) return
    lastSent = progress
    bridge.reportSoundProgress(progress)
  }, TICK_MS)

  return () => clearInterval(timer)
}
