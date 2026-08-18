// Electron main process — the SINGLE owner of application state (Engineering
// Principles: "One Source of Truth"). It applies commands with the exact same
// pure reducer the browser prototype uses, pushes state to every window, and
// persists to disk. Windows are thin views; the projector never mutates.

import { app, BrowserWindow, ipcMain, screen, dialog, protocol, net, globalShortcut, session } from 'electron'
import { basename, join } from 'node:path'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { reduce } from '../src/core/reduce'
import { createInitialState, migrateSlides, normSavedTemplates, normSavedSlideshows, normScoreboardLogos, type AppState } from '../src/core/state'
import type { Command } from '../src/core/commands'
import type {
  BumperTrackInfo,
  DisplayInfo,
  DrumrollUpdate,
  MomentTracksUpdate,
  MusicUpdate,
} from '../src/shared/bridge'
import type { MomentKind } from '../src/core/state'
import { DEFAULT_HOTKEYS } from '../src/shared/hotkeys'

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
  momentOutFolder: string | null
  momentInFolder: string | null
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
      const KNOWN_SCENES = ['scoreboard', 'slides', 'black']
      const liveHalf = ['first', 'second', 'end'].includes(parsed.halfLive ?? parsed.half)
        ? (parsed.halfLive ?? parsed.half)
        : 'first'
      // audienceLive supports the new shape and the older flat `audience`.
      const audienceLive = { ...fresh.audienceLive, ...(parsed.audienceLive ?? parsed.audience) }
      // ribbonsLive backfills from fresh so older state (no ribbons) can't break.
      const ribbonsLive = { ...fresh.ribbonsLive, ...(parsed.ribbonsLive ?? parsed.ribbons) }
      // Everything folds into the Show/Games deck; migrateSlides also folds the
      // retired Pre-show queue (parsed.slideshow) into slideshow slides.
      const slides = migrateSlides(parsed, fresh)
      return {
        ...fresh,
        ...parsed,
        scene: KNOWN_SCENES.includes(parsed.scene) ? parsed.scene : 'scoreboard',
        slides,
        // Seeded on first run (when absent), then editable + persisted.
        savedTemplates: normSavedTemplates(parsed.savedTemplates),
        savedSlideshows: normSavedSlideshows(parsed.savedSlideshows),
        scoreboardLogos: normScoreboardLogos(parsed.scoreboardLogos),
        idleLogoSrc: typeof parsed.idleLogoSrc === 'string' ? parsed.idleLogoSrc : null,
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
        revealAnimNonce: 0,
        displayWasReveal: false,
        effect: { kind: '', nonce: 0 },
        finaleStage: 'idle',
        revealSettled: false,
        audioPlaying: false,
        gifOverlay: null,
        washHold: null,
        liveMode: false,
        presentation: null,
        reaction: null,
        countdown: 0,
        music: {
          ...fresh.music,
          ...parsed.music,
          duck: 1, // temporary dial dip; never carried across launches
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
      momentOutFolder: parsed.momentOutFolder ?? null,
      momentInFolder: parsed.momentInFolder ?? null,
      operatorBounds: parsed.operatorBounds ?? null,
    }
  } catch {
    return {
      projectorDisplayId: null,
      musicFolder: null,
      drumrollFile: null,
      momentOutFolder: null,
      momentInFolder: null,
      operatorBounds: null,
    }
  }
}

