// The one place application state changes. Pure function: (state, command) => state.
// No timers, no I/O, no randomness — all of that lives in services layered on top,
// which keeps this trivially testable on a MacBook (Principles: "Build for Testability").

import type { Command } from './commands'
import type { AppState, Slide, SlideDeck, TeamId, TeamState } from './state'
import { emptySlideshowSlide, emptyImageSlide, emptyTextSlide, logoSlide, showSlide } from './state'
import { determineWinner } from './winner'

// Map over the Slides deck, replacing the slide with matching id.
function updateSlide(state: AppState, id: string, fn: (s: Slide) => Slide): AppState {
  return {
    ...state,
    slides: {
      ...state.slides,
      items: state.slides.items.map((s) => (s.id === id ? fn(s) : s)),
    },
  }
}

function setTeam(
  state: AppState,
  team: TeamId,
  patch: Partial<TeamState>,
): AppState {
  return {
    ...state,
    teams: { ...state.teams, [team]: { ...state.teams[team], ...patch } },
  }
}

function bumpPending(state: AppState, team: TeamId, delta: number): AppState {
  // No clamping: negative scores are allowed (occasional bit).
  return setTeam(state, team, { pendingScore: state.teams[team].pendingScore + delta })
}

// Publish the drafted board — scores, half, and audience — to the live values
// the projector renders. Nothing on the board reaches the audience until this
// runs (via Reveal or update-silently). Winner is derived from the new scores.
function publishBoard(state: AppState): AppState {
  const blueLive = state.teams.blue.pendingScore
  const redLive = state.teams.red.pendingScore
  return {
    ...state,
    teams: {
      blue: { ...state.teams.blue, liveScore: blueLive },
      red: { ...state.teams.red, liveScore: redLive },
    },
    halfLive: state.half,
    audienceLive: { ...state.audience },
    ribbonsLive: { ...state.ribbons },
    lastWinner: determineWinner(blueLive, redLive),
  }
}

// Put the slide at `index` of a deck on air and mark the playhead there — the
// engine behind Start / Next / Prev. Bumps revealAnimNonce so the entrance
// animation + the slide's cue (music/effect) fire, exactly like a normal reveal.
// Index clamps to the deck; an empty deck just parks the playhead on black.
function airDeckSlide(state: AppState, deck: SlideDeck, index: number): AppState {
  const items = state.slides.items.filter((s) => s.deck === deck)
  if (items.length === 0) {
    return { ...state, presentation: { deck, index: 0 }, scene: 'black', displayWasReveal: false }
  }
  const i = Math.max(0, Math.min(items.length - 1, index))
  const slide = items[i]
  return {
    ...state,
    slides: { ...state.slides, selectedId: slide.id, live: slide },
    scene: 'slides',
    displayWasReveal: true,
    revealAnimNonce: state.revealAnimNonce + 1,
    music: { ...state.music, duck: 1 },
    presentation: { deck, index: i },
  }
}

