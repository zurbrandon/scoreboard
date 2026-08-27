// Runs in an isolated context with Node access and exposes a narrow, typed API
// to the renderer on window.showboard. The renderer never touches ipcRenderer
// or Node directly.

import { contextBridge, ipcRenderer } from 'electron'
import type { AppState } from '../src/core/state'
import type { Command } from '../src/core/commands'
import type {
  DisplayInfo,
  DrumrollUpdate,
  MomentTracksUpdate,
  MusicUpdate,
  ShowboardBridge,
  SoundLibraryUpdate,
} from '../src/shared/bridge'
import type { HotkeyAction } from '../src/shared/hotkeys'
import type { MomentKind } from '../src/core/state'

const role: ShowboardBridge['role'] =
  new URLSearchParams(location.search).get('view') === 'projector'
    ? 'projector'
    : 'operator'

const bridge: ShowboardBridge = {
  role,
  getInitialState: () => ipcRenderer.sendSync('showboard:getInitialState') as AppState,
  dispatch: (command: Command) => ipcRenderer.send('showboard:dispatch', command),
  onState: (callback) => {
    const listener = (_e: unknown, state: AppState) => callback(state)
    ipcRenderer.on('showboard:state', listener)
    return () => ipcRenderer.removeListener('showboard:state', listener)
  },

  listDisplays: () => ipcRenderer.invoke('showboard:listDisplays') as Promise<DisplayInfo[]>,
  setProjectorDisplay: (id) => ipcRenderer.send('showboard:setProjectorDisplay', id),

  chooseMusicFolder: () => ipcRenderer.send('showboard:chooseMusicFolder'),
  requestTracks: () => ipcRenderer.send('showboard:requestTracks'),
  onTracks: (callback) => {
    const listener = (_e: unknown, update: MusicUpdate) => callback(update)
    ipcRenderer.on('showboard:tracks', listener)
    return () => ipcRenderer.removeListener('showboard:tracks', listener)
  },

  chooseDrumroll: () => ipcRenderer.send('showboard:chooseDrumroll'),
  requestDrumroll: () => ipcRenderer.send('showboard:requestDrumroll'),
  downloadImage: (url) => ipcRenderer.invoke('showboard:downloadImage', url) as Promise<string | null>,
  onDrumroll: (callback) => {
    const listener = (_e: unknown, update: DrumrollUpdate) => callback(update)
    ipcRenderer.on('showboard:drumroll', listener)
    return () => ipcRenderer.removeListener('showboard:drumroll', listener)
  },
  onHotkey: (callback) => {
    const listener = (_e: unknown, action: HotkeyAction) => callback(action)
    ipcRenderer.on('showboard:hotkey', listener)
    return () => ipcRenderer.removeListener('showboard:hotkey', listener)
  },

  chooseSoundFolder: () => ipcRenderer.send('showboard:chooseSoundFolder'),
  requestSoundLibrary: () => ipcRenderer.send('showboard:requestSoundLibrary'),
  setSoundTags: (paths, add, remove) =>
    ipcRenderer.send('showboard:setSoundTags', { paths, add, remove }),
  onSoundLibrary: (callback) => {
    const listener = (_e: unknown, update: SoundLibraryUpdate) => callback(update)
    ipcRenderer.on('showboard:soundLibrary', listener)
    return () => ipcRenderer.removeListener('showboard:soundLibrary', listener)
  },

  chooseMomentFolder: (kind: MomentKind) => ipcRenderer.send('showboard:chooseMomentFolder', kind),
  requestMomentTracks: () => ipcRenderer.send('showboard:requestMomentTracks'),
  onMomentTracks: (callback) => {
    const listener = (_e: unknown, update: MomentTracksUpdate) => callback(update)
    ipcRenderer.on('showboard:momentTracks', listener)
    return () => ipcRenderer.removeListener('showboard:momentTracks', listener)
  },
}

contextBridge.exposeInMainWorld('showboard', bridge)
