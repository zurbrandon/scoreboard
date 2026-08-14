// The macro-pad / keyboard shortcut contract, shared by the main process (which
// registers the OS-level global shortcuts) and the operator (which performs the
// action). Kept dependency-free so both sides can import it.
//
// These are GLOBAL shortcuts: they fire system-wide, even when another app (the
// sound board) is focused — that's the point, so the pad drives the show without
// stealing focus. Because they're stolen system-wide, the chords are obscure
// triple-modifier combos that won't collide with macOS defaults or the music
// app's F-keys (which stay free for it since we never bind F-keys).

export type HotkeyAction =
  | { type: 'blue.up' }
  | { type: 'blue.down' }
  | { type: 'red.up' }
  | { type: 'red.down' }
  | { type: 'reveal' } // reveal the scoreboard (with animation)
  | { type: 'silent' } // publish the scoreboard silently (no animation/sound)
  | { type: 'stop' } // kill switch
  | { type: 'black' }
  | { type: 'moment.out' } // run-out: team leaves (random visual + song)
  | { type: 'moment.in' } // run-in: team enters (random visual + song)
  | { type: 'slide.jump'; index: number } // jump to + play the Nth slide (0-based) of the ACTIVE folder (Show or Games)
  | { type: 'duck.down' } // dial: dip Showboard's music under an external cue
  | { type: 'duck.up' } // dial: bring it back up
  | { type: 'audio.fadeOut' } // kill switch: slow fade the music to silence, scene untouched
  | { type: 'live.toggle' } // flip LIVE mode on/off
  | { type: 'slide.prev' } // dial: move the selection to the previous slide in the active folder
  | { type: 'slide.next' } // dial: move the selection to the next slide
  | { type: 'tab.cycle' } // dial press: cycle folders (Show → Score → Games)
  | { type: 'tab.show' } // jump straight to the Show folder
  | { type: 'tab.score' } // jump straight to the Score folder
  | { type: 'tab.games' } // jump straight to the Games folder
  | { type: 'captain'; which: 'blue' | 'red' | 'both' } // reveal the blue / red / both-captain beat
  | { type: 'effect'; kind: string } // fire an overlay effect (confetti, fireworks, …)

export interface HotkeyBinding {
  accelerator: string // an Electron accelerator string
  action: HotkeyAction
  label: string // human description — for logging now, a remap UI later
}

// CommandOrControl = ⌘ on macOS, Ctrl on Windows (the booth machine).
const MOD = 'CommandOrControl+Alt+Shift'

export const DEFAULT_HOTKEYS: HotkeyBinding[] = [
  // Scoreboard folder.
  { accelerator: `${MOD}+Q`, action: { type: 'blue.up' }, label: 'Blue +1' },
  { accelerator: `${MOD}+A`, action: { type: 'blue.down' }, label: 'Blue −1' },
  { accelerator: `${MOD}+W`, action: { type: 'red.up' }, label: 'Red +1' },
  { accelerator: `${MOD}+S`, action: { type: 'red.down' }, label: 'Red −1' },
  { accelerator: `${MOD}+R`, action: { type: 'reveal' }, label: 'Reveal scoreboard' },
  { accelerator: `${MOD}+E`, action: { type: 'silent' }, label: 'Silent reveal scoreboard' },
  { accelerator: `${MOD}+X`, action: { type: 'stop' }, label: 'Stop' },
  // Shared.
  { accelerator: `${MOD}+B`, action: { type: 'black' }, label: 'Black screen' },
  // Moments: run-out / run-in (each fires a random visual + song).
  { accelerator: `${MOD}+O`, action: { type: 'moment.out' }, label: 'Run out (team leaves)' },
  { accelerator: `${MOD}+I`, action: { type: 'moment.in' }, label: 'Run in (team enters)' },
  // 1–9 then 0 → slide 1–10 of whichever folder is active (Show or Games).
  ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map(
    (key, i): HotkeyBinding => ({
      accelerator: `${MOD}+${key}`,
      action: { type: 'slide.jump', index: i },
      label: `Slide ${i + 1}`,
    }),
  ),
  // Sound dial: temporary music duck (any reveal snaps it back to full).
  { accelerator: `${MOD}+[`, action: { type: 'duck.down' }, label: 'Music duck down' },
  { accelerator: `${MOD}+]`, action: { type: 'duck.up' }, label: 'Music duck up' },
  { accelerator: `${MOD}+M`, action: { type: 'audio.fadeOut' }, label: 'Fade music out (mute)' },
  { accelerator: `${MOD}+V`, action: { type: 'live.toggle' }, label: 'Toggle LIVE mode' },
  // Slide dial: scrub the active folder's slides (rotate) + cycle folders (press).
  { accelerator: `${MOD}+,`, action: { type: 'slide.prev' }, label: 'Previous slide' },
  { accelerator: `${MOD}+.`, action: { type: 'slide.next' }, label: 'Next slide' },
  { accelerator: `${MOD}+T`, action: { type: 'tab.cycle' }, label: 'Cycle folder (Show/Score/Games)' },
  // Jump straight to a folder — pair each with a device page switch (Multi Action).
  { accelerator: `${MOD}+H`, action: { type: 'tab.show' }, label: 'Go to Show' },
  { accelerator: `${MOD}+C`, action: { type: 'tab.score' }, label: 'Go to Score' },
  { accelerator: `${MOD}+G`, action: { type: 'tab.games' }, label: 'Go to Games' },
  // Captains on the field — reveal the beat without leaving the current folder.
  { accelerator: `${MOD}+J`, action: { type: 'captain', which: 'blue' }, label: 'Blue captain' },
  { accelerator: `${MOD}+K`, action: { type: 'captain', which: 'red' }, label: 'Red captain' },
  { accelerator: `${MOD}+L`, action: { type: 'captain', which: 'both' }, label: 'Both captains' },
  // Overlay effects, on top of whatever's showing.
  { accelerator: `${MOD}+F`, action: { type: 'effect', kind: 'confetti' }, label: 'Confetti' },
  { accelerator: `${MOD}+D`, action: { type: 'effect', kind: 'fireworks' }, label: 'Fireworks' },
  // Verdict slams — great for games (right/wrong answers).
  { accelerator: `${MOD}+Y`, action: { type: 'effect', kind: 'success' }, label: 'Yes / correct' },
  { accelerator: `${MOD}+N`, action: { type: 'effect', kind: 'nope' }, label: 'No / wrong' },
]

// How much one dial tick / keypress moves the duck (fraction of full volume).
// Small step → finer knob → the dip to silence reads smoother than big jumps.
export const DUCK_STEP = 0.05
