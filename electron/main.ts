// Electron main process — the SINGLE owner of application state (Engineering
// Principles: "One Source of Truth"). It applies commands with the exact same
// pure reducer the browser prototype uses, pushes state to every window, and
// persists to disk. Windows are thin views; the projector never mutates.

import { app, BrowserWindow, ipcMain, screen, dialog, protocol, net } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { reduce } from '../src/core/reduce'
import { createInitialState, type AppState } from '../src/core/state'
import type { Command } from '../src/core/commands'
import type { BumperTrackInfo, DisplayInfo, MusicUpdate } from '../src/shared/bridge'

const isDev = !app.isPackaged
const DEV_URL = 'http://localhost:5173'
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']

// Custom scheme so the renderer can stream local audio files without disabling
// web security. Must be declared before app is ready.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'sbmedia',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true },
  },
])

// --- persisted settings (Electron-specific; app state is separate) -----------
interface Settings {
  projectorDisplayId: number | null
  musicFolder: string | null
  operatorBounds: { x: number; y: number; width: number; height: number } | null
}

const stateFile = () => join(app.getPath('userData'), 'showboard-state.json')
const settingsFile = () => join(app.getPath('userData'), 'showboard-settings.json')

function loadState(): AppState {
  const fresh = createInitialState()
  try {
    const parsed = JSON.parse(readFileSync(stateFile(), 'utf-8'))
    if (parsed?.teams?.blue && parsed?.teams?.red) {
      // Restore persisted values but reset anything transient / not reloadable.
      return {
        ...fresh,
        ...parsed,
        revealPhase: 'idle',
        music: {
          ...fresh.music,
          ...parsed.music,
          lastTrackId: null,
          lastTrackName: null,
          librarySize: 0, // tracks are re-scanned from the folder on launch
        },
      }
    }
  } catch {
    // Missing or corrupt state must never block launch (Principles: Error Handling).
  }
  return fresh
}

function loadSettings(): Settings {
  try {
    const parsed = JSON.parse(readFileSync(settingsFile(), 'utf-8'))
    return {
      projectorDisplayId: parsed.projectorDisplayId ?? null,
      musicFolder: parsed.musicFolder ?? null,
      operatorBounds: parsed.operatorBounds ?? null,
    }
  } catch {
    return { projectorDisplayId: null, musicFolder: null, operatorBounds: null }
  }
}

let state: AppState = createInitialState()
let settings: Settings = { projectorDisplayId: null, musicFolder: null, operatorBounds: null }

let saveStateTimer: ReturnType<typeof setTimeout> | undefined
function scheduleSaveState() {
  clearTimeout(saveStateTimer)
  saveStateTimer = setTimeout(() => {
    try {
      writeFileSync(stateFile(), JSON.stringify(state))
    } catch (err) {
      console.warn('[main] failed to save state:', err)
    }
  }, 400)
}

function saveSettings() {
  try {
    writeFileSync(settingsFile(), JSON.stringify(settings))
  } catch (err) {
    console.warn('[main] failed to save settings:', err)
  }
}

// --- windows -----------------------------------------------------------------
let operatorWin: BrowserWindow | null = null
let projectorWin: BrowserWindow | null = null

function allWindows(): BrowserWindow[] {
  return [operatorWin, projectorWin].filter((w): w is BrowserWindow => w !== null)
}

function broadcastState() {
  for (const win of allWindows()) win.webContents.send('showboard:state', state)
}

function loadRoute(win: BrowserWindow, view: 'operator' | 'projector') {
  if (isDev) {
    win.loadURL(view === 'projector' ? `${DEV_URL}/?view=projector` : `${DEV_URL}/`)
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'), {
      query: view === 'projector' ? { view: 'projector' } : {},
    })
  }
}

function createOperatorWindow() {
  const bounds = settings.operatorBounds
  operatorWin = new BrowserWindow({
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 800,
    x: bounds?.x,
    y: bounds?.y,
    title: 'Showboard — Operator',
    backgroundColor: '#0c0e14',
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  })
  loadRoute(operatorWin, 'operator')

  const persistBounds = () => {
    if (!operatorWin) return
    settings.operatorBounds = operatorWin.getBounds()
    saveSettings()
  }
  operatorWin.on('resize', persistBounds)
  operatorWin.on('move', persistBounds)
  // Closing the operator ends the show.
  operatorWin.on('closed', () => {
    operatorWin = null
    app.quit()
  })
}

