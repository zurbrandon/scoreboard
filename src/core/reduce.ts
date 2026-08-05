// The one place application state changes. Pure function: (state, command) => state.
// No timers, no I/O, no randomness — all of that lives in services layered on top,
// which keeps this trivially testable on a MacBook (Principles: "Build for Testability").

import type { Command } from './commands'
import type { AppState, TeamId, TeamState } from './state'
import { determineWinner } from './winner'

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

    case 'team.setScore':
      return setTeam(state, command.team, { pendingScore: command.value })
    case 'team.setName':
      return setTeam(state, command.team, { name: command.name })
    case 'team.setMood':
      return setTeam(state, command.team, { mood: command.mood })

    case 'audience.increment':
      return { ...state, audienceScore: state.audienceScore + 1 }
    case 'audience.decrement':
      return { ...state, audienceScore: state.audienceScore - 1 }
    case 'audience.setScore':
      return { ...state, audienceScore: command.value }

    case 'half.toggle':
      return { ...state, half: state.half === 'first' ? 'second' : 'first' }
    case 'half.set':
      return { ...state, half: command.half }

    case 'display.set':
      return { ...state, scene: command.scene }

    case 'slideshow.setUrl':
      return { ...state, slideshowUrl: command.url }

    case 'score.reveal': {
      // Reveal is atomic: both teams' pending become live in one step, then the
      // winner is derived from the freshly-revealed live scores. Animation and
      // music are orchestrated OUTSIDE the reducer (M2/M3) off revealPhase.
      const blueLive = state.teams.blue.pendingScore
      const redLive = state.teams.red.pendingScore
      return {
        ...state,
        teams: {
          blue: { ...state.teams.blue, liveScore: blueLive },
          red: { ...state.teams.red, liveScore: redLive },
        },
        lastWinner: determineWinner(blueLive, redLive),
        revealPhase: 'revealing',
        revealNonce: state.revealNonce + 1,
      }
    }

    case 'reveal.finish':
      return { ...state, revealPhase: 'idle' }

    case 'score.commitSilent': {
      // Quick correction: push pending → live with no ceremony. Crucially it
      // does NOT bump revealNonce or touch revealPhase, so the reveal service
      // and audio controller stay silent.
      const blueLive = state.teams.blue.pendingScore
      const redLive = state.teams.red.pendingScore
      return {
        ...state,
        teams: {
          blue: { ...state.teams.blue, liveScore: blueLive },
          red: { ...state.teams.red, liveScore: redLive },
        },
        lastWinner: determineWinner(blueLive, redLive),
      }
    }

    case 'score.revertPending':
      return {
        ...state,
        teams: {
          blue: { ...state.teams.blue, pendingScore: state.teams.blue.liveScore },
          red: { ...state.teams.red, pendingScore: state.teams.red.liveScore },
        },
      }

    case 'music.setVolume':
      return { ...state, music: { ...state.music, volume: command.volume } }
    case 'music.setEnabled':
      return { ...state, music: { ...state.music, enabled: command.enabled } }
    case 'music.setLibrarySize':
      return { ...state, music: { ...state.music, librarySize: command.size } }
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
