// Plays a random bumper when a reveal happens. Fully decoupled: it knows only
// about the store's music state and revealNonce — nothing about animations or
// windows (Principles: "Keep Features Independent"). Audio must NEVER block the
// show: every failure is swallowed so the reveal and score update still happen
// (Principles: "Audio Philosophy").
//
// Tracks are held here as object URLs, not in the serializable app state.
// In Electron (M4) setTracks() will be fed by a real music-folder scan; the
// selection logic (core/bumper.ts) stays identical.

import { pickBumper, type BumperTrack } from '../core/bumper'
import type { Store } from '../store/store'

export interface LoadedTrack extends BumperTrack {
  url: string // object URL (browser) or sbmedia:// URL (Electron)
}

export interface AudioController {
  /** Replace the bumper library. Sources are normalized to {id, name, url}. */
  setTracks(tracks: LoadedTrack[]): void
  /** Sound-check: play a random bumper now, without a reveal. */
  test(): void
  /** Stop any current playback. */
  stop(): void
  dispose(): void
}

// A bumper plays at full volume, then fades out so long tracks bow out
// gracefully instead of running on under the next bit.
const FADE_AFTER_MS = 15000 // start fading this long after a bumper begins
const FADE_MS = 3000 // slow fade to silence over this long

export function createAudioController(store: Store): AudioController {
  let tracks: LoadedTrack[] = []
  let audio: HTMLAudioElement | null = null
  let lastNonce = store.getState().revealNonce

  // Effective volume = slider volume × fadeGain. fadeGain rides 1 → 0 during the
  // fade so it composes with live volume-slider changes without fighting them.
  let fadeGain = 1
  let fadeStartTimer: ReturnType<typeof setTimeout> | undefined
  let fadeInterval: ReturnType<typeof setInterval> | undefined

  function applyVolume(): void {
    if (audio) audio.volume = Math.max(0, Math.min(1, store.getState().music.volume * fadeGain))
  }

  function clearFade(): void {
    if (fadeStartTimer) clearTimeout(fadeStartTimer)
    if (fadeInterval) clearInterval(fadeInterval)
    fadeStartTimer = undefined
    fadeInterval = undefined
  }

  function scheduleFade(): void {
    clearFade()
    fadeGain = 1
    fadeStartTimer = setTimeout(() => {
      const start = performance.now()
      fadeInterval = setInterval(() => {
        // Drive the fade off elapsed real time, so a throttled timer still lands
        // on the right volume (fewer steps, no drift).
        const t = Math.min(1, (performance.now() - start) / FADE_MS)
        fadeGain = 1 - t
        applyVolume()
        if (t >= 1) {
          clearFade()
          if (audio) audio.pause()
        }
      }, 80)
    }, FADE_AFTER_MS)
  }

  // Play a bumper. On a reveal (useSelection), honor the operator's "next song"
  // pick if one is set and still loaded; otherwise fall back to random. The Test
  // button ignores the pick — it's just a sound-check.
  function playBumper(useSelection: boolean): void {
    const { music } = store.getState()
    if (!music.enabled || tracks.length === 0) return

    let track: LoadedTrack | null = null
    if (useSelection && music.nextTrackId) {
      track = tracks.find((t) => t.id === music.nextTrackId) ?? null
    }
    const wasChosen = track !== null
    // An explicit pick overrides the no-repeat rule; random still avoids repeats.
    if (!track) track = pickBumper(tracks, music.lastTrackId, Math.random)
    if (!track) return

    try {
      clearFade()
      if (audio) audio.pause()
      fadeGain = 1
      audio = new Audio(track.url)
      applyVolume()
      // play() returns a promise that rejects under autoplay policy or decode
      // errors. Swallow it — the reveal has already happened.
      void audio.play().catch((err) => {
        console.warn('[audio] bumper playback failed; continuing show:', err)
      })
      scheduleFade()
      store.dispatch({ type: 'music.trackPlayed', id: track.id, name: track.name })
      // A picked track is a one-shot: consume it so the next reveal is random again.
      if (wasChosen) store.dispatch({ type: 'music.setNextTrack', id: null })
    } catch (err) {
      console.warn('[audio] could not start bumper; continuing show:', err)
    }
  }

  const unsubscribe = store.subscribe(() => {
    const s = store.getState()
    if (s.revealNonce !== lastNonce) {
      lastNonce = s.revealNonce
      playBumper(true)
    }
    // Keep a playing track's volume in sync with the operator's slider
    // (respecting any in-progress fade).
    applyVolume()
  })

  return {
    setTracks(next) {
      // Revoke previous object URLs; harmless no-op for sbmedia:// URLs.
      for (const t of tracks) URL.revokeObjectURL(t.url)
      tracks = next
      // Publish the serializable {id,name} list for the "next song" picker.
      store.dispatch({
        type: 'music.setLibrary',
        tracks: tracks.map(({ id, name }) => ({ id, name })),
      })
    },
    test() {
      playBumper(false)
    },
    stop() {
      clearFade()
      if (audio) audio.pause()
    },
    dispose() {
      clearFade()
      unsubscribe()
      if (audio) audio.pause()
      for (const t of tracks) URL.revokeObjectURL(t.url)
      tracks = []
    },
  }
}