function createProjectorWindow() {
  projectorWin = new BrowserWindow({
    width: 960,
    height: 540,
    title: 'Showboard — Projector',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  })
  loadRoute(projectorWin, 'projector')
  projectorWin.on('closed', () => {
    projectorWin = null
  })
  placeProjector()
}

// Put the projector on the chosen (or a secondary) display, fullscreen. On a
// single-display dev machine, leave it as a normal window so both are visible.
function placeProjector() {
  if (!projectorWin) return
  const displays = screen.getAllDisplays()
  const chosen =
    (settings.projectorDisplayId != null &&
      displays.find((d) => d.id === settings.projectorDisplayId)) ||
    null

  if (chosen) {
    projectorWin.setBounds(chosen.bounds)
    projectorWin.setFullScreen(true)
    return
  }

  if (displays.length > 1) {
    const primaryId = screen.getPrimaryDisplay().id
    const secondary = displays.find((d) => d.id !== primaryId) ?? displays[0]
    projectorWin.setBounds(secondary.bounds)
    projectorWin.setFullScreen(true)
  }
  // else: single display in dev — keep it a normal window so it doesn't cover
  // the operator. The operator can still fullscreen it via the display picker.
}

// --- music -------------------------------------------------------------------
function scanMusicFolder(folder: string): BumperTrackInfo[] {
  try {
    return readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .filter((entry) => AUDIO_EXTENSIONS.some((ext) => entry.name.toLowerCase().endsWith(ext)))
      .map((entry) => {
        const full = join(folder, entry.name)
        return {
          id: full,
          name: entry.name.replace(/\.[^.]+$/, ''),
          url: `sbmedia://audio/?p=${encodeURIComponent(full)}`,
        }
      })
  } catch (err) {
    console.warn('[main] failed to scan music folder:', err)
    return []
  }
}

function pushTracks() {
  const update: MusicUpdate = {
    folder: settings.musicFolder,
    tracks: settings.musicFolder ? scanMusicFolder(settings.musicFolder) : [],
  }
  operatorWin?.webContents.send('showboard:tracks', update)
}

// --- IPC ---------------------------------------------------------------------
function registerIpc() {
  ipcMain.on('showboard:getInitialState', (event) => {
    event.returnValue = state
  })

  ipcMain.on('showboard:dispatch', (event, command: Command) => {
    // Defense in depth: the projector window may never mutate state.
    if (projectorWin && event.sender === projectorWin.webContents) return
    try {
      const next = reduce(state, command)
      // Never store undefined/garbage — a bad command must not poison the show.
      if (!next || !next.teams) {
        console.warn('[main] ignoring command that produced no valid state:', command)
        return
      }
      state = next
      broadcastState()
      scheduleSaveState()
    } catch (err) {
      console.warn('[main] dispatch failed; keeping current state:', command, err)
    }
  })

  ipcMain.handle('showboard:listDisplays', (): DisplayInfo[] => {
    const primaryId = screen.getPrimaryDisplay().id
    return screen.getAllDisplays().map((d, i) => ({
      id: d.id,
      label: d.label || `Display ${i + 1}${d.id === primaryId ? ' (primary)' : ''}`,
      width: d.size.width,
      height: d.size.height,
      primary: d.id === primaryId,
    }))
  })

  ipcMain.on('showboard:setProjectorDisplay', (_event, id: number) => {
    settings.projectorDisplayId = id
    saveSettings()
    placeProjector()
  })

  ipcMain.on('showboard:chooseMusicFolder', async () => {
    if (!operatorWin) return
    const result = await dialog.showOpenDialog(operatorWin, {
      title: 'Choose bumper music folder',
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return
    settings.musicFolder = result.filePaths[0]
    saveSettings()
    pushTracks()
  })

  ipcMain.on('showboard:requestTracks', () => pushTracks())
}

// --- lifecycle ---------------------------------------------------------------
app.whenReady().then(() => {
  protocol.handle('sbmedia', (request) => {
    try {
      const path = new URL(request.url).searchParams.get('p')
      if (!path) return new Response('missing path', { status: 400 })
      return net.fetch(pathToFileURL(path).toString())
    } catch (err) {
      console.warn('[main] media protocol error:', err)
      return new Response('error', { status: 500 })
    }
  })

  state = loadState()
  settings = loadSettings()
  registerIpc()
  createOperatorWindow()
  createProjectorWindow()
  console.log('[main] Showboard windows created (isDev=%s)', isDev)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOperatorWindow()
      createProjectorWindow()
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
