// Plays a random bumper when a reveal happens. Fully decoupled: it knows only
// about the store's music state and revealNonce — nothing about animations or
// windows (Principles: "Keep Features Independent"). Audio must NEVER block the
// show: every failure is swallowed so the reveal and score update still happen
// (Principles: "Audio Philosophy").
//
// Tracks are held here as object URLs, not in the serializable app state.
// In Electron (M4) setTracks() will be fed by a real music-folder scan; the
// selection logic (core/bumper.ts) stays identical.

import { pickBumper, pickFromPool, tracksWithTag, type BumperTrack } from '../core/bumper'
import type { MomentKind, SoundPadMode, SoundSlotId } from '../core/state'
import { refillBag } from '../core/shuffleBag'
import type { Store } from '../store/store'
import type { SoundProgress } from '../shared/bridge'

export interface LoadedTrack extends BumperTrack {
  url: string // object URL (browser) or sbmedia:// URL (Electron)
  /** Seconds into the file where this song should start. Honoured by every play
   *  path, since they all funnel through playLoadedTrack. */
  startAt?: number
}

/** A sound-library track. Carries its tags, which is what lets a behavior's
 *  slot resolve to a pool without asking anyone else. */
export interface LoadedSoundTrack extends LoadedTrack {
  tags: string[]
}

