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

// A "reaction" control slide (first use: the game Yay Boo). Unlike a display
// slide, it holds no content of its own — it's an operator instrument. While it
// is on air, the operator taps a team+word and the projector flashes that team's
// color with the word. The live flash lives on AppState.reaction, not the slide,
// so the slide stays a simple, reusable marker in the deck.
export type ReactionKind = 'yay' | 'boo'
export interface ReactionSlide {
  id: string
  type: 'reaction'
  deck: SlideDeck
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
  // Set on the transient captain card fired from the deck's quick buttons: a
  // generic "{team} captain" intro that ignores any scripted captain name, so
  // the deck triggers don't depend on a Show slide existing. Never persisted.
  generic?: boolean
}

export type Slide = LogoSlide | TextSlide | ImageSlide | SlideshowSlide | ShowSlide | ReactionSlide

// The two logos in the scoreboard's top corners (left = home/brand, right =
// venue). Each is a logo `src`: a bundled path ('logos/foo.png') or a data: URL
// (an uploaded image). Editable in Settings → Visuals.
export interface ScoreboardLogos {
  left: string
  right: string
}
export function defaultScoreboardLogos(): ScoreboardLogos {
  return { left: 'logos/comedysportz.png', right: 'logos/seattle-comedy-theater.png' }
}
export function normScoreboardLogos(v: unknown): ScoreboardLogos {
  const d = defaultScoreboardLogos()
  if (!v || typeof v !== 'object') return d
  const o = v as Record<string, unknown>
  return {
    left: typeof o.left === 'string' && o.left ? o.left : d.left,
    right: typeof o.right === 'string' && o.right ? o.right : d.right,
  }
}

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
export function reactionSlide(id: string, deck: SlideDeck = 'games'): ReactionSlide {
  return { id, type: 'reaction', deck }
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

// --- Saved deck templates ---------------------------------------------------
// A template is a reusable starting deck the operator can stamp into Show/Games.
// Stored in (persisted) app state, NOT in code — so the operator can bake in
// this machine's music cues and update templates without a rebuild. Editing the
// live deck never changes a saved template; only an explicit save/update does.
export interface SavedTemplate {
  id: string
  deck: SlideDeck
  name: string
  slides: Slide[]
}

// Reduce a live slide to its reusable skeleton: keep the structure + cues +
// pre-show link (machine setup that should persist), drop the per-show data
// (ref name, rosters) that changes every performance.
export function templateSkeleton(slide: Slide): Slide {
  if (slide.type === 'show') return { ...slide, name: '', roster: '' }
  return { ...slide }
}

// The templates seeded on first run (Standard + Simple). Once seeded they live
// in state and are fully editable; the code here is only the starting point.
// Blank stays a code built-in (see the operator), so it isn't seeded here.
export function defaultSavedTemplates(): SavedTemplate[] {
  const std: Slide[] = [
    emptySlideshowSlide('tpl-std-preshow', '', 'show'),
    showSlide('tpl-std-logo', 'logo', 'show'),
    showSlide('tpl-std-ref', 'ref', 'show'),
    showSlide('tpl-std-blk1', 'blackout', 'show'),
    showSlide('tpl-std-players', 'players', 'show'),
    showSlide('tpl-std-blue', 'team-blue', 'show'),
    showSlide('tpl-std-red', 'team-red', 'show'),
    showSlide('tpl-std-blk2', 'blackout', 'show'),
    showSlide('tpl-std-captains', 'captains', 'show'),
    showSlide('tpl-std-capblue', 'captain-blue', 'show'),
    showSlide('tpl-std-capred', 'captain-red', 'show'),
  ]
  const simple: Slide[] = [
    showSlide('tpl-simple-logo', 'logo', 'show'),
    showSlide('tpl-simple-players', 'players', 'show'),
  ]
  return [
    { id: 'std', deck: 'show', name: 'ComedySportz — Standard show', slides: std },
    { id: 'simple', deck: 'show', name: 'ComedySportz — Simple', slides: simple },
  ]
}

// Normalize persisted saved templates; fall back to the seed on first run (when
// the field is absent) or if the stored value is unusable.
export function normSavedTemplates(v: unknown): SavedTemplate[] {
  if (!Array.isArray(v)) return defaultSavedTemplates()
  const out: SavedTemplate[] = []
  for (const t of v) {
    if (!t || typeof t !== 'object') continue
    const r = t as Record<string, unknown>
    if (typeof r.id !== 'string' || typeof r.name !== 'string') continue
    const deck = asDeck(r.deck)
    const slides = Array.isArray(r.slides)
      ? (r.slides.map(normSlide).filter((s): s is Slide => s !== null) as Slide[])
      : []
    out.push({ id: r.id, deck, name: r.name, slides })
  }
  return out
}

// --- Soundboard banks (tabbed pads over the sound library) -------------------
// A bank is a tab of big buttons: "high energy beats", "musical numbers". Pads
// hold a track id (an absolute path), not a copy of the song, so retagging or
// renaming a track never desyncs a pad — and a pad whose file has gone missing
// shows as missing rather than silently doing nothing.
//
// There's no cap on pads per bank. The tool this replaces bound its buttons to
// F1–F12 and so could hold only twelve; forty in one tab is a normal ask.
export interface SoundPad {
  id: string
  trackId: string
  /** What the button reads. Defaults to the song's name, but a pad is a show
   *  cue — "SHOOT OUT" is more use mid-show than the filename. */
  label: string
}

export interface SoundBank {
  id: string
  name: string
  pads: SoundPad[]
}

export function normSoundBanks(v: unknown): SoundBank[] {
  if (!Array.isArray(v)) return []
  const out: SoundBank[] = []
  for (const b of v) {
    if (!b || typeof b !== 'object') continue
    const r = b as Record<string, unknown>
    if (typeof r.id !== 'string' || typeof r.name !== 'string') continue
    const pads: SoundPad[] = []
    if (Array.isArray(r.pads)) {
      for (const p of r.pads) {
        if (!p || typeof p !== 'object') continue
        const pr = p as Record<string, unknown>
        if (typeof pr.id !== 'string' || typeof pr.trackId !== 'string') continue
        pads.push({ id: pr.id, trackId: pr.trackId, label: typeof pr.label === 'string' ? pr.label : '' })
      }
    }
    out.push({ id: r.id, name: r.name, pads })
  }
  return out
}

// --- Sound slots (a behavior pulls from a tag, not a folder) -----------------
// Each of the app's automatic music moments names a tag; the song is drawn at
// random from whatever carries it. That replaces "point this behavior at a
// folder" with "point it at a tag", so one library serves everything and adding
// a song to a behavior is a matter of tagging it.
//
// A slot with no tag (or a tag nothing carries yet) falls back to the folder it
// used before, so the show keeps working while the library is being tagged.
export type SoundSlotId = 'runOut' | 'runIn' | 'captain' | 'drumroll'

export const SOUND_SLOTS: { id: SoundSlotId; label: string; hint: string }[] = [
  { id: 'runOut', label: 'Team runs out', hint: 'Plays when a team runs off' },
  { id: 'runIn', label: 'Team runs in', hint: 'Plays when a team runs back on' },
  { id: 'captain', label: 'Captains on the field', hint: 'Behind a captain intro' },
  { id: 'drumroll', label: 'Final score drum roll', hint: 'Under the final-score reveal' },
]

export type SoundSlots = Record<SoundSlotId, string | null>

export function normSoundSlots(v: unknown): SoundSlots {
  const out: SoundSlots = { runOut: null, runIn: null, captain: null, drumroll: null }
  if (!v || typeof v !== 'object') return out
  const r = v as Record<string, unknown>
  for (const { id } of SOUND_SLOTS) {
    if (typeof r[id] === 'string' && r[id]) out[id] = r[id] as string
  }
  return out
}

// --- Saved slideshows (a curated, named library) ----------------------------
// The owner defines the "approved" slideshows once (each a published embed URL —
// Google Slides …/pub?start=true&loop=true, or Canva …/watch?embed) in Settings.
// When building a slideshow slide the operator picks one by name (or pastes a
// custom URL), so mid-show you find "ComedySportz" without hunting for a link.
// Picking copies the URL onto the slide (a later library edit won't retro-change
// existing slides). Persisted.
export interface SavedSlideshow {
  id: string
  name: string
  url: string
}
export function normSavedSlideshows(v: unknown): SavedSlideshow[] {
  if (!Array.isArray(v)) return []
  const out: SavedSlideshow[] = []
  for (const s of v) {
    if (!s || typeof s !== 'object') continue
    const r = s as Record<string, unknown>
    if (typeof r.id !== 'string' || typeof r.name !== 'string') continue
    out.push({ id: r.id, name: r.name, url: typeof r.url === 'string' ? r.url : '' })
  }
  return out
}

// --- Presentation (running a deck as a cue stack) ---------------------------
// When set, the operator is "presenting" a deck: the Show/Games tab drops from
// its flat editable list into a focused playhead (the beat at `index` is on air),
// and Next/Prev advance through it. null = stopped (flat, editable). Transient —
// never restored across launches; you always start a show from the top.
export interface Presentation {
  deck: SlideDeck
  index: number
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
  /** Global kill switch for ALL app sound (bumpers, cues, drum roll, run songs).
   *  When true the audio controller holds effective volume at 0. A persisted
   *  preference for rooms that want the visuals only. */
  muted: boolean
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
  /** LIVE mode: when on, what you touch goes to air immediately — selecting a
   *  slide auto-reveals it (animation + cues), and board edits publish at once.
   *  When off, the normal Preview/Program flow (stage, then Reveal). Transient:
   *  never restored across launches. Named `liveMode` to avoid confusion with
   *  `slides.live` (the currently-on-air slide object). */
  liveMode: boolean
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
  /** Reusable deck templates the operator can stamp into Show/Games and edit in
   *  place. Persisted, seeded on first run. See SavedTemplate. */
  savedTemplates: SavedTemplate[]
  /** Which saved template each deck was last loaded from (per deck), or null if
   *  built from a code built-in / hand-built. Lets the picker show "you're on X"
   *  and offer Update when the deck has diverged. Persisted. */
  activeTemplate: Record<SlideDeck, string | null>
  /** Curated, named slideshows the operator picks from when building a slideshow
   *  slide (managed in Settings). Persisted. See SavedSlideshow. */
  savedSlideshows: SavedSlideshow[]
  /** The soundboard's tabs of pads. Persisted; per-machine, since pads point at
   *  absolute file paths. See SoundBank. */
  soundBanks: SoundBank[]
  /** Which tag each automatic music moment draws from. See SoundSlots. */
  soundSlots: SoundSlots
  /** Non-null while presenting a deck as a cue stack (Show/Games). Transient. */
  presentation: Presentation | null
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
  /** Bumped by the "fade music out" kill switch — the audio controller ramps the
   *  current sound gracefully to silence, leaving the scene/slide untouched. */
  audioFadeNonce: number
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
  /** Bumped when the soundboard asks for a song from the sound library — a pad
   *  tap, or an audition while tagging. The soundboard window dispatches; the
   *  operator's audio controller is what actually plays, so only one song can
   *  ever be sounding. */
  soundCueNonce: number
  /** Which sound-library track that cue asked for (its absolute path). */
  soundCueTrackId: string | null
  /** Bumped by the soundboard's own Stop. Kept separate from the reveal STOP
   *  because that one also settles the reveal — the sound window must never be
   *  able to disturb what's on screen. */
  soundStopNonce: number
  /** Bumped by a scrub on the soundboard's progress bar, with the target in
   *  soundSeekTo. Only the operator window holds the audio element, so seeking
   *  has to travel as a command like everything else. */
  soundSeekNonce: number
  soundSeekTo: number
  /** The live reaction (team color + word) shown while a reaction control slide
   *  is on air, or null for the neutral holding screen. Driven by the operator's
   *  reaction buttons; see ReactionSlide. */
  reaction: { team: TeamId; kind: ReactionKind } | null
  /** Bumped on each reaction tap so the projector replays the flash even when the
   *  same team+word is tapped twice in a row. */
  reactionNonce: number
  /** The two scoreboard corner logos (editable in Settings → Visuals). */
  scoreboardLogos: ScoreboardLogos
  /** What the projector shows when "nothing" is on — i.e. the Blank/black scene.
   *  null = pure blackout (default); otherwise a logo image `src` to hold on
   *  black (a scoreboard logo or a deck logo slide), for venues that want a
   *  branded holding screen. Editable in Settings → Visuals. */
  idleLogoSrc: string | null
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
    savedTemplates: defaultSavedTemplates(),
    activeTemplate: { show: null, games: null },
    savedSlideshows: [],
    soundBanks: [],
    soundSlots: { runOut: null, runIn: null, captain: null, drumroll: null },
    presentation: null,
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
    audioFadeNonce: 0,
    liveMode: false,
    effect: { kind: '', nonce: 0 },
    audioPlaying: false,
    gifOverlay: null,
    washHold: null,
    moment: null,
    momentNonce: 0,
    soundCueNonce: 0,
    soundCueTrackId: null,
    soundStopNonce: 0,
    soundSeekNonce: 0,
    soundSeekTo: 0,
    reaction: null,
    reactionNonce: 0,
    scoreboardLogos: defaultScoreboardLogos(),
    idleLogoSrc: null,
    music: {
      volume: 0.8,
      duck: 1,
      enabled: true,
      muted: false,
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
  if (s.type === 'reaction') return reactionSlide(String(s.id ?? rid('reaction')), deck)
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
