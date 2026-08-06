// The contract between the Electron main process and the renderer, exposed on
// window.showboard by the preload script. The renderer talks to main ONLY
// through this — no direct Node access (contextIsolation).

import type { AppState } from '../core/state'
import type { Command } from '../core/commands'

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

export interface ShowboardBridge {
  role: 'operator' | 'projector'
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
}

declare global {
  interface Window {
    showboard?: ShowboardBridge
  }
}
