// Electron main process — the SINGLE owner of application state (Engineering
// Principles: "One Source of Truth"). It applies commands with the exact same
// pure reducer the browser prototype uses, pushes state to every window, and
// persists to disk. Windows are thin views; the projector never mutates.

import { app, BrowserWindow, ipcMain, screen, dialog, protocol, net, globalShortcut, session } from 'electron'
import electronUpdater from 'electron-updater'
import { basename, extname, join } from 'node:path'
import { readFileSync, writeFileSync, readdirSync, createReadStream, statSync, rmSync } from 'node:fs'
import { Readable } from 'node:stream'

import { reduce } from '../src/core/reduce'
import { createInitialState, migrateSlides, normActiveBoard, normActiveTemplate, normSavedTemplates, normSavedSlideshows, normScoreboardLogos, normSavedBoards, normSoundBanks, normSoundSlots, type AppState } from '../src/core/state'
import type { Command } from '../src/core/commands'
import { normThemeId } from '../src/core/themes'
import type {
  BumperTrackInfo,
  DisplayInfo,
  DrumrollUpdate,
  MomentTracksUpdate,
  MusicUpdate,
  SoundLibraryUpdate,
  SoundProgress,
  SoundTrackInfo,
} from '../src/shared/bridge'
import type { MomentKind } from '../src/core/state'
import { DEFAULT_HOTKEYS } from '../src/shared/hotkeys'
import { normalizeSoundMeta, normalizeTags, serializeSoundMeta, type SoundMeta } from '../src/shared/soundTags'
import { AUDIO_EXTENSIONS, findAudioFiles, trackName } from '../src/shared/soundScan'
import { parseByteRange } from '../src/shared/byteRange'
import type { UpdateStatus } from '../src/shared/bridge'

// Content-Type matters: without it the element has to sniff, and some builds
// refuse to report a duration for an unlabelled stream — which also breaks
// seeking.
const AUDIO_MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
}

const isDev = !app.isPackaged
const DEV_URL = 'http://localhost:5173'

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
  soundFolder: string | null
  drumrollFile: string | null
  momentOutFolder: string | null
  momentInFolder: string | null
  operatorBounds: { x: number; y: number; width: number; height: number } | null
  soundBounds: { x: number; y: number; width: number; height: number } | null
  /** Reopen the soundboard on launch if it was open at quit — a show machine
   *  should come up in the same arrangement it went down in. */
  soundWindowOpen: boolean
  /** Zoom factor for the two CONTROL surfaces (operator + soundboard). The
   *  booth PC is a smaller, lower-grade panel wearing a thick Windows title bar
   *  and taskbar, so the layout that fits a Mac display crowds it. Scaling the
   *  webContents moves type, padding, borders and radii together — the one
   *  knob that keeps the design's proportions intact, since spacing here is
   *  deliberately raw px rather than tokens. Per-machine, so each box keeps its
   *  own comfortable size. The projector is never scaled: it sizes itself in
   *  container units against whatever it's thrown at. */
  uiScale: number
}

// Chromium clamps zoom well past anything useful here; these are the bounds the
// layout still reads correctly at (minWidth 460 on the operator stops meaning
// much below 0.6).
const UI_SCALE_MIN = 0.6
const UI_SCALE_MAX = 1.4
const clampUiScale = (n: unknown) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, n)) : 1

