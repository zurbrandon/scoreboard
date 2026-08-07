// Electron main process — the SINGLE owner of application state (Engineering
// Principles: "One Source of Truth"). It applies commands with the exact same
// pure reducer the browser prototype uses, pushes state to every window, and
// persists to disk. Windows are thin views; the projector never mutates.

import { app, BrowserWindow, ipcMain, screen, dialog, protocol, net } from 'electron'
import { basename, join } from 'node:path'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { reduce } from '../src/core/reduce'
import { createInitialState, type AppState } from '../src/core/state'
import type { Command } from '../src/core/commands'
import type { BumperTrackInfo, DisplayInfo, DrumrollUpdate, MusicUpdate } from '../src/shared/bridge'

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
  drumrollFile: string | null
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
      // Nested objects fall back to fresh defaults so state written by an older
      // build (missing logo/text) can't leave the renderer with undefined fields,
      // and an unknown scene id resets to the scoreboard.
      const KNOWN_SCENES = ['scoreboard', 'logo', 'text', 'slideshow', 'black']
      const liveHalf = ['first', 'second', 'end'].includes(parsed.halfLive ?? parsed.half)
        ? (parsed.halfLive ?? parsed.half)
        : 'first'
      // audienceLive supports the new shape and the older flat `audience`.
      const audienceLive = { ...fresh.audienceLive, ...(parsed.audienceLive ?? parsed.audience) }
      // ribbonsLive backfills from fresh so older state (no ribbons) can't break.
      const ribbonsLive = { ...fresh.ribbonsLive, ...(parsed.ribbonsLive ?? parsed.ribbons) }
      // Text: normalize each card to the current shape. The retired 'live'
      // template becomes a basic card with liveType on (its old liveText moves
      // into the headline). Older single-string text becomes one basic card.
      const TEMPLATES = ['basic', 'quadrants']
      const template = (v: unknown) => (TEMPLATES.includes(String(v)) ? String(v) : 'basic')
      const quads = (v: unknown) => {
        const a = Array.isArray(v) ? v : []
        return [String(a[0] ?? ''), String(a[1] ?? ''), String(a[2] ?? ''), String(a[3] ?? '')]
      }
      const normCard = (c: Record<string, unknown>) => {
        const wasLive = String(c.template) === 'live'
        return {
          id: String(c.id ?? `card-${Math.random().toString(36).slice(2, 8)}`),
          template: template(c.template),
          liveType: wasLive ? true : Boolean(c.liveType),
          headline: wasLive ? String(c.liveText ?? c.headline ?? '') : String(c.headline ?? ''),
          body: String(c.body ?? ''),
          quads: quads(c.quads),
        }
      }
      const pt = parsed.text
      const emptyLive = { cardId: '', template: 'basic', headline: '', body: '', quads: quads(null) }
      const normLive = (l: Record<string, unknown>) => {
        const wasLive = String(l.template) === 'live'
        return {
          cardId: String(l.cardId ?? ''),
          template: template(l.template),
          headline: wasLive ? String(l.liveText ?? l.headline ?? '') : String(l.headline ?? ''),
          body: String(l.body ?? ''),
          quads: quads(l.quads),
        }
      }
      const text =
        pt && Array.isArray(pt.cards) && pt.cards.length
          ? {
              cards: pt.cards.map(normCard),
              selectedId: String(pt.selectedId ?? pt.cards[0].id),
              live: pt.live ? normLive(pt.live) : emptyLive,
            }
          : pt && typeof pt.live === 'string'
            ? {
                cards: [
                  { id: 'card-1', template: 'basic', liveType: false, headline: String(pt.live || pt.draft || ''), body: '', quads: quads(null) },
                ],
                selectedId: 'card-1',
                live: { ...emptyLive, headline: String(pt.live || '') },
              }
            : fresh.text
      // Slideshow: use the slide-queue shape if present; migrate an older single
      // `slideshowUrl` string into one slide; otherwise fall back to fresh.
      const ps = parsed.slideshow
      const slideshow =
        ps && Array.isArray(ps.slides) && ps.slides.length
          ? {
              slides: ps.slides.map((sl: { id?: unknown; url?: unknown }) => ({
                id: String(sl.id ?? `slide-${Math.random().toString(36).slice(2, 8)}`),
                url: String(sl.url ?? ''),
              })),
              selectedId: String(ps.selectedId ?? ps.slides[0].id),
              liveUrl: String(ps.liveUrl ?? ''),
            }
          : typeof parsed.slideshowUrl === 'string'
            ? {
                slides: [{ id: 'slide-1', url: parsed.slideshowUrl }],
                selectedId: 'slide-1',
                liveUrl: parsed.slideshowUrl,
              }
            : fresh.slideshow
      // Logos: use the saved (editable) library if present, else the built-ins.
      // Keep the draft/live selection valid if it points at a since-removed logo.
      const logos =
        Array.isArray(parsed.logos) && parsed.logos.length
          ? parsed.logos.map((l: Record<string, unknown>) => ({
              id: String(l.id ?? `logo-${Math.random().toString(36).slice(2, 8)}`),
              name: String(l.name ?? 'Logo'),
              website: String(l.website ?? ''),
              src: String(l.src ?? ''),
            }))
          : fresh.logos
      const ids = new Set(logos.map((l: { id: string }) => l.id))
      const clampLogo = (id: unknown) => (ids.has(String(id)) ? String(id) : logos[0]?.id ?? '')
      return {
        ...fresh,
        ...parsed,
        scene: KNOWN_SCENES.includes(parsed.scene) ? parsed.scene : 'scoreboard',
        logos,
        logo: {
          draftId: clampLogo(parsed.logo?.draftId),
          liveId: clampLogo(parsed.logo?.liveId),
        },
        text,
        slideshow,
        // Reset every draft to its live value on launch — no stale pending
        // board changes carried across restarts.
        teams: {
          blue: { ...fresh.teams.blue, ...parsed.teams.blue, pendingScore: parsed.teams.blue.liveScore ?? 0 },
          red: { ...fresh.teams.red, ...parsed.teams.red, pendingScore: parsed.teams.red.liveScore ?? 0 },
        },
        half: liveHalf,
        halfLive: liveHalf,
        audience: audienceLive,
        audienceLive,
        ribbons: ribbonsLive,
        ribbonsLive,
        revealPhase: 'idle',
        finaleStage: 'idle',
        countdown: 0,
        music: {
          ...fresh.music,
          ...parsed.music,
          lastTrackId: null,
          lastTrackName: null,
          librarySize: 0, // tracks are re-scanned from the folder on launch
          library: [], // re-populated when the scanned tracks are pushed
          nextTrackId: null, // one-shot pick; never carried across launches
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
      drumrollFile: parsed.drumrollFile ?? null,
      operatorBounds: parsed.operatorBounds ?? null,
    }
  } catch {
    return { projectorDisplayId: null, musicFolder: null, drumrollFile: null, operatorBounds: null }
  }
}

