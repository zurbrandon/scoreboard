// The entire application state. This object is plain, serializable JSON at all
// times (Engineering Principles: "State Is Serializable"). There is exactly one
// of these — see src/store/store.ts for the single owner.

import { LOGO_LIBRARY } from './logos'

export type TeamId = 'blue' | 'red'
// Match phase. 'end' is the finale — Reveal triggers the winner celebration.
export type Half = 'first' | 'second' | 'end'

export type Scene =
  | 'scoreboard'
  | 'logo'
  | 'text'
  | 'slideshow'
  | 'black'

export type RevealPhase = 'idle' | 'revealing' | 'finale'
export type Winner = TeamId | 'tie'

export interface TeamState {
  name: string
  /** What the audience currently sees. Only ever changed by score.reveal. */
  liveScore: number
  /** Operator's working score. Hidden from the audience until reveal. */
  pendingScore: number
  /** Emoji mood. '' when unset. Rendered lightly in M1, richer later. */
  mood: string
}

export interface MusicState {
  volume: number // 0..1
  enabled: boolean
  /** Id of the most recently played bumper — used to avoid immediate repeats. */
  lastTrackId: string | null
  /** Name of the most recent bumper, for the operator's "music status" display. */
  lastTrackName: string | null
  /** How many bumpers are currently loaded (for status; tracks live in the service). */
  librarySize: number
}

export interface AppState {
  teams: Record<TeamId, TeamState>
  /** Jokey audience tally. Updates immediately — no reveal ceremony. */
  audienceScore: number
  /** Toggling the half swaps which side each team renders on. */
  half: Half
  scene: Scene
  /** Logo scene selection. draftId is what the operator has picked (preview);
   *  liveId is what the projector shows. Reveal commits draft → live. */
  logo: { draftId: string; liveId: string }
  /** Text scene content. draft = what the operator is typing (preview); live =
   *  what the projector shows. Reveal commits draft → live. */
  text: { draft: string; live: string }
  /** URL loaded in the Slideshow scene (e.g. a published Google Slides embed link). */
  slideshowUrl: string
  revealPhase: RevealPhase
  /** Result of the most recent reveal. null before the first reveal. */
  lastWinner: Winner | null
  /** Bumped on every reveal so views can re-trigger effects (confetti) even
   *  when the winner is unchanged. Views compare it against the last value seen. */
  revealNonce: number
  music: MusicState
}

export function createInitialState(): AppState {
  return {
    teams: {
      blue: { name: 'Blue', liveScore: 0, pendingScore: 0, mood: '' },
      red: { name: 'Red', liveScore: 0, pendingScore: 0, mood: '' },
    },
    audienceScore: 0,
    half: 'first',
    scene: 'scoreboard',
    logo: { draftId: LOGO_LIBRARY[0].id, liveId: LOGO_LIBRARY[0].id },
    text: { draft: '', live: '' },
    slideshowUrl: '',
    revealPhase: 'idle',
    lastWinner: null,
    revealNonce: 0,
    music: {
      volume: 0.8,
      enabled: true,
      lastTrackId: null,
      lastTrackName: null,
      librarySize: 0,
    },
  }
}
