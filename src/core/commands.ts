// Every user action — from the mouse, keyboard, or a future hardware controller
// — becomes one of these commands. Business logic executes commands and never
// asks where a command came from (Engineering Principles: "Every Input Is Equal").

import type { BumperTrack } from './bumper'
import type { Half, Scene, TeamId, TextTemplate } from './state'

export type Command =
  // Hardware buttons: ±1 to a team's PENDING score. Repeat-tap for larger swings.
  | { type: 'blue.increment' }
  | { type: 'blue.decrement' }
  | { type: 'red.increment' }
  | { type: 'red.decrement' }
  // GUI: bump a team's PENDING score by an arbitrary amount (±1, ±10, …).
  | { type: 'team.bumpScore'; team: TeamId; delta: number }
  // GUI: type an exact pending score (may be negative).
  | { type: 'team.setScore'; team: TeamId; value: number }
  | { type: 'team.setName'; team: TeamId; name: string }
  | { type: 'team.setMood'; team: TeamId; mood: string }
  // Audience tally (immediate, no reveal).
  | { type: 'audience.increment' }
  | { type: 'audience.decrement' }
  | { type: 'audience.setScore'; value: number }
  | { type: 'audience.setLabel'; label: string }
  | { type: 'audience.setVisible'; visible: boolean }
  // HOME/AWAY corner labels (home = Blue, away = Red). Staged like the audience.
  | { type: 'ribbons.setHome'; value: string }
  | { type: 'ribbons.setAway'; value: string }
  | { type: 'ribbons.setVisible'; visible: boolean }
  // Match / display.
  | { type: 'half.toggle' }
  | { type: 'half.set'; half: Half }
  | { type: 'display.set'; scene: Scene }
  | { type: 'logo.select'; id: string } // preview a logo (draft)
  | { type: 'logo.commit' } // make the drafted logo live
  | { type: 'text.addCard'; id: string } // append a new (empty) card and select it
  | { type: 'text.removeCard'; id: string }
  | { type: 'text.selectCard'; id: string }
  | { type: 'text.setTemplate'; id: string; template: TextTemplate }
  | { type: 'text.setLiveType'; id: string; value: boolean } // per-card live-typing toggle
  | { type: 'text.setField'; id: string; field: 'headline' | 'body'; value: string }
  | { type: 'text.setQuad'; id: string; index: number; value: string } // index 0..3 (TL,TR,BL,BR)
  | { type: 'text.commit' } // publish the selected card to the live snapshot
  | { type: 'slideshow.addSlide'; id: string } // append a new (empty) slide and select it
  | { type: 'slideshow.removeSlide'; id: string }
  | { type: 'slideshow.selectSlide'; id: string }
  | { type: 'slideshow.setSlideUrl'; id: string; url: string }
  | { type: 'slideshow.commit' } // publish the selected slide's URL to liveUrl
  // The main event.
  | { type: 'score.reveal' }
  | { type: 'reveal.finish' } // dispatched by the reveal service when the sequence ends
  // Final-score sequence steps, dispatched by the reveal service on a timer.
  | { type: 'finale.countdown'; value: number } // enter/advance the 3·2·1 countdown
  | { type: 'finale.celebrate' } // countdown done → winner takeover (fires confetti + bumper)
  | { type: 'score.commitSilent' } // commit pending → live with NO animation/audio (quick fixes)
  | { type: 'score.revertPending' } // safety: discard pending edits back to live
  // Music.
  | { type: 'music.setVolume'; volume: number }
  | { type: 'music.setEnabled'; enabled: boolean }
  | { type: 'music.setLibrary'; tracks: BumperTrack[] } // {id,name} of every loaded bumper
  | { type: 'music.setNextTrack'; id: string | null } // pick the next reveal's bumper (null = random)
  | { type: 'music.trackPlayed'; id: string; name: string } // records the bumper that just started

export type CommandType = Command['type']
