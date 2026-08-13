// The one place application state changes. Pure function: (state, command) => state.
// No timers, no I/O, no randomness — all of that lives in services layered on top,
// which keeps this trivially testable on a MacBook (Principles: "Build for Testability").

import type { Command } from './commands'
import type { AppState, Slide, TeamId, TeamState } from './state'
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

export function reduce(state: AppState, command: Command): AppState {
  switch (command.type) {
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
    case 'audience.setScore':
      return { ...state, audience: { ...state.audience, score: command.value } }
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
    case 'display.reveal': {
      // A slide's cue fires on Reveal (never on a silent update). The effect is
      // pure state (bump the effect nonce); the bound music is I/O, so the audio
      // controller starts it when it sees revealAnimNonce move.
      const live = state.slides.live
      const cueEffect =
        command.scene === 'slides' && live && 'cue' in live ? live.cue?.effect : undefined
      return {
        ...state,
        scene: command.scene,
        displayWasReveal: true,
        revealAnimNonce: state.revealAnimNonce + 1,
        music: { ...state.music, duck: 1 }, // revealing something else un-ducks
        effect: cueEffect ? { kind: cueEffect, nonce: state.effect.nonce + 1 } : state.effect,
      }
    }

    case 'slide.select':
      return { ...state, slides: { ...state.slides, selectedId: command.id } }
    case 'slide.commit': {
      // Publish the selected slide. `live` holds the exact object reference so a
      // later edit (which produces a new object) reads as "dirty" until re-committed.
      const sel = state.slides.items.find((s) => s.id === state.slides.selectedId) ?? null
      return { ...state, slides: { ...state.slides, live: sel } }
    }
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
        const cue = command.cue.effect || command.cue.trackId ? command.cue : undefined
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
