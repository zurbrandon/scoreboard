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
  | { type: 'slide.show'; index: number } // show the Nth slide in the deck (0-based)
  | { type: 'duck.down' } // dial: dip Showboard's music under an external cue
  | { type: 'duck.up' } // dial: bring it back up
  | { type: 'slide.prev' } // dial: move the selection to the previous slide in the active folder
  | { type: 'slide.next' } // dial: move the selection to the next slide
  | { type: 'tab.cycle' } // dial press: cycle folders (Show → Score → Games)

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
  // Slides folder: 1–9 then 0 → slides 1–10 (indices 0–9).
  ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map(
    (key, i): HotkeyBinding => ({
      accelerator: `${MOD}+${key}`,
      action: { type: 'slide.show', index: i },
      label: `Show slide ${i + 1}`,
    }),
  ),
  // Sound dial: temporary music duck (any reveal snaps it back to full).
  { accelerator: `${MOD}+[`, action: { type: 'duck.down' }, label: 'Music duck down' },
  { accelerator: `${MOD}+]`, action: { type: 'duck.up' }, label: 'Music duck up' },
  // Slide dial: scrub the active folder's slides (rotate) + cycle folders (press).
  { accelerator: `${MOD}+,`, action: { type: 'slide.prev' }, label: 'Previous slide' },
  { accelerator: `${MOD}+.`, action: { type: 'slide.next' }, label: 'Next slide' },
  { accelerator: `${MOD}+T`, action: { type: 'tab.cycle' }, label: 'Cycle folder (Show/Score/Games)' },
]

// How much one dial tick / keypress moves the duck (fraction of full volume).
// Small step → finer knob → the dip to silence reads smoother than big jumps.
export const DUCK_STEP = 0.05