const stateFile = () => join(app.getPath('userData'), 'showboard-state.json')
const settingsFile = () => join(app.getPath('userData'), 'showboard-settings.json')
// Sound-library tags live apart from both state and settings: they're a slowly
// curated body of work, not show state, and keeping them in their own file means
// a corrupt or reset state file can never take the tagging with it.
const soundTagsFile = () => join(app.getPath('userData'), 'showboard-sound-tags.json')
// Written ONLY when the OS refuses a global shortcut, so the file's existence is
// itself the signal. A packaged app has no console, and a hotkey the OS handed
// to someone else is otherwise indistinguishable from a dead macro-pad key.
const hotkeyReportFile = () => join(app.getPath('userData'), 'showboard-hotkey-conflicts.txt')

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
        activeTemplate: normActiveTemplate(parsed.activeTemplate),
        savedSlideshows: normSavedSlideshows(parsed.savedSlideshows),
        soundBanks: normSoundBanks(parsed.soundBanks),
        // Seeded from the live board when there's no saved list, so an install
        // that already has tabs lands on a preset matching what's on screen.
        savedBoards: normSavedBoards(parsed.savedBoards, normSoundBanks(parsed.soundBanks)),
        activeBoard: normActiveBoard(parsed.activeBoard, normSavedBoards(parsed.savedBoards, normSoundBanks(parsed.soundBanks))),
        soundSlots: normSoundSlots(parsed.soundSlots),
        scoreboardLogos: normScoreboardLogos(parsed.scoreboardLogos),
        scoreboardTheme: normThemeId(parsed.scoreboardTheme),
        idleLogoSrc: typeof parsed.idleLogoSrc === 'string' ? parsed.idleLogoSrc : null,
        // An empty string is a choice (no website); only a missing field defaults.
        idleWebsite: typeof parsed.idleWebsite === 'string' ? parsed.idleWebsite : fresh.idleWebsite,
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
        // Cues are momentary: never replay one because it was in the state file.
        soundCueNonce: 0,
        soundCueTrackId: null,
        soundTagCueNonce: 0,
        soundTagCue: null,
        soundStopNonce: 0,
        soundSeekNonce: 0,
        soundSeekTo: 0,
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
      soundFolder: parsed.soundFolder ?? null,
      drumrollFile: parsed.drumrollFile ?? null,
      momentOutFolder: parsed.momentOutFolder ?? null,
      momentInFolder: parsed.momentInFolder ?? null,
      operatorBounds: parsed.operatorBounds ?? null,
      soundBounds: parsed.soundBounds ?? null,
      soundWindowOpen: parsed.soundWindowOpen ?? false,
      uiScale: clampUiScale(parsed.uiScale),
    }
  } catch {
    return {
      projectorDisplayId: null,
      musicFolder: null,
      soundFolder: null,
      drumrollFile: null,
      momentOutFolder: null,
      momentInFolder: null,
      operatorBounds: null,
      soundBounds: null,
      soundWindowOpen: false,
      uiScale: 1,
    }
  }
}

let state: AppState = createInitialState()
let settings: Settings = {
  projectorDisplayId: null,
  musicFolder: null,
  soundFolder: null,
  drumrollFile: null,
  momentOutFolder: null,
  momentInFolder: null,
  operatorBounds: null,
  soundBounds: null,
  soundWindowOpen: false,
  uiScale: 1,
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
let soundWin: BrowserWindow | null = null

function allWindows(): BrowserWindow[] {
  return [operatorWin, projectorWin, soundWin].filter((w): w is BrowserWindow => w !== null)
}

function broadcastState() {
  for (const win of allWindows()) win.webContents.send('showboard:state', state)
}

function loadRoute(win: BrowserWindow, view: 'operator' | 'projector' | 'sound') {
  if (isDev) {
    win.loadURL(view === 'operator' ? `${DEV_URL}/` : `${DEV_URL}/?view=${view}`)
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'), {
      query: view === 'operator' ? {} : { view },
    })
  }
}

// Zoom has to be (re)applied per page load: a navigation resets the factor, and
// in dev an HMR full reload counts. Applying it on did-finish-load rather than
// once at create time is what keeps the scale sticky across a reload.
function applyUiScale(win: BrowserWindow | null) {
  if (!win || win.isDestroyed()) return
  win.webContents.setZoomFactor(settings.uiScale)
}

function trackUiScale(win: BrowserWindow) {
  win.webContents.on('did-finish-load', () => applyUiScale(win))
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
  trackUiScale(operatorWin)

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
    // webviewTag: the web page slide embeds a real browser view here (see
    // lockDownWebPages) — a frame can't, since most sites forbid being framed.
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, webviewTag: true },
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

