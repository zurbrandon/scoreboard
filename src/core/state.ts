// The entire application state. This object is plain, serializable JSON at all
// times (Engineering Principles: "State Is Serializable"). There is exactly one
// of these — see src/store/store.ts for the single owner.

import type { BumperTrack } from './bumper'
import { LOGO_LIBRARY } from './logos'

export type TeamId = 'blue' | 'red'
// Match phase. 'end' is the finale — Reveal triggers the winner celebration.
export type Half = 'first' | 'second' | 'end'

export type Scene = 'scoreboard' | 'slides' | 'black' | 'moment'

// Which operator deck a slide belongs to. Show = the run-of-show beats; Games =
// per-game template slides. Both are the same slide machinery, just two lists.
export type SlideDeck = 'show' | 'games'

// The operator's three top-level tabs (editing surfaces, not projector scenes).
export type OperatorTab = 'show' | 'score' | 'games'

// "Moments" are one-press quick triggers for a team running OUT of / back IN to
// the room: a random full-screen visual (an animated text card or a GIF) plus a
// random song. The random pick happens operator-side (reducer stays pure), so
// state just carries the chosen visual to show.
// Team-color screen wash, held down (pulses while held, settles out on release).
export type WashKind = 'blue' | 'red'

export type MomentKind = 'out' | 'in'
export type MomentVisual = { type: 'text'; phrase: string } | { type: 'image'; src: string }
export interface Moment {
  kind: MomentKind
  visual: MomentVisual
}

export type RevealPhase = 'idle' | 'revealing' | 'finale'

// The winning team's celebration animation, picked at random each reveal so the
// moment doesn't feel identical every time. Drives a CSS class on the projector.
export type RevealStyle = 'pop' | 'slam' | 'bounce' | 'throb'
export const REVEAL_STYLES: RevealStyle[] = ['pop', 'slam', 'bounce', 'throb']

// The Final-score reveal is a timed sequence rather than a single moment:
//   tabulating → countdown (3·2·1) → celebrate (winner takeover).
// Only meaningful while revealPhase === 'finale'.
export type FinaleStage = 'idle' | 'tabulating' | 'countdown' | 'celebrate'

// Each Text card renders with one of these layouts on the projector:
//  - basic:     a headline + body line (the default)
//  - quadrants: four words in a 2x2 grid (top-left, top-right, bottom-left, bottom-right)
export type TextTemplate = 'basic' | 'quadrants'
// Optional visual theme for a text slide (e.g. a game's look). Undefined = plain.
export type TextTheme = 'spellingbee'

// The custom "show beats" — the scripted run-of-show intros the operator flips
// through at the top of a match. Each is a full-screen themed card; some carry a
// name (ref, single captain) or a roster (a team's players), some are just a
// title (the dual welcomes) or a plain blackout.
export type ShowBeat =
  | 'ref' // welcome your ref — name + animated referee stripes
  | 'logo' // the ComedySportz logo, big reveal on black + stars
  | 'players' // welcome your players — dual red/blue split
  | 'team-blue' // welcome the Blue team — roster
  | 'team-red' // welcome the Red team — roster
  | 'blackout' // a beat of pure black (settle the room)
  | 'captains' // captains on the field — dual red/blue split
  | 'captain-blue' // the Blue captain — single name
  | 'captain-red' // the Red captain — single name

export interface LogoSlide {
  id: string
  type: 'logo'
  deck: SlideDeck
  name: string
  /** Bundled path like 'logos/comedysportz.png', or a data: URL (uploads). */
  src: string
  /** Website shown small beneath the logo. */
  website: string
}

// A full-screen image. `src` is a data: URL (dropped/uploaded/downloaded) or ''
// when the slide is still empty (awaiting a drop).
export interface ImageSlide {
  id: string
  type: 'image'
  deck: SlideDeck
  src: string
}

// Text slide carries fields for every layout; only the ones its `template` uses
// are rendered. `liveType`: when on and the slide is on air, edits mirror to the
// projector in real time instead of waiting for a reveal.
export interface TextSlide {
  id: string
  type: 'text'
  deck: SlideDeck
  template: TextTemplate
  /** Optional visual theme (a game's look), e.g. 'spellingbee'. */
  theme?: TextTheme
  liveType: boolean
  headline: string
  body: string
  /** [top-left, top-right, bottom-left, bottom-right] — quadrants template. */
  quads: [string, string, string, string]
}