function baseReduce(state: AppState, command: Command): AppState {
  switch (command.type) {
    case 'live.toggle':
      return { ...state, liveMode: !state.liveMode }
    case 'blue.increment':
      return bumpPending(state, 'blue', +1)
    case 'blue.decrement':
      return bumpPending(state, 'blue', -1)
    case 'red.increment':
      return bumpPending(state, 'red', +1)
    case 'red.decrement':
      return bumpPending(state, 'red', -1)

    case 'team.bumpScore':
      return bumpPending(state, command.team, command.delta)
    case 'team.setScore':
      return setTeam(state, command.team, { pendingScore: command.value })
    case 'team.setName':
      return setTeam(state, command.team, { name: command.name })
    case 'team.setMood':
      return setTeam(state, command.team, { mood: command.mood })

    case 'audience.increment':
      return { ...state, audience: { ...state.audience, score: state.audience.score + 1 } }
    case 'audience.decrement':
      return { ...state, audience: { ...state.audience, score: state.audience.score - 1 } }
    case 'audience.setLabel':
      return { ...state, audience: { ...state.audience, label: command.label } }
    case 'audience.setVisible':
      return { ...state, audience: { ...state.audience, visible: command.visible } }

    case 'ribbons.setHome':
      return { ...state, ribbons: { ...state.ribbons, home: command.value } }
    case 'ribbons.setAway':
      return { ...state, ribbons: { ...state.ribbons, away: command.value } }
    case 'ribbons.setVisible':
      return { ...state, ribbons: { ...state.ribbons, visible: command.visible } }

    case 'half.toggle':
      return { ...state, half: state.half === 'first' ? 'second' : 'first' }
    case 'half.set':
      return { ...state, half: command.half }

    case 'display.set':
      // Going to Black clears the GIF overlay too (a clean reset of the screen).
      return {
        ...state,
        scene: command.scene,
        displayWasReveal: false,
        gifOverlay: command.scene === 'black' ? null : state.gifOverlay,
      }
    case 'display.reveal':
      // A slide's cue effect + music fire on Reveal (never on a silent update),
      // but on a delay so they land AFTER the slide's entrance animation — that's
      // timed I/O, so the reveal service (effect) and audio controller (music)
      // drive them off revealAnimNonce rather than the pure reducer.
      return {
        ...state,
        scene: command.scene,
        displayWasReveal: true,
        revealAnimNonce: state.revealAnimNonce + 1,
        music: { ...state.music, duck: 1 }, // revealing something else un-ducks
      }

    case 'slide.select':
      return { ...state, slides: { ...state.slides, selectedId: command.id } }
    case 'slide.commit': {
      // Publish the selected slide. `live` holds the exact object reference so a
      // later edit (which produces a new object) reads as "dirty" until re-committed.
      const sel = state.slides.items.find((s) => s.id === state.slides.selectedId) ?? null
      return { ...state, slides: { ...state.slides, live: sel } }
    }
    case 'show.captain': {
      // The deck's quick captain buttons fire a GENERIC captain intro — a
      // transient card (never added to a deck, never persisted) that shows the
      // live team name, ignoring any scripted captain slide's name. This keeps
      // the buttons working regardless of what's in the Show sequence. Reveals
      // in one step (sets live + plays the entrance), leaving the selection put.
      const beat =
        command.which === 'blue' ? 'captain-blue' : command.which === 'red' ? 'captain-red' : 'captains'
      const live: Slide = { ...showSlide(`__captain-${command.which}`, beat, 'show'), generic: true }
      return {
        ...state,
        slides: { ...state.slides, live },
        scene: 'slides',
        displayWasReveal: true,
        revealAnimNonce: state.revealAnimNonce + 1,
        music: { ...state.music, duck: 1 },
      }
    }
    case 'slide.addMany':
      // Append pre-built slides (the operator already gave them fresh ids) and
      // select the first — used to stamp a saved template into a deck.
      return {
        ...state,
        slides: {
          ...state.slides,
          items: [...state.slides.items, ...command.slides],
          selectedId: command.slides[0]?.id ?? state.slides.selectedId,
        },
      }
    case 'template.saveNew':
      // Saving becomes the deck's active template — you're now "on" it.
      return {
        ...state,
        savedTemplates: [
          ...state.savedTemplates,
          { id: command.id, deck: command.deck, name: command.name, slides: command.slides },
        ],
        activeTemplate: { ...state.activeTemplate, [command.deck]: command.id },
      }
    case 'template.update':
      return {
        ...state,
        savedTemplates: state.savedTemplates.map((t) =>
          t.id === command.id ? { ...t, slides: command.slides } : t,
        ),
      }
    case 'template.rename':
      return {
        ...state,
        savedTemplates: state.savedTemplates.map((t) =>
          t.id === command.id ? { ...t, name: command.name } : t,
        ),
      }
    case 'template.remove': {
      // Clear the active pointer on any deck that pointed at the deleted template.
      const activeTemplate = { ...state.activeTemplate }
      for (const deck of Object.keys(activeTemplate) as (keyof typeof activeTemplate)[]) {
        if (activeTemplate[deck] === command.id) activeTemplate[deck] = null
      }
      return { ...state, savedTemplates: state.savedTemplates.filter((t) => t.id !== command.id), activeTemplate }
    }
    case 'template.setActive':
      return { ...state, activeTemplate: { ...state.activeTemplate, [command.deck]: command.id } }
    case 'slideshow.save':
      return {
        ...state,
        savedSlideshows: [...state.savedSlideshows, { id: command.id, name: command.name, url: command.url }],
      }
    case 'slideshow.update':
      return {
        ...state,
        savedSlideshows: state.savedSlideshows.map((s) =>
          s.id === command.id ? { ...s, name: command.name, url: command.url } : s,
        ),
      }
    case 'slideshow.remove':
      return { ...state, savedSlideshows: state.savedSlideshows.filter((s) => s.id !== command.id) }
    case 'present.start':
      return airDeckSlide(state, command.deck, 0)
    case 'present.next':
      return state.presentation ? airDeckSlide(state, state.presentation.deck, state.presentation.index + 1) : state
    case 'present.prev':
      return state.presentation ? airDeckSlide(state, state.presentation.deck, state.presentation.index - 1) : state
    case 'present.goto':
      return state.presentation ? airDeckSlide(state, state.presentation.deck, command.index) : state
    case 'present.stop':
      // Exit the cue stack back to the flat list, and cut to black.
      return { ...state, presentation: null, scene: 'black', displayWasReveal: false }
    case 'slide.addLogo':
      return {
        ...state,
        slides: {
          ...state.slides,
          items: [...state.slides.items, logoSlide(command.id, command.name, command.src, '', command.deck ?? 'show')],
          selectedId: command.id,
        },
      }
    case 'slide.addText':
      return {
        ...state,
        slides: {
          ...state.slides,
          items: [...state.slides.items, emptyTextSlide(command.id, command.template, command.deck ?? 'show', command.theme)],
          selectedId: command.id,
        },
      }
    case 'slide.addImage':
      return {
        ...state,
        slides: {
          ...state.slides,
          items: [...state.slides.items, emptyImageSlide(command.id, '', command.deck ?? 'show')],
          selectedId: command.id,
        },
      }
    case 'slide.addSlideshow':
      return {
        ...state,
        slides: {
          ...state.slides,
          items: [...state.slides.items, emptySlideshowSlide(command.id, '', command.deck ?? 'show')],
          selectedId: command.id,
        },
      }
    case 'slide.addShow':
      return {
        ...state,
        slides: {
          ...state.slides,
          items: [...state.slides.items, showSlide(command.id, command.beat, command.deck ?? 'show')],
          selectedId: command.id,
        },
      }
    case 'slide.setShowField':
      return updateSlide(state, command.id, (s) => (s.type === 'show' ? { ...s, [command.field]: command.value } : s))
    case 'slide.setCue':
      return updateSlide(state, command.id, (s) => {
        if (s.type !== 'show') return s
        // Drop an empty cue entirely so a bare {} never lingers on the slide.
        const c = command.cue
        const cue = c.effect || c.trackId || c.silence ? c : undefined
        return { ...s, cue }
      })
    case 'slide.setImage':
      return updateSlide(state, command.id, (s) => (s.type === 'image' ? { ...s, src: command.src } : s))
    case 'slide.setSlideshowUrl':
      return updateSlide(state, command.id, (s) => (s.type === 'slideshow' ? { ...s, url: command.url } : s))
    case 'slide.remove': {
      const items = state.slides.items.filter((s) => s.id !== command.id)
      const selectedId =
        state.slides.selectedId === command.id ? (items[0]?.id ?? '') : state.slides.selectedId
      return { ...state, slides: { ...state.slides, items, selectedId } }
    }
    case 'slide.clearDeck': {
      // Wipe one deck (Show or Games). Loading a game template replaces the
      // deck's contents rather than piling onto them. If the selection lived in
      // the wiped deck, hand it to whatever survives (or clear it).
      const items = state.slides.items.filter((s) => s.deck !== command.deck)
      const selectedId = items.some((s) => s.id === state.slides.selectedId)
        ? state.slides.selectedId
        : (items[0]?.id ?? '')
      return { ...state, slides: { ...state.slides, items, selectedId } }
    }
    case 'slide.reorder': {
      // Rebuild the deck in the given id order. Any item not named in `ids`
      // (shouldn't happen, but be safe) keeps its place at the end, so a reorder
      // can never drop a slide. selectedId/live are untouched.
      const byId = new Map(state.slides.items.map((s) => [s.id, s]))
      const ordered = command.ids
        .map((id) => byId.get(id))
        .filter((s): s is Slide => s !== undefined)
      const rest = state.slides.items.filter((s) => !command.ids.includes(s.id))
      return { ...state, slides: { ...state.slides, items: [...ordered, ...rest] } }
    }
    case 'slide.setWebsite':
      return updateSlide(state, command.id, (s) =>
        s.type === 'logo' ? { ...s, website: command.website } : s,
      )
    case 'slide.setTemplate':
      return updateSlide(state, command.id, (s) =>
        s.type === 'text' ? { ...s, template: command.template } : s,
      )
    case 'slide.setLiveType':
      return updateSlide(state, command.id, (s) =>
        s.type === 'text' ? { ...s, liveType: command.value } : s,
      )
    case 'slide.setField':
      return updateSlide(state, command.id, (s) =>
        s.type === 'text' ? { ...s, [command.field]: command.value } : s,
      )
    case 'slide.setQuad':
      return updateSlide(state, command.id, (s) => {
        if (s.type !== 'text') return s
        const quads = [...s.quads] as [string, string, string, string]
        quads[command.index] = command.value
        return { ...s, quads }
      })

    case 'score.reveal':
      // Publish the whole board, then run the reveal ceremony. The Final-score
      // phase ('end') starts a timed sequence: bump finaleNonce (drum roll) and
      // enter 'tabulating' — the celebration bumper + confetti wait for the
      // 'celebrate' step, so revealNonce is NOT bumped here.
      // Revealing "something else" un-ducks the music (reset the dial's dip to 1).
      return state.half === 'end'
        ? {
            ...publishBoard(state),
            revealPhase: 'finale',
            finaleStage: 'tabulating',
            revealStyle: command.style ?? 'pop',
            revealSettled: false,
            countdown: 0,
            finaleNonce: state.finaleNonce + 1,
            music: { ...state.music, duck: 1 },
          }
        : {
            ...publishBoard(state),
            revealPhase: 'revealing',
            revealStyle: command.style ?? 'pop',
            revealSettled: false,
            revealNonce: state.revealNonce + 1,
            music: { ...state.music, duck: 1 },
          }

    case 'finale.countdown':
      return { ...state, finaleStage: 'countdown', countdown: command.value }

    case 'finale.celebrate':
      // Winner takeover. Bumping revealNonce now fires the confetti, emoji rain,
      // and the high-energy bumper — the exact celebration a normal reveal uses.
      return {
        ...state,
        finaleStage: 'celebrate',
        revealNonce: state.revealNonce + 1,
        music: { ...state.music, duck: 1 },
      }

    case 'reveal.finish':
      return { ...state, revealPhase: 'idle', finaleStage: 'idle', revealSettled: false, countdown: 0 }

    case 'reveal.stop': {
      // Kill switch. A finale jumps to and FREEZES its winner takeover (that's
      // the finale's "end frame"): stay in 'finale'/'celebrate' but mark settled
      // so it holds silently instead of auto-advancing. We do NOT bump revealNonce
      // — no fresh confetti/bumper; the winner card just reads current live scores.
      // A normal reveal has no separate end card, so it settles to the plain
      // scoreboard (idle). Either way, stopNonce fires the audio fade + timer
      // cancel. Guarded by !anyDirty at the call site, so a pending edit reveals
      // instead of stopping.
      const finale = state.revealPhase === 'finale'
      return {
        ...state,
        revealPhase: finale ? 'finale' : 'idle',
        finaleStage: finale ? 'celebrate' : 'idle',
        revealSettled: finale,
        countdown: 0,
        stopNonce: state.stopNonce + 1,
      }
    }

    case 'effect.fire':
      return { ...state, effect: { kind: command.kind, nonce: state.effect.nonce + 1 } }

    case 'wash.hold':
      return { ...state, washHold: command.kind }
    case 'wash.release':
      return { ...state, washHold: null }

    case 'gif.overlay':
      return { ...state, gifOverlay: command.src }

    case 'moment.play':
      // Show the chosen run-out / run-in visual full-screen. It stays up until
      // the operator cues the next thing (reveal / slide / black). The random
      // pick was made operator-side, so the reducer just records it.
      return {
        ...state,
        scene: 'moment',
        moment: { kind: command.kind, visual: command.visual },
        momentNonce: state.momentNonce + 1,
        music: { ...state.music, duck: 1 }, // a fresh cue plays at full volume
      }

    case 'audio.setPlaying':
      return { ...state, audioPlaying: command.value }
    case 'audio.fadeOut':
      return { ...state, audioFadeNonce: state.audioFadeNonce + 1 }

    case 'score.commitSilent':
      // Publish the board with no ceremony — no revealNonce/revealPhase change,
      // so the reveal service and audio controller stay silent.
      return publishBoard(state)

    case 'score.revertPending':
      // Discard every drafted board change back to what's live.
      return {
        ...state,
        teams: {
          blue: { ...state.teams.blue, pendingScore: state.teams.blue.liveScore },
          red: { ...state.teams.red, pendingScore: state.teams.red.liveScore },
        },
        half: state.halfLive,
        audience: { ...state.audienceLive },
        ribbons: { ...state.ribbonsLive },
      }

    case 'music.setVolume':
      return { ...state, music: { ...state.music, volume: command.volume } }
    case 'music.nudgeDuck': {
      const duck = Math.max(0, Math.min(1, state.music.duck + command.delta))
      return { ...state, music: { ...state.music, duck } }
    }
    case 'music.setEnabled':
      return { ...state, music: { ...state.music, enabled: command.enabled } }
    case 'music.setLibrary':
      return {
        ...state,
        music: {
          ...state.music,
          library: command.tracks,
          librarySize: command.tracks.length,
          // Drop a stale pick if that track is no longer in the library.
          nextTrackId:
            state.music.nextTrackId && command.tracks.some((t) => t.id === state.music.nextTrackId)
              ? state.music.nextTrackId
              : null,
        },
      }
    case 'music.setNextTrack':
      return { ...state, music: { ...state.music, nextTrackId: command.id } }
    case 'music.trackPlayed':
      return {
        ...state,
        music: { ...state.music, lastTrackId: command.id, lastTrackName: command.name },
      }

    // An unrecognized command (e.g. a newer renderer talking to an older main
    // process) must NEVER poison the state by returning undefined. Ignore it and
    // keep the current state (Principles: fail gracefully, never crash).
    default:
      return state
  }
}

