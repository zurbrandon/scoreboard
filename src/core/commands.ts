// Every user action — from the mouse, keyboard, or a future hardware controller
// — becomes one of these commands. Business logic executes commands and never
// asks where a command came from (Engineering Principles: "Every Input Is Equal").

import type { BumperTrack } from './bumper'
import type { Half, MomentKind, MomentVisual, Scene, TeamId, TextTemplate } from './state'

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
  | { type: 'display.set'; scene: Scene } // switch scene with no entrance animation (silent/black)
  | { type: 'display.reveal'; scene: Scene } // switch scene AND play its entrance animation
  // Unified Slides deck (logo + text slides share one queue/selection/reveal).
  | { type: 'slide.select'; id: string } // preview a slide (draft)
  | { type: 'slide.commit' } // publish the selected slide to `live`
  | { type: 'slide.remove'; id: string }
  | { type: 'slide.reorder'; ids: string[] } // new deck order (by id); drag-to-reorder
  | { type: 'slide.addLogo'; id: string; name: string; src: string } // add a logo slide and select it
  | { type: 'slide.addText'; id: string; template: TextTemplate } // add a text slide and select it
  | { type: 'slide.addImage'; id: string } // add an empty image slide (awaiting a drop) and select it
  | { type: 'slide.setImage'; id: string; src: string } // set an image slide's picture (data URL)
  | { type: 'slide.setWebsite'; id: string; website: string } // logo slide
  | { type: 'slide.setTemplate'; id: string; template: TextTemplate } // text slide
  | { type: 'slide.setLiveType'; id: string; value: boolean } // text slide live-typing toggle
  | { type: 'slide.setField'; id: string; field: 'headline' | 'body'; value: string } // text slide
  | { type: 'slide.setQuad'; id: string; index: number; value: string } // text slide, index 0..3
  | { type: 'slideshow.addSlide'; id: string } // append a new (empty) slide and select it
  | { type: 'slideshow.removeSlide'; id: string }
  | { type: 'slideshow.selectSlide'; id: string }
  | { type: 'slideshow.setSlideUrl'; id: string; url: string }
  | { type: 'slideshow.commit' } // publish the selected slide's URL to liveUrl
  // The main event.
  | { type: 'score.reveal' }
  | { type: 'reveal.finish' } // dispatched by the reveal service when the sequence ends
  | { type: 'reveal.stop' } // kill switch: end a playing reveal now (fades audio, freezes the finale winner)
  | { type: 'audio.setPlaying'; value: boolean } // audio controller reflects whether reveal sound is sounding
  // Final-score sequence steps, dispatched by the reveal service on a timer.
  | { type: 'finale.countdown'; value: number } // enter/advance the 3·2·1 countdown
  | { type: 'finale.celebrate' } // countdown done → winner takeover (fires confetti + bumper)
  | { type: 'score.commitSilent' } // commit pending → live with NO animation/audio (quick fixes)
  | { type: 'score.revertPending' } // safety: discard pending edits back to live
  // Fire an overlay effect (e.g. a confetti cannon) on top of the current scene.
  | { type: 'effect.fire'; kind: string }
  | { type: 'moment.play'; kind: MomentKind; visual: MomentVisual } // run-out / run-in quick trigger
  // Music.
  | { type: 'music.setVolume'; volume: number }
  | { type: 'music.nudgeDuck'; delta: number } // dial: dip/raise music under a cue (clamped 0..1)
  | { type: 'music.setEnabled'; enabled: boolean }
  | { type: 'music.setLibrary'; tracks: BumperTrack[] } // {id,name} of every loaded bumper
  | { type: 'music.setNextTrack'; id: string | null } // pick the next reveal's bumper (null = random)
  | { type: 'music.trackPlayed'; id: string; name: string } // records the bumper that just started

export type CommandType = Command['type']