// A slideshow slide holds one URL — typically a published Google Slides embed
// link that auto-plays/loops. Revealing it plays it; Black stops it. This is the
// old "Pre-show" folded in as just another slide type.
export interface SlideshowSlide {
  id: string
  type: 'slideshow'
  deck: SlideDeck
  url: string
}

// A cue a slide carries: fire this on Reveal (never on a silent update). `effect`
// is an overlay effect kind (confetti, a team wash, …). Music has three states:
//   • `trackId` set     → start that bumper under the slide (rides; re-cueing the
//                          same track on the next beat won't restart it).
//   • `silence` true    → gracefully fade whatever's playing to nothing.
//   • neither (default)  → "continue current music": leave the audio alone, so one
//                          song carries across a run of beats (players → blue → red).
// trackId and silence are mutually exclusive (the picker enforces it).
export interface SlideCue {
  effect?: string
  trackId?: string
  silence?: boolean
}

// A scripted show-intro beat. `name` feeds the single-name beats (ref, single
// captain); `roster` is one player per line for the team beats. Unused fields
// stay empty — the beat decides what it renders. `cue` fires on Reveal.
export interface ShowSlide {
  id: string
  type: 'show'
  deck: SlideDeck
  beat: ShowBeat
  name: string
  roster: string
  cue?: SlideCue
}

export type Slide = LogoSlide | TextSlide | ImageSlide | SlideshowSlide | ShowSlide

export function logoSlide(id: string, name: string, src: string, website = '', deck: SlideDeck = 'show'): LogoSlide {
  return { id, type: 'logo', deck, name, src, website }
}
export function emptyTextSlide(
  id: string,
  template: TextTemplate = 'basic',
  deck: SlideDeck = 'show',
  theme?: TextTheme,
): TextSlide {
  return { id, type: 'text', deck, template, theme, liveType: false, headline: '', body: '', quads: ['', '', '', ''] }
}
export function emptyImageSlide(id: string, src = '', deck: SlideDeck = 'show'): ImageSlide {
  return { id, type: 'image', deck, src }
}
export function emptySlideshowSlide(id: string, url = '', deck: SlideDeck = 'show'): SlideshowSlide {
  return { id, type: 'slideshow', deck, url }
}
export function showSlide(id: string, beat: ShowBeat, deck: SlideDeck = 'show', name = '', roster = ''): ShowSlide {
  return { id, type: 'show', deck, beat, name, roster }
}

