// Every user action — from the mouse, keyboard, or a future hardware controller
// — becomes one of these commands. Business logic executes commands and never
// asks where a command came from (Engineering Principles: "Every Input Is Equal").

import type { Half, Scene, TeamId } from './state'

export type Command =
  // Hardware buttons: ±1 to a team's PENDING score. Repeat-tap for larger swings.
  | { type: 'blue.increment' }
  | { type: 'blue.decrement' }
  | { type: 'red.increment' }
  | { type: 'red.decrement' }
  // GUI: type an exact pending score (may be negative).
  | { type: 'team.setScore'; team: TeamId; value: number }
  | { type: 'team.setName'; team: TeamId; name: string }
  | { type: 'team.setMood'; team: TeamId; mood: string }
  // Audience tally (immediate, no reveal).
  | { type: 'audience.increment' }
  | { type: 'audience.decrement' }
  | { type: 'audience.setScore'; value: number }
  // Match / display.
  | { type: 'half.toggle' }
  | { type: 'half.set'; half: Half }
  | { type: 'display.set'; scene: Scene }
  | { type: 'slideshow.setUrl'; url: string }
  // The main event.
  | { type: 'score.reveal' }
  | { type: 'reveal.finish' } // dispatched by the reveal service when the sequence ends
  | { type: 'score.revertPending' } // safety: discard pending edits back to live
  // Music.
  | { type: 'music.setVolume'; volume: number }
  | { type: 'music.setEnabled'; enabled: boolean }
  | { type: 'music.setLibrarySize'; size: number }
  | { type: 'music.trackPlayed'; id: string; name: string } // records the bumper that just started

export type CommandType = Command['type']
