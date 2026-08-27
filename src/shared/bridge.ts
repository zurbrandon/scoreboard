// The contract between the Electron main process and the renderer, exposed on
// window.showboard by the preload script. The renderer talks to main ONLY
// through this — no direct Node access (contextIsolation).

import type { AppState, MomentKind } from '../core/state'
import type { Command } from '../core/commands'
import type { HotkeyAction } from './hotkeys'

export interface DisplayInfo {
  id: number
  label: string
  width: number
  height: number
  primary: boolean
}

export interface BumperTrackInfo {
  id: string
  name: string
  url: string // a sbmedia:// URL the renderer can play
}

export interface MusicUpdate {
  folder: string | null
  tracks: BumperTrackInfo[]
}

export interface DrumrollUpdate {
  file: string | null // absolute path of the chosen file, for display
  track: BumperTrackInfo | null // playable track, or null to fall back to a bumper
}

export interface MomentTracksUpdate {
  kind: MomentKind // 'out' (run out) or 'in' (run in)
  folder: string | null // chosen folder, for display in Settings
  tracks: BumperTrackInfo[] // scanned songs for this moment
}

// One song in the sound library — the tagged, searchable pool behind the
// soundboard window. Unlike a bumper it carries tags, and the operator finds it
// by typing rather than by remembering which folder it lives in.
export interface SoundTrackInfo {
  id: string // absolute file path: stable across rescans (moves/renames orphan tags)
  name: string
  url: string // a sbmedia:// URL the renderer can play
  tags: string[] // normalized (lowercased, collapsed) so casing can't fork a tag
}

export interface SoundLibraryUpdate {
  folder: string | null
  tracks: SoundTrackInfo[]
  /** Every tag in use, sorted — feeds autocomplete without a second pass. */
  tags: string[]
}

// What's sounding right now. This rides its own channel rather than app state:
// a position update several times a second, broadcast to every window, would
// wake the projector mid-animation for something only the soundboard displays.
export interface SoundProgress {
  name: string
  position: number // seconds
  duration: number // seconds; 0 while unknown (metadata still loading)
  playing: boolean
}

export interface ShowboardBridge {
  role: 'operator' | 'projector' | 'sound'
  /** Synchronous so the renderer store can start with real state. */
  getInitialState(): AppState
  /** Send a command to the single owner of truth (main). */
  dispatch(command: Command): void
  /** Subscribe to state pushes from main. Returns an unsubscribe fn. */
  onState(callback: (state: AppState) => void): () => void

  // Display management (operator only in practice).
  listDisplays(): Promise<DisplayInfo[]>
  setProjectorDisplay(id: number): void

  // Music folder.
  chooseMusicFolder(): void
  requestTracks(): void
  onTracks(callback: (update: MusicUpdate) => void): () => void

  // Final-score drum roll (a single audio file).
  chooseDrumroll(): void
  requestDrumroll(): void
  onDrumroll(callback: (update: DrumrollUpdate) => void): () => void

  // Download an image URL (dragged from a website) in the main process — no CORS
  // limits — and return it as a data: URL, or null on failure.
  downloadImage(url: string): Promise<string | null>

  // Macro-pad / keyboard global shortcuts: main registers them OS-wide and
  // forwards each press here so the operator can run the action.
  onHotkey(callback: (action: HotkeyAction) => void): () => void

  // Run-out / run-in music folders (one each). Same model as the bumper folder.
  chooseMomentFolder(kind: MomentKind): void
  requestMomentTracks(): void
  onMomentTracks(callback: (update: MomentTracksUpdate) => void): () => void

  // Sound library: the soundboard window's song pool, scanned recursively from
  // one folder. Tags live in a sidecar keyed by path, so a re-scan never loses
  // them. Pushed to every window, not just the operator, because the soundboard
  // lives in its own window but playback stays with the operator.
  /** Open (or focus, if already open) the soundboard window. */
  openSoundWindow(): void
  chooseSoundFolder(): void
  requestSoundLibrary(): void
  /** Add and/or remove tags across many tracks at once — the bulk gesture that
   *  makes curating a few hundred songs bearable. */
  setSoundTags(paths: string[], add: string[], remove: string[]): void
  onSoundLibrary(callback: (update: SoundLibraryUpdate) => void): () => void
  /** Operator → main: what's sounding. Only the operator window plays, so only
   *  it can report. */
  reportSoundProgress(progress: SoundProgress): void
  /** Main → soundboard window: the reported progress, forwarded there alone. */
  onSoundProgress(callback: (progress: SoundProgress) => void): () => void
}

declare global {
  interface Window {
    showboard?: ShowboardBridge
  }
}