// The default Show run-of-show: the scripted intro beats in playing order. Seeded
// into a fresh state and back-filled into older states that predate show beats.
// Reorderable and editable like any slide once it's in the deck.
export function defaultShowBeats(): ShowSlide[] {
  const beats: ShowBeat[] = [
    'ref',
    'logo',
    'players',
    'team-blue',
    'team-red',
    'blackout',
    'captains',
    'captain-blue',
    'captain-red',
  ]
  return beats.map((beat) => showSlide(`show-${beat}`, beat, 'show'))
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
  volume: number // 0..1 — the operator's base music level (the Settings slider)
  /** Temporary "duck" multiplier (0..1) on top of `volume`, driven by the macro
   *  pad's dial. Lets the operator dip Showboard's music under an external cue,
   *  then any reveal snaps it back to 1. Never persisted (resets on launch). */
  duck: number
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
  /** All slides across both decks (Show + Games), each tagged with its `deck`.
   *  The operator filters by deck; the selected slide is published to `live` on
   *  Reveal and the projector renders whatever `live` is. `live` is the exact
   *  committed slide object, so a reference !== check tells us when the selected
   *  slide has un-published edits. */
  slides: {
    items: Slide[]
    selectedId: string
    live: Slide | null
  }
  revealPhase: RevealPhase
  /** Which winner-celebration animation the current reveal uses (random each time). */
  revealStyle: RevealStyle
  /** Bumped when a Logo/Text scene is REVEALED (not on silent) so those scenes
   *  can replay an entrance animation. `displayWasReveal` says whether the
   *  current display change was a reveal (animate) or silent (don't). */
  revealAnimNonce: number
  displayWasReveal: boolean
  /** Which step of the Final-score sequence is on screen (see FinaleStage). */
  finaleStage: FinaleStage
  /** True when a reveal was STOPPED and is now holding a terminal frame (the
   *  finale's frozen winner takeover). Distinguishes "held, done" from "playing"
   *  so the operator's STOP button greys out once the sequence is settled. */
  revealSettled: boolean
  /** Current countdown number (3·2·1) during the countdown stage; 0 otherwise. */
  countdown: number
  /** Result of the most recent reveal. null before the first reveal. */
  lastWinner: Winner | null
  /** Bumped on every reveal so views can re-trigger effects (confetti) even
   *  when the winner is unchanged. Views compare it against the last value seen. */
  revealNonce: number
  /** Bumped when a Final-score sequence starts — fires the drum roll, distinct
   *  from revealNonce (which fires the celebration bumper + confetti). */
  finaleNonce: number
  /** Bumped when a reveal is STOPPED (the kill switch). The reveal service cancels
   *  its pending timers on it, and the audio controller fades the sound out fast. */
  stopNonce: number
  /** Fire-and-forget overlay effects (confetti cannon, etc.) that play on top of
   *  whatever scene is showing. `kind` selects the effect; `nonce` bumps on each
   *  press so the projector replays it. */
  effect: { kind: string; nonce: number }
  /** Whether reveal audio (bumper / drum roll) is currently sounding. Reflected
   *  from the audio controller so the operator's STOP button stays available for
   *  the whole sound — a bumper can outlast the 10s winner-emphasis window. */
  audioPlaying: boolean
  /** A GIF overlaid on top of whatever scene is showing (from the operator's GIF
   *  search), or null for none. Remote Giphy URL. */
  gifOverlay: string | null
  /** Which team-color wash the operator is HOLDING (pulses while set), or null.
   *  Press-and-hold on the wash effect; releasing settles it out. */
  washHold: WashKind | null
  /** The live run-out / run-in moment (what the projector shows while scene ===
   *  'moment'). null before the first trigger. */
  moment: Moment | null
  /** Bumped on each moment trigger so the projector replays the animation even
   *  when the same visual is chosen twice. */
  momentNonce: number
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
    slides: {
      items: [
        ...defaultShowBeats(),
        ...LOGO_LIBRARY.map((l) => logoSlide(l.id, l.name, `logos/${l.file}`, '', 'show')),
        emptyTextSlide('text-1', 'basic', 'show'),
        emptySlideshowSlide('preshow-1', '', 'show'),
      ],
      selectedId: 'show-ref',
      live: null,
    },
    revealPhase: 'idle',
    revealStyle: 'pop',
    revealAnimNonce: 0,
    displayWasReveal: false,
    finaleStage: 'idle',
    revealSettled: false,
    countdown: 0,
    lastWinner: null,
    revealNonce: 0,
    finaleNonce: 0,
    stopNonce: 0,
    effect: { kind: '', nonce: 0 },
    audioPlaying: false,
    gifOverlay: null,
    washHold: null,
    moment: null,
    momentNonce: 0,
    music: {
      volume: 0.8,
      duck: 1,
      enabled: true,
      lastTrackId: null,
      lastTrackName: null,
      librarySize: 0,
      library: [],
      nextTrackId: null,
    },
  }
}

