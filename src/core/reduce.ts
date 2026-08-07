// The one place application state changes. Pure function: (state, command) => state.
// No timers, no I/O, no randomness — all of that lives in services layered on top,
// which keeps this trivially testable on a MacBook (Principles: "Build for Testability").

import type { Command } from './commands'
import type { AppState, TeamId, TeamState } from './state'
import { emptySlide, emptyTextCard } from './state'
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
      return { ...state, scene: command.scene, displayWasReveal: false }
    case 'display.reveal':
      return {
        ...state,
        scene: command.scene,
        displayWasReveal: true,
        revealAnimNonce: state.revealAnimNonce + 1,
      }

    case 'logo.select':
      return { ...state, logo: { ...state.logo, draftId: command.id } }
    case 'logo.commit':
      return { ...state, logo: { ...state.logo, liveId: state.logo.draftId } }
    case 'logo.setWebsite':
      return {
        ...state,
        logos: state.logos.map((l) => (l.id === command.id ? { ...l, website: command.website } : l)),
      }
    case 'logo.add':
      return {
        ...state,
        logos: [...state.logos, { id: command.id, name: command.name, website: '', src: command.src }],
        logo: { ...state.logo, draftId: command.id }, // preview the new one immediately
      }
    case 'logo.remove': {
      const logos = state.logos.filter((l) => l.id !== command.id)
      const fallback = logos[0]?.id ?? ''
      // Keep the selection valid if it pointed at the removed logo.
      return {
        ...state,
        logos,
        logo: {
          draftId: state.logo.draftId === command.id ? fallback : state.logo.draftId,
          liveId: state.logo.liveId === command.id ? fallback : state.logo.liveId,
        },
      }
    }

    case 'text.addCard':
      return {
        ...state,
        text: {
          ...state.text,
          cards: [...state.text.cards, emptyTextCard(command.id)],
          selectedId: command.id,
        },
      }
    case 'text.removeCard': {
      if (state.text.cards.length <= 1) return state // always keep one
      const cards = state.text.cards.filter((c) => c.id !== command.id)
      const selectedId =
        state.text.selectedId === command.id ? cards[0].id : state.text.selectedId
      return { ...state, text: { ...state.text, cards, selectedId } }
    }
    case 'text.selectCard':
      return { ...state, text: { ...state.text, selectedId: command.id } }
    case 'text.setTemplate':
      return {
        ...state,
        text: {
          ...state.text,
          cards: state.text.cards.map((c) =>
            c.id === command.id ? { ...c, template: command.template } : c,
          ),
        },
      }
    case 'text.setLiveType':
      return {
        ...state,
        text: {
          ...state.text,
          cards: state.text.cards.map((c) =>
            c.id === command.id ? { ...c, liveType: command.value } : c,
          ),
        },
      }
    case 'text.setField':
      return {
        ...state,
        text: {
          ...state.text,
          cards: state.text.cards.map((c) =>
            c.id === command.id ? { ...c, [command.field]: command.value } : c,
          ),
        },
      }
    case 'text.setQuad':
      return {
        ...state,
        text: {
          ...state.text,
          cards: state.text.cards.map((c) => {
            if (c.id !== command.id) return c
            const quads = [...c.quads] as [string, string, string, string]
            quads[command.index] = command.value
            return { ...c, quads }
          }),
        },
      }
    case 'text.commit': {
      const c = state.text.cards.find((card) => card.id === state.text.selectedId)
      if (!c) return state
      return {
        ...state,
        text: {
          ...state.text,
          live: {
            cardId: c.id,
            template: c.template,
            headline: c.headline,
            body: c.body,
            quads: c.quads,
          },
        },
      }
    }

    case 'slideshow.addSlide':
      return {
        ...state,
        slideshow: {
          ...state.slideshow,
          slides: [...state.slideshow.slides, emptySlide(command.id)],
          selectedId: command.id,
        },
      }
    case 'slideshow.removeSlide': {
      if (state.slideshow.slides.length <= 1) return state // always keep one
      const slides = state.slideshow.slides.filter((s) => s.id !== command.id)
      const selectedId =
        state.slideshow.selectedId === command.id ? slides[0].id : state.slideshow.selectedId
      return { ...state, slideshow: { ...state.slideshow, slides, selectedId } }
    }
    case 'slideshow.selectSlide':
      return { ...state, slideshow: { ...state.slideshow, selectedId: command.id } }
    case 'slideshow.setSlideUrl':
      return {
        ...state,
        slideshow: {
          ...state.slideshow,
          slides: state.slideshow.slides.map((s) =>
            s.id === command.id ? { ...s, url: command.url } : s,
          ),
        },
      }
    case 'slideshow.commit': {
      const slide = state.slideshow.slides.find((s) => s.id === state.slideshow.selectedId)
      return { ...state, slideshow: { ...state.slideshow, liveUrl: slide?.url ?? '' } }
    }

    case 'score.reveal':
      // Publish the whole board, then run the reveal ceremony. The Final-score
      // phase ('end') starts a timed sequence: bump finaleNonce (drum roll) and
      // enter 'tabulating' — the celebration bumper + confetti wait for the
      // 'celebrate' step, so revealNonce is NOT bumped here.
      return state.half === 'end'
        ? {
            ...publishBoard(state),
            revealPhase: 'finale',
            finaleStage: 'tabulating',
            countdown: 0,
            finaleNonce: state.finaleNonce + 1,
          }
        : {
            ...publishBoard(state),
            revealPhase: 'revealing',
            revealNonce: state.revealNonce + 1,
          }

    case 'finale.countdown':
      return { ...state, finaleStage: 'countdown', countdown: command.value }

    case 'finale.celebrate':
      // Winner takeover. Bumping revealNonce now fires the confetti, emoji rain,
      // and the high-energy bumper — the exact celebration a normal reveal uses.
      return { ...state, finaleStage: 'celebrate', revealNonce: state.revealNonce + 1 }

    case 'reveal.finish':
      return { ...state, revealPhase: 'idle', finaleStage: 'idle', countdown: 0 }

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