// Board commands whose change should hit the projector immediately in LIVE mode
// (publish pending → live, no celebration). Score / half / audience / ribbons.
const LIVE_BOARD_CMDS = new Set<Command['type']>([
  'blue.increment',
  'blue.decrement',
  'red.increment',
  'red.decrement',
  'team.bumpScore',
  'team.setScore',
  'half.toggle',
  'half.set',
  'audience.increment',
  'audience.decrement',
  'audience.setLabel',
  'audience.setVisible',
  'ribbons.setHome',
  'ribbons.setAway',
  'ribbons.setVisible',
])
// Slide-content edits that should mirror to the on-air slide in LIVE mode.
const LIVE_EDIT_CMDS = new Set<Command['type']>([
  'slide.setField',
  'slide.setQuad',
  'slide.setShowField',
  'slide.setImage',
  'slide.setSlideshowUrl',
])

// LIVE mode wraps the pure reducer: after the normal update, reflect the change
// on the projector at once. Selecting a slide auto-reveals it (animation + cues,
// via the revealAnimNonce the reveal service / audio controller watch); board
// edits publish silently; edits to the on-air slide mirror through. When live is
// off this is a no-op passthrough, so the staged Preview/Program flow is intact.
export function reduce(state: AppState, command: Command): AppState {
  const next = baseReduce(state, command)
  if (!next.liveMode) return next

  if (command.type === 'slide.select') {
    const slide = next.slides.items.find((s) => s.id === next.slides.selectedId)
    if (!slide) return next
    return {
      ...next,
      slides: { ...next.slides, live: slide },
      scene: 'slides',
      displayWasReveal: true,
      revealAnimNonce: next.revealAnimNonce + 1,
      music: { ...next.music, duck: 1 },
    }
  }
  if (LIVE_BOARD_CMDS.has(command.type)) {
    // Editing the board while live publishes it AND shows the scoreboard, so the
    // score is reachable on air — but silently: no celebration animation / music
    // (a score changes every point; it shouldn't fanfare each time, unlike a slide).
    return { ...publishBoard(next), scene: 'scoreboard', displayWasReveal: false }
  }
  if (LIVE_EDIT_CMDS.has(command.type) && 'id' in command) {
    const live = next.slides.live
    if (live && command.id === live.id) {
      const updated = next.slides.items.find((s) => s.id === live.id)
      if (updated) return { ...next, slides: { ...next.slides, live: updated } }
    }
  }
  return next
}