// --- sound library -----------------------------------------------------------
// The soundboard window's song pool. Three things make it different from the
// bumper folder above: it recurses into subfolders, every track carries tags,
// and it's pushed to every window rather than just the operator.
//
// Tags are keyed by absolute path in a sidecar map, so re-scanning the folder
// (or adding songs to it) never loses them. Moving or renaming a file DOES
// orphan its tags — a re-link pass is future work, not something to paper over
// silently.
let soundTags: Record<string, SoundMeta> = {}

function loadSoundTags(): Record<string, SoundMeta> {
  try {
    const parsed = JSON.parse(readFileSync(soundTagsFile(), 'utf-8'))
    if (!parsed || typeof parsed !== 'object') return {}
    // Re-normalize on read: a hand-edited file shouldn't be able to introduce
    // casing variants that fork a tag in the UI, or a start time that seeks
    // somewhere impossible. Entries are read in either shape — see
    // normalizeSoundMeta — so a file written before start times still loads.
    const out: Record<string, SoundMeta> = {}
    for (const [path, entry] of Object.entries(parsed)) {
      const meta = normalizeSoundMeta(entry)
      if (meta) out[path] = meta
    }
    return out
  } catch {
    return {} // missing or corrupt tags must never block launch
  }
}

function saveSoundTags() {
  try {
    const out: Record<string, unknown> = {}
    for (const [path, meta] of Object.entries(soundTags)) {
      const entry = serializeSoundMeta(meta)
      if (entry) out[path] = entry
    }
    writeFileSync(soundTagsFile(), JSON.stringify(out))
  } catch (err) {
    console.warn('[main] failed to save sound tags:', err)
  }
}

// Tracks are the audio files under the chosen folder, dressed with their tags
// and a playable URL. The walk itself lives in shared code so it can be tested
// against a real directory tree.
function scanSoundFolder(folder: string): SoundTrackInfo[] {
  return findAudioFiles(folder).map((full) => ({
    id: full,
    name: trackName(basename(full)),
    url: `sbmedia://audio/?p=${encodeURIComponent(full)}`,
    tags: soundTags[full]?.tags ?? [],
    startAt: soundTags[full]?.startAt,
  }))
}

