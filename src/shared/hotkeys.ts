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
  | { type: 'slide.show'; index: number } // show the Nth slide in the deck (0-based)

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
  // Slides folder: 1–9 then 0 → slides 1–10 (indices 0–9).
  ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map(
    (key, i): HotkeyBinding => ({
      accelerator: `${MOD}+${key}`,
      action: { type: 'slide.show', index: i },
      label: `Show slide ${i + 1}`,
    }),
  ),
]
