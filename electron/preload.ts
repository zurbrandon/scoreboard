// Runs in an isolated context with Node access and exposes a narrow, typed API
// to the renderer on window.showboard. The renderer never touches ipcRenderer
// or Node directly.

import { contextBridge, ipcRenderer } from 'electron'
import type { AppState } from '../src/core/state'
import type { Command } from '../src/core/commands'
import type {
  DisplayInfo,
  DrumrollUpdate,
  MusicUpdate,
  ShowboardBridge,
} from '../src/shared/bridge'

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
}

contextBridge.exposeInMainWorld('showboard', bridge)