let state: AppState = createInitialState()
let settings: Settings = {
  projectorDisplayId: null,
  musicFolder: null,
  drumrollFile: null,
  momentOutFolder: null,
  momentInFolder: null,
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
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
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
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
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

function momentFolder(kind: MomentKind): string | null {
  return kind === 'out' ? settings.momentOutFolder : settings.momentInFolder
}

function pushMomentTracks(kind: MomentKind) {
  const folder = momentFolder(kind)
  const update: MomentTracksUpdate = {
    kind,
    folder,
    tracks: folder ? scanMusicFolder(folder) : [],
  }
  operatorWin?.webContents.send('showboard:momentTracks', update)
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

  ipcMain.on('showboard:chooseMomentFolder', async (_event, kind: MomentKind) => {
    if (!operatorWin) return
    const result = await dialog.showOpenDialog(operatorWin, {
      title: kind === 'out' ? 'Choose run-OUT music folder' : 'Choose run-IN music folder',
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return
    if (kind === 'out') settings.momentOutFolder = result.filePaths[0]
    else settings.momentInFolder = result.filePaths[0]
    saveSettings()
    pushMomentTracks(kind)
  })
  ipcMain.on('showboard:requestMomentTracks', () => {
    pushMomentTracks('out')
    pushMomentTracks('in')
  })

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

  // Download an image dragged from a website and return it as a data URL. The
  // main process has no CORS restrictions, so this works for any image host.
  ipcMain.handle('showboard:downloadImage', async (_event, url: string): Promise<string | null> => {
    try {
      const res = await net.fetch(url)
      if (!res.ok) return null
      const type = res.headers.get('content-type') || 'image/png'
      if (!type.startsWith('image/')) return null
      const buf = Buffer.from(await res.arrayBuffer())
      return `data:${type};base64,${buf.toString('base64')}`
    } catch (err) {
      console.warn('[main] image download failed:', err)
      return null
    }
  })
}

// --- lifecycle ---------------------------------------------------------------
// Register the macro-pad / keyboard global shortcuts. Each fires system-wide
// (even when the sound app is focused) and is forwarded to the operator window,
// which runs the action. A failed register (chord already taken by another app)
// is logged, not fatal — the show goes on without that one key.
function registerGlobalShortcuts() {
  globalShortcut.unregisterAll()
  for (const { accelerator, action, label } of DEFAULT_HOTKEYS) {
    const ok = globalShortcut.register(accelerator, () => {
      operatorWin?.webContents.send('showboard:hotkey', action)
    })
    if (!ok) console.warn('[main] could not register shortcut %s (%s)', accelerator, label)
  }
  console.log('[main] registered %d global shortcuts', DEFAULT_HOTKEYS.length)
}

// Keep both renderers running at full speed even when they're not focused or are
// occluded by the sound program. Without this, Chromium throttles background
// windows — timers slow and requestAnimationFrame pauses — so a reveal fired from
// the macro-pad (while the operator window is in the background) wouldn't animate,
// even though clicking REVEAL in-app would. A live-show display must never sleep.
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-background-timer-throttling')

// Slideshow presentation hosts (Canva, Google Slides) serve their non-embed
// "present / autoplay" pages with X-Frame-Options / CSP frame-ancestors headers
// that forbid embedding — so they show as a black iframe. This is our own
// projector kiosk, and the owner explicitly points slideshow slides at these
// hosts, so we strip ONLY the frame-blocking headers for ONLY these hosts,
// letting an autoplay link render where the embed link can't. Everything else
// keeps its headers untouched.
const FRAMEABLE_HOST = /(^|\.)(canva\.com|canva\.site|google\.com|googleusercontent\.com|gstatic\.com)$/i
function allowSlideshowFraming() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    let host = ''
    try {
      host = new URL(details.url).hostname
    } catch {
      /* non-URL request; leave as-is */
    }
    const headers = details.responseHeaders
    if (!headers || !FRAMEABLE_HOST.test(host)) return callback({ responseHeaders: headers ?? undefined })
    const next: Record<string, string[]> = {}
    for (const [key, value] of Object.entries(headers)) {
      const lk = key.toLowerCase()
      if (lk === 'x-frame-options') continue // drop entirely — this is the frame ban
      if (lk === 'content-security-policy') {
        // Keep the CSP but remove only its frame-ancestors directive.
        next[key] = (Array.isArray(value) ? value : [String(value)]).map((v) =>
          v
            .split(';')
            .filter((d) => !/^\s*frame-ancestors/i.test(d))
            .join(';'),
        )
        continue
      }
      next[key] = value as string[]
    }
    callback({ responseHeaders: next })
  })
}

app.whenReady().then(() => {
  allowSlideshowFraming()
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
  registerGlobalShortcuts()
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

// Release the OS-level shortcuts so they don't linger after the app exits.
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
