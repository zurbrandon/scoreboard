// The entire application state. This object is plain, serializable JSON at all
// times (Engineering Principles: "State Is Serializable"). There is exactly one
// of these — see src/store/store.ts for the single owner.

import type { BumperTrack } from './bumper'
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

// Each Text card renders with one of these templates on the projector:
//  - basic:     a headline + body line (the default)
//  - quadrants: four words in a 2x2 grid (top-left, top-right, bottom-left, bottom-right)
//  - live:      one big box that mirrors the operator's typing in real time once on air
export type TextTemplate = 'basic' | 'quadrants' | 'live'

// One clue/message in the Text scene queue. Every card carries the fields for
// all templates; only the ones its `template` uses are rendered.
export interface TextCard {
  id: string
  template: TextTemplate
  headline: string
  body: string
  /** [top-left, top-right, bottom-left, bottom-right] — quadrants template. */
  quads: [string, string, string, string]
  /** Free text mirrored live — live template. */
  liveText: string
}

// What the projector currently shows: a snapshot of the published card plus the
// id it came from (so the operator knows which card is on air for live typing).
export interface TextLive {
  cardId: string
  template: TextTemplate
  headline: string
  body: string
  quads: [string, string, string, string]
  liveText: string
}

export function emptyTextCard(id: string, template: TextTemplate = 'basic'): TextCard {
  return { id, template, headline: '', body: '', quads: ['', '', '', ''], liveText: '' }
}

// One slideshow URL in the Pre-show queue.
export interface SlideItem {
  id: string
  url: string
}

export function emptySlide(id: string): SlideItem {
  return { id, url: '' }
}

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
  /** Serializable {id,name} of every loaded bumper — powers the "next song"
   *  picker. The playable URLs stay in the audio service. */
  library: BumperTrack[]
  /** The operator's pick for the next reveal's bumper. null = random (default).
   *  Consumed one-shot: after a chosen track plays it resets to null. */
  nextTrackId: string | null
}

export interface AppState {
  teams: Record<TeamId, TeamState>
  /** Audience tally the operator edits (draft). Only reaches the board via
   *  audienceLive on Reveal / update silently. */
  audience: { score: number; label: string; visible: boolean }
  audienceLive: { score: number; label: string; visible: boolean }
  /** The HOME/AWAY corner labels. `home` belongs to Blue, `away` to Red — so
   *  they follow their team across the halftime side-swap. Editable, optional,
   *  and staged (draft) → ribbonsLive on Reveal / update silently. */
  ribbons: { home: string; away: string; visible: boolean }
  ribbonsLive: { home: string; away: string; visible: boolean }
  /** Match phase the operator has selected (draft). The projector renders
   *  halfLive; the two sync on Reveal / update silently. */
  half: Half
  halfLive: Half
  scene: Scene
  /** Logo scene selection. draftId is what the operator has picked (preview);
   *  liveId is what the projector shows. Reveal commits draft → live. */
  logo: { draftId: string; liveId: string }
  /** Text scene: a queue of cards (headline + body) the operator sets up. The
   *  selected card is published to `live` on Reveal, so you can flip between
   *  pre-loaded clues quickly. */
  text: {
    cards: TextCard[]
    selectedId: string
    live: TextLive
  }
  /** Pre-show scene: a queue of slideshow URLs (e.g. published Google Slides
   *  embed links). The selected slide is published to `liveUrl` on Reveal, so
   *  the operator can flip between pre-loaded decks. */
  slideshow: {
    slides: SlideItem[]
    selectedId: string
    liveUrl: string
  }
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
    audience: { score: 0, label: 'Audience', visible: true },
    audienceLive: { score: 0, label: 'Audience', visible: true },
    ribbons: { home: 'Home', away: 'Away', visible: true },
    ribbonsLive: { home: 'Home', away: 'Away', visible: true },
    half: 'first',
    halfLive: 'first',
    scene: 'scoreboard',
    logo: { draftId: LOGO_LIBRARY[0].id, liveId: LOGO_LIBRARY[0].id },
    text: {
      cards: [emptyTextCard('card-1')],
      selectedId: 'card-1',
      live: { cardId: '', template: 'basic', headline: '', body: '', quads: ['', '', '', ''], liveText: '' },
    },
    slideshow: {
      slides: [emptySlide('slide-1')],
      selectedId: 'slide-1',
      liveUrl: '',
    },
    revealPhase: 'idle',
    lastWinner: null,
    revealNonce: 0,
    music: {
      volume: 0.8,
      enabled: true,
      lastTrackId: null,
      lastTrackName: null,
      librarySize: 0,
      library: [],
      nextTrackId: null,
    },
  }
}