function pushSoundLibrary() {
  const tracks = settings.soundFolder ? scanSoundFolder(settings.soundFolder) : []
  tracks.sort((a, b) => a.name.localeCompare(b.name))
  // Only tags actually in use are published, so deleting the last song carrying
  // a tag retires it from autocomplete instead of leaving a dead entry behind.
  const inUse = new Set<string>()
  for (const track of tracks) for (const tag of track.tags) inUse.add(tag)
  const update: SoundLibraryUpdate = {
    folder: settings.soundFolder,
    tracks,
    tags: [...inUse].sort(),
  }
  for (const win of allWindows()) win.webContents.send('showboard:soundLibrary', update)
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

// The soundboard: search, tags and pads, in its own window so it can be parked
// on a second display or beside the deck. It never plays audio itself — it
// dispatches like any other window and the operator's audio controller does the
// playing, which is what keeps exactly one song sounding at a time and lets this
// window be closed or moved mid-show without cutting the music.
function createSoundWindow() {
  if (soundWin) {
    soundWin.focus()
    return
  }
  const bounds = settings.soundBounds
  soundWin = new BrowserWindow({
    width: bounds?.width ?? 1100,
    height: bounds?.height ?? 760,
    minWidth: 720,
    minHeight: 480,
    x: bounds?.x,
    y: bounds?.y,
    title: 'Showboard — Sound',
    backgroundColor: '#0c0e14',
    autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  })
  loadRoute(soundWin, 'sound')
  trackUiScale(soundWin)
  settings.soundWindowOpen = true
  scheduleSaveSettings()

  const persistBounds = () => {
    if (!soundWin) return
    settings.soundBounds = soundWin.getBounds()
    scheduleSaveSettings()
  }
  soundWin.on('resize', persistBounds)
  soundWin.on('move', persistBounds)
  // Closing it is a normal thing to do mid-show; only the operator ends the app.
  soundWin.on('closed', () => {
    soundWin = null
    settings.soundWindowOpen = false
    scheduleSaveSettings()
  })
  // It missed the library push that fired before it existed.
  soundWin.webContents.once('did-finish-load', () => pushSoundLibrary())
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

  ipcMain.handle('showboard:getUpdateStatus', (): UpdateStatus => updateStatus)

  ipcMain.on('showboard:checkForUpdate', async () => {
    if (!app.isPackaged) {
      pushUpdateStatus({ phase: 'error', message: UPDATES_UNAVAILABLE_IN_DEV })
      return
    }
    pushUpdateStatus({ phase: 'checking', message: undefined })
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      // The 'error' event covers most paths, but a throw here (bad feed, bad
      // config) would otherwise leave the UI stuck on "checking" forever.
      pushUpdateStatus({ phase: 'error', message: errorText(err) })
    }
  })

  ipcMain.on('showboard:downloadUpdate', async () => {
    pushUpdateStatus({ phase: 'downloading', percent: 0, message: undefined })
    try {
      await autoUpdater.downloadUpdate()
    } catch (err) {
      pushUpdateStatus({ phase: 'error', message: errorText(err) })
    }
  })

  ipcMain.on('showboard:installUpdate', () => {
    // Quits and relaunches into the new version. Only ever reached from an
    // explicit click, never on quit — see configureUpdater().
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('showboard:getUiScale', (): number => settings.uiScale)

  ipcMain.on('showboard:setUiScale', (_event, scale: number) => {
    settings.uiScale = clampUiScale(scale)
    saveSettings()
    // Both control surfaces, live — the point is to dial it in while looking at
    // it, not to restart the app between guesses.
    applyUiScale(operatorWin)
    applyUiScale(soundWin)
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

  ipcMain.on('showboard:openSoundWindow', () => createSoundWindow())

  // Boards to and from disk. Main is a courier here — it moves text and never
  // parses it, so what a board file *is* stays defined in one place, in the
  // renderer (src/sound/boards.ts).
  //
  // The dialog hangs off whichever window asked, not the operator: these are
  // driven from the soundboard window, and a sheet attached to a window behind
  // it reads as the app having frozen.
  ipcMain.handle('showboard:exportBoardFile', async (event, suggestedName: string, contents: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    const result = await dialog.showSaveDialog(win, {
      title: 'Export soundboard',
      defaultPath: suggestedName,
      filters: [{ name: 'Showboard soundboard', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return false
    try {
      writeFileSync(result.filePath, contents, 'utf-8')
      return true
    } catch (err) {
      console.warn('[main] could not write board file:', err)
      return false
    }
  })

  ipcMain.handle('showboard:importBoardFile', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Import soundboard',
      properties: ['openFile'],
      filters: [{ name: 'Showboard soundboard', extensions: ['json'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    try {
      return readFileSync(result.filePaths[0], 'utf-8')
    } catch (err) {
      console.warn('[main] could not read board file:', err)
      return null
    }
  })

  // Straight through to the soundboard window and nowhere else — this is the
  // one message that fires continuously, so it must not reach the projector.
  ipcMain.on('showboard:soundProgress', (_event, progress: SoundProgress) => {
    soundWin?.webContents.send('showboard:soundProgress', progress)
  })

  ipcMain.on('showboard:chooseSoundFolder', async () => {
    if (!operatorWin) return
    const result = await dialog.showOpenDialog(operatorWin, {
      title: 'Choose sound library folder',
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return
    settings.soundFolder = result.filePaths[0]
    saveSettings()
    pushSoundLibrary()
  })

  ipcMain.on('showboard:requestSoundLibrary', () => pushSoundLibrary())

  // Bulk tag edit: add and/or remove across many tracks in one gesture. Removals
  // apply after additions so a single call can retag a selection outright, and a
  // track left with no tags drops out of the map rather than storing an empty
  // array forever.
  ipcMain.on(
    'showboard:setSoundTags',
    (_event, { paths, add, remove }: { paths: string[]; add: string[]; remove: string[] }) => {
      if (!Array.isArray(paths) || paths.length === 0) return
      const adding = normalizeTags(Array.isArray(add) ? add : [])
      const removing = new Set(normalizeTags(Array.isArray(remove) ? remove : []))
      for (const path of paths) {
        if (typeof path !== 'string') continue
        const current = soundTags[path]
        const next = new Set(current?.tags ?? [])
        for (const tag of adding) next.add(tag)
        for (const tag of removing) next.delete(tag)
        // A song with no tags still has a row here if it carries a start time.
        if (next.size > 0 || current?.startAt !== undefined) {
          soundTags[path] = { tags: [...next].sort(), ...(current?.startAt !== undefined ? { startAt: current.startAt } : {}) }
        } else {
          delete soundTags[path]
        }
      }
      saveSoundTags()
      pushSoundLibrary()
    },
  )

  // Where a song starts. Stored beside its tags because it belongs to the SONG:
  // the same run-in starts in the same place whether it's fired from a pad, a
  // tag run or a show cue. null clears it back to the top of the file.
  ipcMain.on(
    'showboard:setSoundStart',
    (_event, { path, startAt }: { path: string; startAt: number | null }) => {
      if (typeof path !== 'string' || path === '') return
      const current = soundTags[path]
      const meta: SoundMeta = {
        tags: current?.tags ?? [],
        ...(typeof startAt === 'number' && startAt > 0 ? { startAt } : {}),
      }
      // normalizeSoundMeta is the arbiter of "is this worth storing", so a
      // cleared start time on an untagged song drops the row entirely.
      const kept = normalizeSoundMeta(meta)
      if (kept) soundTags[path] = kept
      else delete soundTags[path]
      saveSoundTags()
      pushSoundLibrary()
    },
  )

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
// ---------------------------------------------------------------- Updates
// Entirely operator-driven. This is a live-show tool: the app must never
// download, swap or restart itself on its own initiative, because the moment it
// chose would eventually be during a show. So autoDownload and
// autoInstallOnAppQuit are both off, and each step — check, download, install —
// happens only when someone asks for it in Settings.
const { autoUpdater } = electronUpdater

let updateStatus: UpdateStatus = { phase: 'idle', version: app.getVersion() }

function pushUpdateStatus(next: Partial<UpdateStatus>) {
  updateStatus = { ...updateStatus, ...next, version: app.getVersion() }
  operatorWin?.webContents.send('showboard:updateStatus', updateStatus)
}

function configureUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  // electron-updater logs through electron-log if present; we have no logger, so
  // route its noise to the same console the rest of main uses.
  autoUpdater.logger = null

  autoUpdater.on('update-available', (info) => {
    pushUpdateStatus({ phase: 'available', available: info.version })
  })
  autoUpdater.on('update-not-available', () => {
    pushUpdateStatus({ phase: 'current', available: null })
  })
  autoUpdater.on('download-progress', (p) => {
    pushUpdateStatus({ phase: 'downloading', percent: Math.round(p.percent) })
  })
  autoUpdater.on('update-downloaded', (info) => {
    pushUpdateStatus({ phase: 'ready', available: info.version, percent: 100 })
  })
  autoUpdater.on('error', (err) => {
    console.warn('[main] updater error:', err)
    pushUpdateStatus({ phase: 'error', message: errorText(err) })
  })
}

// An unpackaged app has no app-update.yml, and asking anyway throws — so the
// dev build reports plainly instead of surfacing a confusing stack.
const UPDATES_UNAVAILABLE_IN_DEV = 'Updates only work in the installed app, not in dev.'

function errorText(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  // The common one by far, and its raw form ("net::ERR_INTERNET_DISCONNECTED")
  // tells the operator nothing they can act on.
  if (/ERR_INTERNET_DISCONNECTED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT/i.test(raw)) {
    return 'No connection — this machine needs internet to check for updates.'
  }
  return raw
}

function registerGlobalShortcuts() {
  globalShortcut.unregisterAll()
  const failed: string[] = []
  for (const { accelerator, action, label } of DEFAULT_HOTKEYS) {
    const ok = globalShortcut.register(accelerator, () => {
      operatorWin?.webContents.send('showboard:hotkey', action)
    })
    if (!ok) {
      console.warn('[main] could not register shortcut %s (%s)', accelerator, label)
      failed.push(`${accelerator}\t${label}`)
    }
  }
  console.log(
    '[main] registered %d of %d global shortcuts',
    DEFAULT_HOTKEYS.length - failed.length,
    DEFAULT_HOTKEYS.length,
  )
  reportHotkeyConflicts(failed)
}

// Another running app can already own a chord — far likelier on the booth's
// Windows box than on this Mac, since vendor tray utilities (graphics drivers,
// keyboard software) claim Ctrl+Alt+Shift combos. Leave a plain-text note where
// it can be found without a terminal.
function reportHotkeyConflicts(failed: string[]) {
  try {
    if (failed.length === 0) {
      rmSync(hotkeyReportFile(), { force: true })
      return
    }
    writeFileSync(
      hotkeyReportFile(),
      [
        `Showboard could not claim ${failed.length} of ${DEFAULT_HOTKEYS.length} shortcuts`,
        `(${new Date().toLocaleString()}) — another running app already owns them,`,
        'so these macro-pad keys will do nothing until it is closed or remapped.',
        '',
        ...failed,
        '',
      ].join('\n'),
      'utf-8',
    )
  } catch (err) {
    console.warn('[main] could not write hotkey conflict report:', err)
  }
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
// The web page slide's browser view. Pages there are the open internet, so they
// get nothing of the app: only the projector may host one, it must be an
// http(s) page in its own persistent session (logins survive a relaunch but
// never touch the app's), with no preload and no Node. A link that wants a new
// window opens in the same view instead — there's no second window on a
// projector for it to go to.
const WEB_PARTITION = 'persist:web'
function lockDownWebPages() {
  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      const host = BrowserWindow.fromWebContents(contents)
      if (!host || host !== projectorWin || !/^https?:\/\//i.test(params.src)) {
        event.preventDefault()
        return
      }
      delete webPreferences.preload
      webPreferences.nodeIntegration = false
      webPreferences.contextIsolation = true
      webPreferences.sandbox = true
      params.partition = WEB_PARTITION
    })
    if (contents.getType() === 'webview') {
      contents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) void contents.loadURL(url)
        return { action: 'deny' }
      })
      contents.on('will-navigate', (event, url) => {
        if (!/^https?:\/\//i.test(url)) event.preventDefault()
      })
    }
  })
}

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
  lockDownWebPages()
  // Serves local audio with byte-range support. This has to be a hand-rolled
  // handler rather than net.fetch on a file:// URL, because that ignores Range
  // and answers 200 with the whole body — a media element given a response it
  // can't range-request has to re-download from the start to move the playhead,
  // so seeking restarts the song instead of moving within it.
  protocol.handle('sbmedia', (request) => {
    try {
      const path = new URL(request.url).searchParams.get('p')
      if (!path) return new Response('missing path', { status: 400 })
      const size = statSync(path).size
      const type = AUDIO_MIME[extname(path).toLowerCase()] ?? 'application/octet-stream'
      const range = request.headers.get('range')

      // No Range asked for: send the whole file, but advertise that ranges work
      // so the element knows it may seek later.
      if (!range) {
        return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, {
          status: 200,
          headers: {
            'Content-Type': type,
            'Content-Length': String(size),
            'Accept-Ranges': 'bytes',
          },
        })
      }

      const parsed = parseByteRange(range, size)
      if (!parsed) {
        return new Response('unsatisfiable range', {
          status: 416,
          headers: { 'Content-Range': `bytes */${size}` },
        })
      }
      const { start, end } = parsed

      return new Response(Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream, {
        status: 206,
        headers: {
          'Content-Type': type,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes',
        },
      })
    } catch (err) {
      console.warn('[main] media protocol error:', err)
      return new Response('error', { status: 500 })
    }
  })

  state = loadState()
  settings = loadSettings()
  soundTags = loadSoundTags()
  configureUpdater()
  registerIpc()
  createOperatorWindow()
  createProjectorWindow()
  if (settings.soundWindowOpen) createSoundWindow()
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