// --- Slides migration -------------------------------------------------------
// Build the Slides deck from persisted state: pass the new shape through, or
// migrate the retired `logos` + `text.cards` (and their older variants) into one
// deck. `live` always starts null — reveal state resets on launch.
function rid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}
function normQuads(v: unknown): [string, string, string, string] {
  const a = Array.isArray(v) ? v : []
  return [String(a[0] ?? ''), String(a[1] ?? ''), String(a[2] ?? ''), String(a[3] ?? '')]
}
const asDeck = (v: unknown): SlideDeck => (v === 'games' ? 'games' : 'show')
function textSlideFrom(c: Record<string, unknown>): TextSlide {
  // The retired 'live' template becomes a basic slide with liveType on (its old
  // liveText moves into the headline).
  const wasLive = String(c.template) === 'live'
  return {
    id: String(c.id ?? rid('text')),
    type: 'text',
    deck: asDeck(c.deck),
    template: c.template === 'quadrants' ? 'quadrants' : 'basic',
    theme: c.theme === 'spellingbee' ? 'spellingbee' : undefined,
    liveType: wasLive ? true : Boolean(c.liveType),
    headline: wasLive ? String(c.liveText ?? c.headline ?? '') : String(c.headline ?? ''),
    body: String(c.body ?? ''),
    quads: normQuads(c.quads),
  }
}
function normSlide(s: Record<string, unknown>): Slide | null {
  if (!s || typeof s !== 'object') return null
  const deck = asDeck(s.deck)
  if (s.type === 'logo') {
    return logoSlide(String(s.id ?? rid('logo')), String(s.name ?? 'Logo'), String(s.src ?? ''), String(s.website ?? ''), deck)
  }
  if (s.type === 'text') return textSlideFrom(s)
  if (s.type === 'image') return emptyImageSlide(String(s.id ?? rid('image')), String(s.src ?? ''), deck)
  if (s.type === 'slideshow') return emptySlideshowSlide(String(s.id ?? rid('show')), String(s.url ?? ''), deck)
  if (s.type === 'show') {
    const slide = showSlide(String(s.id ?? rid('show')), asBeat(s.beat), deck, String(s.name ?? ''), String(s.roster ?? ''))
    const cue = normCue(s.cue)
    return cue ? { ...slide, cue } : slide
  }
  return null
}
// A persisted cue, cleaned back to {effect?, trackId?}. Returns undefined when
// there's nothing worth keeping, so a slide without a cue stays cueless.
function normCue(v: unknown): SlideCue | undefined {
  if (!v || typeof v !== 'object') return undefined
  const c = v as Record<string, unknown>
  const cue: SlideCue = {}
  if (typeof c.effect === 'string' && c.effect) cue.effect = c.effect
  if (c.silence === true) cue.silence = true
  else if (typeof c.trackId === 'string' && c.trackId) cue.trackId = c.trackId
  return cue.effect || cue.trackId || cue.silence ? cue : undefined
}
const SHOW_BEATS: ShowBeat[] = ['ref', 'logo', 'players', 'team-blue', 'team-red', 'blackout', 'captains', 'captain-blue', 'captain-red']
const asBeat = (v: unknown): ShowBeat => (SHOW_BEATS.includes(v as ShowBeat) ? (v as ShowBeat) : 'blackout')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateSlides(parsed: any, fresh: AppState): AppState['slides'] {
  const pick = (id: string, items: Slide[]) =>
    items.some((i) => i.id === id) ? id : (items[0]?.id ?? '')

  // The old separate Pre-show queue folds into slideshow slides (deck 'show').
  // Only present in states saved before the Show/Games regroup.
  const preshow: Slide[] = []
  if (Array.isArray(parsed?.slideshow?.slides)) {
    for (const s of parsed.slideshow.slides) {
      preshow.push(emptySlideshowSlide(String(s?.id ?? rid('show')), String(s?.url ?? ''), 'show'))
    }
  }

  // New shape already present (items carry their own type/deck, incl. slideshow).
  const src = parsed?.slides
  if (src && Array.isArray(src.items)) {
    const items: Slide[] = src.items.map(normSlide).filter((s: Slide | null): s is Slide => s !== null)
    // Only fold the retired Pre-show queue if it hasn't been folded already —
    // else a stale `parsed.slideshow` left over from `...parsed` would re-add
    // duplicate slideshow slides on every reload.
    const alreadyFolded = items.some((s) => s.type === 'slideshow')
    const folded = alreadyFolded ? items : [...items, ...preshow]
    // Back-fill the scripted Show beats into states saved before they existed, so
    // upgrading users pick up the default run-of-show without a reset.
    const hasBeats = folded.some((s) => s.type === 'show')
    const all = hasBeats ? folded : [...defaultShowBeats(), ...folded]
    if (all.length) return { items: all, selectedId: pick(String(src.selectedId ?? ''), all), live: null }
  }

  // Migrate the old logos + text.cards into the Show deck (logos, then text).
  const items: Slide[] = []
  if (Array.isArray(parsed?.logos)) {
    for (const l of parsed.logos) {
      const s = normSlide({ ...l, type: 'logo' })
      if (s) items.push(s)
    }
  }
  if (Array.isArray(parsed?.text?.cards)) {
    for (const c of parsed.text.cards) items.push(textSlideFrom(c))
  }
  const all = [...items, ...preshow]
  if (!all.length) return fresh.slides
  return { items: all, selectedId: all[0].id, live: null }
}
