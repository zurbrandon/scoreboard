// Every user action — from the mouse, keyboard, or a future hardware controller
// — becomes one of these commands. Business logic executes commands and never
// asks where a command came from (Engineering Principles: "Every Input Is Equal").

import type { BumperTrack } from './bumper'
import type { Half, MomentKind, MomentVisual, ReactionKind, RevealStyle, Scene, ShowBeat, Slide, SlideCue, SlideDeck, TeamId, TextTemplate, TextTheme, WashKind } from './state'

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
  | { type: 'live.toggle' } // flip LIVE mode: selections auto-reveal + board edits publish immediately
  // Unified Slides deck (logo + text slides share one queue/selection/reveal).
  | { type: 'slide.select'; id: string } // preview a slide (draft)
  | { type: 'slide.commit' } // publish the selected slide to `live`
  | { type: 'slide.remove'; id: string }
  | { type: 'slide.reorder'; ids: string[] } // new deck order (by id); drag-to-reorder
  | { type: 'slide.clearDeck'; deck: SlideDeck } // remove all slides in a deck (template load replaces)
  | { type: 'slide.addLogo'; id: string; name: string; src: string; deck?: SlideDeck } // add a logo slide and select it
  | { type: 'slide.addText'; id: string; template: TextTemplate; deck?: SlideDeck; theme?: TextTheme } // add a text slide and select it
  | { type: 'slide.addImage'; id: string; deck?: SlideDeck } // add an empty image slide (awaiting a drop) and select it
  | { type: 'slide.addSlideshow'; id: string; deck?: SlideDeck } // add an empty slideshow (Google Slides) slide
  | { type: 'slide.addReaction'; id: string; deck?: SlideDeck } // add a reaction control slide (Yay Boo)
  | { type: 'slide.addShow'; id: string; beat: ShowBeat; deck?: SlideDeck } // add a scripted show-intro beat
  | { type: 'slide.setShowField'; id: string; field: 'name' | 'roster'; value: string } // show beat's name / roster
  | { type: 'slide.setCue'; id: string; cue: SlideCue } // bind a reveal cue (effect / music) to a slide
  | { type: 'slide.setImage'; id: string; src: string } // set an image slide's picture (data URL)
  | { type: 'slide.setWebsite'; id: string; website: string } // logo slide
  | { type: 'slide.setSlideshowUrl'; id: string; url: string } // slideshow slide's embed URL
  | { type: 'slide.setTemplate'; id: string; template: TextTemplate } // text slide
  | { type: 'slide.setLiveType'; id: string; value: boolean } // text slide live-typing toggle
  | { type: 'slide.setField'; id: string; field: 'headline' | 'body'; value: string } // text slide
  | { type: 'slide.setQuad'; id: string; index: number; value: string } // text slide, index 0..3
  | { type: 'show.captain'; which: 'blue' | 'red' | 'both' } // reveal a GENERIC captain intro (deck quick button), independent of any scripted captain slide
  | { type: 'reaction.flash'; team: TeamId; kind: ReactionKind } // Yay Boo: flash the projector a team color + word (yay/boo)
  | { type: 'reaction.clear' } // return a reaction slide to its neutral holding screen
  | { type: 'scoreboard.setLogo'; side: 'left' | 'right'; src: string } // change a scoreboard corner logo
  | { type: 'idle.set'; slideId: string | null } // Blank/black scene: null = black, else a logo slide to show
  | { type: 'slide.addMany'; deck: SlideDeck; slides: Slide[] } // append pre-built slides (already have fresh ids) + select the first — used to stamp a template
  // Saved deck templates (persisted, editable): stamp one into a deck, or save /
  // update / rename / delete from the current deck.
  | { type: 'template.saveNew'; id: string; deck: SlideDeck; name: string; slides: Slide[] }
  | { type: 'template.update'; id: string; slides: Slide[] }
  | { type: 'template.rename'; id: string; name: string }
  | { type: 'template.remove'; id: string }
  | { type: 'template.setActive'; deck: SlideDeck; id: string | null } // mark which template a deck is currently loaded from
  // Curated named slideshows (managed in Settings; picked on a slideshow slide).
  | { type: 'slideshow.save'; id: string; name: string; url: string }
  | { type: 'slideshow.update'; id: string; name: string; url: string }
  | { type: 'slideshow.remove'; id: string }
  // Presentation: run a deck as a cue stack. Start airs the first beat; next/prev
  // advance and air; stop exits to the flat list and cuts to black.
  | { type: 'present.start'; deck: SlideDeck }
  | { type: 'present.stop' }
  | { type: 'present.next' }
  | { type: 'present.prev' }
  | { type: 'present.goto'; index: number }
  // The main event.
  | { type: 'score.reveal'; style?: RevealStyle } // style: the winner animation (random, operator-picked)
  | { type: 'reveal.finish' } // dispatched by the reveal service when the sequence ends
  | { type: 'reveal.stop' } // kill switch: end a playing reveal now (fades audio, freezes the finale winner)
  | { type: 'audio.setPlaying'; value: boolean } // audio controller reflects whether reveal sound is sounding
  | { type: 'audio.fadeOut' } // kill switch: gracefully fade the current music to silence, leaving the scene as-is
  // Final-score sequence steps, dispatched by the reveal service on a timer.
  | { type: 'finale.countdown'; value: number } // enter/advance the 3·2·1 countdown
  | { type: 'finale.celebrate' } // countdown done → winner takeover (fires confetti + bumper)
  | { type: 'score.commitSilent' } // commit pending → live with NO animation/audio (quick fixes)
  | { type: 'score.revertPending' } // safety: discard pending edits back to live
  // Fire an overlay effect (e.g. a confetti cannon) on top of the current scene.
  | { type: 'effect.fire'; kind: string }
  | { type: 'wash.hold'; kind: WashKind } // press-and-hold a team-color wash (pulses while held)
  | { type: 'wash.release' } // let go — the wash settles out
  | { type: 'moment.play'; kind: MomentKind; visual: MomentVisual } // run-out / run-in quick trigger
  | { type: 'gif.overlay'; src: string | null } // overlay a searched GIF on the projector (null clears)
  // Music.
  | { type: 'music.setVolume'; volume: number }
  | { type: 'music.nudgeDuck'; delta: number } // dial: dip/raise music under a cue (clamped 0..1)
  | { type: 'music.setEnabled'; enabled: boolean }
  | { type: 'music.setMuted'; muted: boolean } // global kill switch for ALL app sound
  | { type: 'music.setLibrary'; tracks: BumperTrack[] } // {id,name} of every loaded bumper
  | { type: 'music.setNextTrack'; id: string | null } // pick the next reveal's bumper (null = random)
  | { type: 'music.trackPlayed'; id: string; name: string } // records the bumper that just started