let state: AppState = createInitialState()
let settings: Settings = {
  projectorDisplayId: null,
  musicFolder: null,
  drumrollFile: null,
  operatorBounds: null,
}

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

// Debounced variant for high-frequency sources (window drag/resize fires many
// times a second — we only need the final bounds, not a disk write per tick).
let saveSettingsTimer: ReturnType<typeof setTimeout> | undefined
function scheduleSaveSettings() {
  clearTimeout(saveSettingsTimer)
  saveSettingsTimer = setTimeout(saveSettings, 400)
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
    // Narrow column by default so it parks beside the sound program.
    width: bounds?.width ?? 560,
    height: bounds?.height ?? 900,
    minWidth: 460,
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
    scheduleSaveSettings()
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

function pushDrumroll() {
  const file = settings.drumrollFile
  const update: DrumrollUpdate = {
    file,
    track: file
      ? {
          id: file,
          name: basename(file).replace(/\.[^.]+$/, ''),
          url: `sbmedia://audio/?p=${encodeURIComponent(file)}`,
        }
      : null,
  }
  operatorWin?.webContents.send('showboard:drumroll', update)
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

  ipcMain.on('showboard:chooseDrumroll', async () => {
    if (!operatorWin) return
    const result = await dialog.showOpenDialog(operatorWin, {
      title: 'Choose Final-score drum roll',
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return
    settings.drumrollFile = result.filePaths[0]
    saveSettings()
    pushDrumroll()
  })
  ipcMain.on('showboard:requestDrumroll', () => pushDrumroll())
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