export interface AudioController {
  /** Replace the bumper library. Sources are normalized to {id, name, url}. */
  setTracks(tracks: LoadedTrack[]): void
  /** Set (or clear) the custom Final-score drum roll. null → fall back to a bumper. */
  setDrumroll(track: LoadedTrack | null): void
  /** Replace the song pool for a run-out / run-in moment. */
  setMomentTracks(kind: MomentKind, tracks: LoadedTrack[]): void
  /** Replace the soundboard's library — the tagged pool its pads play from. */
  setSoundTracks(tracks: LoadedSoundTrack[]): void
  /** What's sounding right now, for the soundboard's now-playing bar. Read on a
   *  timer rather than pushed, so nothing here fires on every frame. */
  getProgress(): SoundProgress
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
const STOP_FADE_MS = 250 // fast fade when the operator hits STOP (no speaker pop)
const SOUND_STOP_FADE_MS = 400 // the soundboard's own Stop: quick, but still not a hard cut
const MOMENT_LEAVE_FADE_MS = 6500 // slow, graceful fade when leaving a moment for another scene
const BLACK_FADE_MS = 7500 // graceful fade when cueing to black or a blackout beat / "No music"
const KILL_FADE_MS = 5000 // graceful fade for the "fade music out" kill switch (leaves the scene up)

export function createAudioController(store: Store): AudioController {
  let tracks: LoadedTrack[] = []
  let drumroll: LoadedTrack | null = null
  const momentTracks: Record<MomentKind, LoadedTrack[]> = { out: [], in: [] }
  // The soundboard's pool. Kept apart from `tracks` because it's a different
  // library with different rules — no no-repeat bookkeeping, no auto-fade — but
  // it shares the single <audio> element, which is what guarantees that a pad
  // tap replaces whatever is sounding instead of stacking on top of it.
  let soundTracks: LoadedSoundTrack[] = []
  let audio: HTMLAudioElement | null = null
  let lastNonce = store.getState().revealNonce
  let lastFinaleNonce = store.getState().finaleNonce
  let lastStopNonce = store.getState().stopNonce
  let lastAudioFadeNonce = store.getState().audioFadeNonce
  let lastMomentNonce = store.getState().momentNonce
  let lastSoundCueNonce = store.getState().soundCueNonce
  let lastSoundStopNonce = store.getState().soundStopNonce
  let lastSoundTagCueNonce = store.getState().soundTagCueNonce
  let lastSoundSeekNonce = store.getState().soundSeekNonce
  let lastAnimNonce = store.getState().revealAnimNonce
  let lastScene = store.getState().scene
  let currentIsMoment = false // is the track now playing a run-out / run-in song?
  // The slide-cue track currently sounding (null = none). Lets a reveal that asks
  // for the SAME track keep it playing instead of restarting — so one song rides
  // continuously across a run of beats (welcome players → blue → red).
  let currentCueTrackId: string | null = null
  // The name of whatever is sounding, whichever path started it — a bumper, a
  // slide cue, a moment, or a pad. The now-playing bar shows all of them, since
  // "what am I hearing" doesn't care which button caused it.
  let currentName = ''
  let currentId = ''
  // Who started what's sounding. The deck and the soundboard each take down what
  // they started: "cue to black" is a show gesture and shouldn't kill house
  // music a pad started, and the deck's STOP shouldn't even arm for it. The
  // soundboard's own Stop still reaches everything — its bar is the one place
  // that sees all of it.
  let currentSource: 'show' | 'soundboard' = 'show'
  // A running tag pad in continuous mode: which tag, and the songs left in its
  // bag. Everything in the bag plays before anything repeats. Cleared by any
  // other cue, which is what makes "continuous ends when something else plays"
  // true without a special case at every call site.
  let running: { tag: string; bag: string[]; lastId: string | null } | null = null

  // Effective volume = slider volume × fadeGain. fadeGain rides 1 → 0 during the
  // fade so it composes with live volume-slider changes without fighting them.
  let fadeGain = 1
  let fadeStartTimer: ReturnType<typeof setTimeout> | undefined
  let fadeInterval: ReturnType<typeof setInterval> | undefined

  function applyVolume(): void {
    if (!audio) return
    // Effective volume composes the operator's base slider (music.volume), the
    // natural end-of-track fade (fadeGain), and the macro-pad dial's temporary
    // duck (music.duck) — and a global mute that forces silence over all of them.
    // Runs on every state change, so muting/dialing adjusts a playing track live.
    const { volume, duck, muted } = store.getState().music
    audio.volume = muted ? 0 : Math.max(0, Math.min(1, volume * fadeGain * (duck ?? 1)))
  }

  // Mirror "is reveal sound playing" into the store (deduped) so the operator's
  // STOP button can stay lit for the whole track, not just the animation window.
  let playingFlag = false
  function setPlaying(value: boolean): void {
    if (value === playingFlag) return
    playingFlag = value
    store.dispatch({ type: 'audio.setPlaying', value })
  }

  function clearFade(): void {
    if (fadeStartTimer) clearTimeout(fadeStartTimer)
    if (fadeInterval) clearInterval(fadeInterval)
    fadeStartTimer = undefined
    fadeInterval = undefined
  }

  // Fully tear down the current <audio>: pausing alone leaves the element holding
  // its decoded media resource. Detaching src + load() makes the browser release
  // it, so a long show's worth of reveals can't pile up buffers in memory.
  function releaseAudio(): void {
    if (!audio) return
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    audio = null
    currentIsMoment = false
    currentCueTrackId = null
    currentName = ''
    currentId = ''
    currentSource = 'show'
    setPlaying(false)
  }

  // Ramp the current track to silence over `ms`, then release it. A fade (vs. a
  // hard pause) avoids the click/pop of cutting a playing buffer dead. Used both
  // for the fast STOP kill switch and the slow graceful fade on leaving a moment.
  // No-op if nothing is playing.
  function fadeOutOver(ms: number): void {
    if (!audio) return
    clearFade()
    const startGain = fadeGain
    const start = performance.now()
    fadeInterval = setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / ms)
      fadeGain = startGain * (1 - t)
      applyVolume()
      if (t >= 1) {
        clearFade()
        releaseAudio()
      }
    }, 16)
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
          releaseAudio() // bumper has faded out — free it now
        }
      }, 80)
    }, FADE_AFTER_MS)
  }

  // Play a bumper. On a reveal (useSelection), honor the operator's "next song"
  // pick if one is set and still loaded; otherwise fall back to random. The Test
  // button ignores the pick — it's just a sound-check. `fade` off lets a track
  // play out in full (used for the Final-score celebration, which runs long).
  function playBumper(useSelection: boolean, fade = true): void {
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
      releaseAudio() // drop the previous bumper before starting a new one
      fadeGain = 1
      audio = new Audio(track.url)
      currentName = track.name
      currentId = track.id
      currentSource = 'show'
      applyVolume()
      // play() returns a promise that rejects under autoplay policy or decode
      // errors. Swallow it — the reveal has already happened.
      void audio.play().catch((err) => {
        console.warn('[audio] bumper playback failed; continuing show:', err)
      })
      setPlaying(true)
      if (fade) scheduleFade() // else let it ride out to the end of the track
      store.dispatch({ type: 'music.trackPlayed', id: track.id, name: track.name })
      // A picked track is a one-shot: consume it so the next reveal is random again.
      if (wasChosen) store.dispatch({ type: 'music.setNextTrack', id: null })
    } catch (err) {
      console.warn('[audio] could not start bumper; continuing show:', err)
    }
  }

  // Play a specific bumper by id — a slide's music cue. Starts under the slide
  // the moment it's revealed. Two behaviors make it work as a continuous bed:
  //   • No restart: if this exact track is already sounding, leave it playing —
  //     so revealing the next beat in the run doesn't cut the song.
  //   • It rides: unlike a bumper, a cued track has no 15s auto-fade. It plays
  //     out (or until STOP, a different track, or the operator moves on), so the
  //     bed carries across welcome players → blue team → red team.
  // No-op if music is off or that track isn't loaded.
  function playTrackById(id: string): void {
    const { music } = store.getState()
    if (!music.enabled) return
    // Already sounding this exact track → let it keep playing (the bed continues).
    if (currentCueTrackId === id && audio && !audio.ended) return
    const track = tracks.find((t) => t.id === id)
    if (!track) return
    try {
      clearFade()
      releaseAudio()
      fadeGain = 1
      audio = new Audio(track.url)
      currentCueTrackId = id
      currentName = track.name
      currentId = track.id
      currentSource = 'show'
      applyVolume()
      // Free the element when the song finishes on its own (no auto-fade to do it).
      audio.addEventListener('ended', () => releaseAudio(), { once: true })
      void audio.play().catch((err) => {
        console.warn('[audio] slide cue playback failed; continuing show:', err)
      })
      setPlaying(true)
      store.dispatch({ type: 'music.trackPlayed', id: track.id, name: track.name })
    } catch (err) {
      console.warn('[audio] could not start slide cue; continuing show:', err)
    }
  }

  // What a behavior should play: a song carrying its slot's tag, or null when
  // the slot is unset or nothing carries that tag yet — the caller then falls
  // back to the folder it used before, so a half-tagged library still runs a
  // show. The sound library is the pool, so tagging a song is all it takes to
  // put it into rotation.
  function pickForSlot(slot: SoundSlotId): LoadedTrack | null {
    const tag = store.getState().soundSlots?.[slot] ?? null
    return pickFromPool(tracksWithTag(soundTracks, tag))
  }

  // A soundboard pick: a pad tap, or an audition while tagging. It behaves like
  // a slide cue — it rides to the end of the song rather than auto-fading after
  // 15s, because the operator chose this song deliberately and decides when it
  // stops. Unlike a slide cue it always restarts, even if the same song is
  // already playing: tapping a pad again is a re-trigger, not a no-op.
  // Start a track from the sound library. `fade` off lets it ride to the end of
  // the song (a pad the operator chose deliberately); on gives it the bumper's
  // 15s-then-fade manners, for a song the app started on its own.
  function playLoadedTrack(track: LoadedTrack, fade: boolean, source: 'show' | 'soundboard'): void {
    if (store.getState().music.muted) return // a hard mute means silence, whatever asked
    running = null // a deliberate cue ends any continuous run; no auto-resume
    try {
      clearFade()
      releaseAudio()
      fadeGain = 1
      audio = new Audio(track.url)
      currentName = track.name
      currentId = track.id
      currentSource = source
      applyVolume()
      // A song that doesn't get going until a minute in starts where it starts.
      // Seeking has to wait for metadata — currentTime before the duration is
      // known is silently dropped — but metadata always lands before the first
      // sample is audible, so nothing is heard from the top on the way past.
      const startAt = track.startAt ?? 0
      if (startAt > 0) {
        const el = audio
        el.addEventListener(
          'loadedmetadata',
          () => {
            // Guard the duration: a start time left over from a file that was
            // replaced by a shorter one would otherwise seek past the end and
            // play nothing at all.
            if (Number.isFinite(el.duration) && startAt < el.duration) el.currentTime = startAt
          },
          { once: true },
        )
      }
      if (fade) scheduleFade()
      else audio.addEventListener('ended', () => releaseAudio(), { once: true })
      void audio.play().catch((err) => {
        console.warn('[audio] playback failed; continuing show:', err)
      })
      // Only show audio arms the deck's STOP; a pad playing must not make the
      // deck look like it has a reveal to stop.
      if (source === 'show') setPlaying(true)
      store.dispatch({ type: 'music.trackPlayed', id: track.id, name: track.name })
    } catch (err) {
      console.warn('[audio] could not start track; continuing show:', err)
    }
  }

  function playSoundTrack(id: string): void {
    const track = soundTracks.find((t) => t.id === id)
    if (!track) return // library rescanned out from under the pad
    playLoadedTrack(track, false, 'soundboard')
  }

  // A tag pad. Which song it plays is decided now, from whatever currently
  // carries the tag — so the pad keeps working as the library grows, and an
  // empty tag simply does nothing rather than erroring mid-show.
  //
  // 'continuous' keeps dealing from a shuffled bag as each song ends: house
  // music that plays everything before it repeats anything.
  function playTagCue(tag: string, mode: SoundPadMode): void {
    const pool = tracksWithTag(soundTracks, tag)
    if (pool.length === 0) return
    const bag = refillBag(pool.map((t) => t.id), null)
    const firstId = bag.shift()
    if (!firstId) return
    if (mode === 'continuous') running = { tag, bag, lastId: firstId }
    playTagTrack(firstId, mode === 'continuous')
  }

  // Play one song from a tag run. `chain` arms the hand-off to the next song
  // when this one ends; a random pad plays exactly one and stops.
  function playTagTrack(id: string, chain: boolean): void {
    const track = soundTracks.find((t) => t.id === id)
    if (!track) return
    const keepRunning = running // playLoadedTrack clears it; this cue is the exception
    playLoadedTrack(track, false, 'soundboard')
    if (!chain) return
    running = keepRunning
    audio?.addEventListener('ended', advanceRun, { once: true })
  }

  // One song ended during a continuous run: deal the next. Refills the bag when
  // it's spent, so a pass never opens with the song that just finished.
  function advanceRun(): void {
    if (!running) return
    const pool = tracksWithTag(soundTracks, running.tag)
    if (pool.length === 0) {
      running = null
      releaseAudio()
      return
    }
    if (running.bag.length === 0) {
      running.bag = refillBag(pool.map((t) => t.id), running.lastId)
    }
    const nextId = running.bag.shift()
    if (!nextId) {
      running = null
      releaseAudio()
      return
    }
    running.lastId = nextId
    playTagTrack(nextId, true)
  }

  // The Final-score drum roll — the custom upload, or any bumper as a stand-in.
  function playDrumroll(): void {
    const { music } = store.getState()
    if (!music.enabled) return
    const track = pickForSlot('drumroll') ?? drumroll ?? pickBumper(tracks, music.lastTrackId, Math.random)
    if (!track) return
    try {
      clearFade()
      releaseAudio()
      fadeGain = 1
      audio = new Audio(track.url)
      currentName = track.name
      currentId = track.id
      currentSource = 'show'
      applyVolume()
      void audio.play().catch((err) => {
        console.warn('[audio] drum roll failed; continuing show:', err)
      })
      setPlaying(true)
      scheduleFade()
    } catch (err) {
      console.warn('[audio] could not start drum roll; continuing show:', err)
    }
  }

  // A run-out / run-in moment: play a random song from that moment's pool. Like a
  // bumper, it fades out after a while rather than running on forever.
  function playMoment(kind: MomentKind): void {
    const { music } = store.getState()
    if (!music.enabled) return
    const tagged = pickForSlot(kind === 'out' ? 'runOut' : 'runIn')
    const track = tagged ?? pickFromPool(momentTracks[kind])
    if (!track) return
    try {
      clearFade()
      releaseAudio()
      fadeGain = 1
      audio = new Audio(track.url)
      currentName = track.name
      currentId = track.id
      currentSource = 'show'
      applyVolume()
      // Free the element if the song finishes on its own (no auto-fade to do it).
      audio.addEventListener('ended', () => releaseAudio(), { once: true })
      void audio.play().catch((err) => {
        console.warn('[audio] moment playback failed; continuing show:', err)
      })
      // No auto-fade: the song rides until the operator cues the next scene,
      // which triggers the slow graceful fade (see the scene-change hook below).
      currentIsMoment = true
    } catch (err) {
      console.warn('[audio] could not start moment audio; continuing show:', err)
    }
  }

  const unsubscribe = store.subscribe(() => {
    const s = store.getState()
    // Final score started → drum roll. The celebration bumper comes later, when
    // revealNonce bumps at the 'celebrate' step (handled below).
    if (s.finaleNonce !== lastFinaleNonce) {
      lastFinaleNonce = s.finaleNonce
      playDrumroll()
    }
    if (s.revealNonce !== lastNonce) {
      lastNonce = s.revealNonce
      // The Final-score celebration runs long — let its song play out instead of
      // fading after 15s. Normal reveals still fade.
      const isFinaleCelebration = s.revealPhase === 'finale' && s.finaleStage === 'celebrate'
      playBumper(true, !isFinaleCelebration)
    }
    // STOP kill switch: fade the current sound out fast.
    if (s.stopNonce !== lastStopNonce) {
      lastStopNonce = s.stopNonce
      if (currentSource === 'show') fadeOutOver(STOP_FADE_MS)
    }
    // "Fade music out" kill switch: a slow, graceful ramp to silence. Unlike STOP
    // it isn't tied to the reveal, and unlike Black it leaves the scene/slide up.
    if (s.audioFadeNonce !== lastAudioFadeNonce) {
      lastAudioFadeNonce = s.audioFadeNonce
      running = null
      fadeOutOver(KILL_FADE_MS)
    }
    // A slide was revealed → act on its music cue. revealAnimNonce bumps only on
    // Reveal (not silent), so a quiet update never trips a cue.
    //   • a blackout beat, or a "No music" cue → gracefully fade what's playing
    //   • a track cue → start that track (rides; no-restart if it's already on)
    //   • a generic captain (deck quick button, no cue) → a random bumper from
    //     the score-music folder, so the captain intro has some hype behind it
    //   • otherwise (Continue) → leave the audio alone
    if (s.revealAnimNonce !== lastAnimNonce) {
      lastAnimNonce = s.revealAnimNonce
      const live = s.scene === 'slides' ? s.slides.live : null
      const isBlackout = live?.type === 'show' && live.beat === 'blackout'
      const isGenericCaptain = live?.type === 'show' && !!live.generic
      const cue = live && 'cue' in live ? live.cue : undefined
      if (isBlackout || cue?.silence) fadeOutOver(BLACK_FADE_MS)
      else if (cue?.trackId) playTrackById(cue.trackId)
      else if (isGenericCaptain) {
        const tagged = pickForSlot('captain')
        if (tagged) playLoadedTrack(tagged, true, 'show')
        else playBumper(false) // untagged: the old random score-folder track
      }
    }
    // The soundboard asked for a song. Deliberately NOT gated on music.enabled:
    // that switch means "play music on reveals", and someone who turns reveal
    // bumpers off still expects their pads to work.
    if (s.soundTagCueNonce !== lastSoundTagCueNonce) {
      lastSoundTagCueNonce = s.soundTagCueNonce
      if (s.soundTagCue) playTagCue(s.soundTagCue.tag, s.soundTagCue.mode)
    }
    if (s.soundCueNonce !== lastSoundCueNonce) {
      lastSoundCueNonce = s.soundCueNonce
      if (s.soundCueTrackId) playSoundTrack(s.soundCueTrackId)
    }
    if (s.soundSeekNonce !== lastSoundSeekNonce) {
      lastSoundSeekNonce = s.soundSeekNonce
      // Seeking past the end (or before metadata has loaded) would throw; a
      // scrub must never be able to interrupt the show.
      if (audio && Number.isFinite(audio.duration)) {
        try {
          audio.currentTime = Math.min(s.soundSeekTo, audio.duration)
        } catch (err) {
          console.warn('[audio] seek failed; continuing show:', err)
        }
      }
    }
    if (s.soundStopNonce !== lastSoundStopNonce) {
      lastSoundStopNonce = s.soundStopNonce
      running = null // Stop means stop, not "stop this song and start the next"
      fadeOutOver(SOUND_STOP_FADE_MS)
    }
    // Run-out / run-in moment fired → play a random song from its pool.
    if (s.momentNonce !== lastMomentNonce) {
      lastMomentNonce = s.momentNonce
      playMoment(s.moment?.kind ?? 'out')
    }
    // Going to Black gracefully fades SHOW audio over ~7.5s — the operator's
    // "cue to black" doubles as "take the music down." It leaves soundboard
    // music alone: blanking the projector between bits shouldn't kill the house
    // music a pad started. (STOP stays the fast hard-cut; this is the musical
    // one.) The soundboard's own Stop still takes down anything.
    if (s.scene === 'black' && lastScene !== 'black' && currentSource === 'show') {
      fadeOutOver(BLACK_FADE_MS)
    }
    // Leaving a moment for any other scene gracefully fades the moment song out
    // over several seconds — the operator's "let it ride, then cue away" gesture.
    // Skipped if the new scene started its own music (a reveal), which already
    // replaced the track above, so currentIsMoment is no longer true.
    else if (lastScene === 'moment' && s.scene !== 'moment' && currentIsMoment) {
      fadeOutOver(MOMENT_LEAVE_FADE_MS)
    }
    lastScene = s.scene
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
    setDrumroll(track) {
      if (drumroll) URL.revokeObjectURL(drumroll.url) // no-op for sbmedia:// URLs
      drumroll = track
    },
    setMomentTracks(kind, next) {
      for (const t of momentTracks[kind]) URL.revokeObjectURL(t.url) // no-op for sbmedia://
      momentTracks[kind] = next
    },
    setSoundTracks(next) {
      for (const t of soundTracks) URL.revokeObjectURL(t.url) // no-op for sbmedia://
      soundTracks = next
    },
    getProgress() {
      return {
        name: currentName,
        trackId: currentId,
        position: audio?.currentTime ?? 0,
        // duration is NaN until metadata loads; report 0 so the bar can say
        // "not yet" rather than rendering a NaN-wide fill.
        duration: audio && Number.isFinite(audio.duration) ? audio.duration : 0,
        playing: !!audio && !audio.paused && !audio.ended,
      }
    },
    test() {
      playBumper(false)
    },
    stop() {
      clearFade()
      releaseAudio()
    },
    dispose() {
      clearFade()
      unsubscribe()
      releaseAudio()
      // Revoke every object URL we hold, not just the bumpers (no-op for
      // sbmedia:// URLs), so teardown doesn't leak the drum roll / moment songs.
      for (const t of tracks) URL.revokeObjectURL(t.url)
      if (drumroll) URL.revokeObjectURL(drumroll.url)
      for (const t of momentTracks.out) URL.revokeObjectURL(t.url)
      for (const t of momentTracks.in) URL.revokeObjectURL(t.url)
      for (const t of soundTracks) URL.revokeObjectURL(t.url)
      tracks = []
      soundTracks = []
      drumroll = null
      momentTracks.out = []
      momentTracks.in = []
    },
  }
}
