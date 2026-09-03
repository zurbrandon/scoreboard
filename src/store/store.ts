// The renderer's view of application state, in two transports that share one
// interface:
//
//   • Electron: the MAIN process owns the single source of truth. This store is
//     a thin client — dispatch() sends the command to main; state arrives via
//     pushes. This is the real app (Principles: "One Source of Truth").
//
//   • Browser (npm run dev): no main process, so the OPERATOR tab owns state and
//     mirrors it to the projector over BroadcastChannel. Used for fast, testable
//     UI development on a MacBook.
//
// createStore() picks the transport by whether the Electron bridge is present.

import { reduce } from '../core/reduce'
import { createInitialState, migrateSlides, normActiveBoard, normActiveTemplate, normSavedTemplates, normSavedSlideshows, normScoreboardLogos, normSavedBoards, normSoundBanks, normSoundSlots, type AppState } from '../core/state'
import type { Command } from '../core/commands'
import type { ShowboardBridge } from '../shared/bridge'

export type Role = 'operator' | 'projector' | 'sound'

export interface Store {
  getState(): AppState
  /** Dispatch a command. On the projector this is a no-op (read-only view);
   *  the soundboard window may dispatch, since it drives playback by command. */
  dispatch(command: Command): void
  subscribe(listener: () => void): () => void
  readonly role: Role
}

export function createStore(role: Role): Store {
  const bridge = window.showboard
  return bridge ? createElectronStore(role, bridge) : createBrowserStore(role)
}

// --- Electron transport: main owns truth -------------------------------------
function createElectronStore(role: Role, bridge: ShowboardBridge): Store {
  let state = bridge.getInitialState()
  const listeners = new Set<() => void>()

  bridge.onState((next) => {
    state = next
    for (const listener of listeners) listener()
  })

  return {
    role,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispatch(command) {
      if (role === 'projector') return // the projector only ever observes
      bridge.dispatch(command) // round-trips through main; state comes back via onState
    },
  }
}

// --- Browser transport: operator owns truth, mirrors over BroadcastChannel ----
const CHANNEL_NAME = 'showboard'
const STORAGE_KEY = 'showboard.state'

type Message = { kind: 'state'; state: AppState } | { kind: 'requestState' }

function loadPersisted(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createInitialState()
    const parsed = JSON.parse(raw)
    if (parsed?.teams?.blue && parsed?.teams?.red) {
      // Deep-merge nested objects with fresh defaults so state saved by an older
      // build (missing a newly-added nested field, e.g. music.library) can never
      // leave the renderer reading `undefined`. Mirrors the Electron loader.
      const fresh = createInitialState()
      const KNOWN_SCENES = ['scoreboard', 'slides', 'black']
      return {
        ...fresh,
        ...parsed,
        scene: KNOWN_SCENES.includes(parsed.scene) ? parsed.scene : 'scoreboard',
        teams: {
          blue: { ...fresh.teams.blue, ...parsed.teams.blue },
          red: { ...fresh.teams.red, ...parsed.teams.red },
        },
        audience: { ...fresh.audience, ...parsed.audience },
        audienceLive: { ...fresh.audienceLive, ...parsed.audienceLive },
        ribbons: { ...fresh.ribbons, ...parsed.ribbons },
        ribbonsLive: { ...fresh.ribbonsLive, ...parsed.ribbonsLive },
        // Everything folds into one Show/Games deck (migrateSlides handles old
        // shapes, incl. the retired Pre-show queue).
        slides: migrateSlides(parsed, fresh),
        savedTemplates: normSavedTemplates(parsed.savedTemplates), // seeded first run, then persisted
        // Was one id per deck before templates covered a whole show; same
        // migration the Electron loader does, so the two paths agree.
        activeTemplate: normActiveTemplate(parsed.activeTemplate),
        savedSlideshows: normSavedSlideshows(parsed.savedSlideshows),
        scoreboardLogos: normScoreboardLogos(parsed.scoreboardLogos),
        soundBanks: normSoundBanks(parsed.soundBanks),
        // Seeded from the live board when there's no saved list, so an install
        // that already has tabs lands on a preset matching what's on screen.
        savedBoards: normSavedBoards(parsed.savedBoards, normSoundBanks(parsed.soundBanks)),
        activeBoard: normActiveBoard(parsed.activeBoard, normSavedBoards(parsed.savedBoards, normSoundBanks(parsed.soundBanks))),
        soundSlots: normSoundSlots(parsed.soundSlots),
        idleLogoSrc: typeof parsed.idleLogoSrc === 'string' ? parsed.idleLogoSrc : null,
        gifOverlay: null, // transient overlay; never restore across launches
        washHold: null, // transient hold; never restore across launches
        liveMode: false, // always launch in staged mode, never mid-live
        presentation: null, // never restore mid-presentation
        reaction: null, // transient Yay-Boo flash; never restore across launches
        music: { ...fresh.music, ...parsed.music, duck: 1 },
      }
    }
  } catch {
    // Corrupt settings must never crash the app (Principles: "Error Handling").
  }
  return createInitialState()
}

function persist(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Best-effort; a failed write must not interrupt a live show.
  }
}

function createBrowserStore(role: Role): Store {
  let state = role === 'operator' ? loadPersisted() : createInitialState()
  const listeners = new Set<() => void>()
  const channel = new BroadcastChannel(CHANNEL_NAME)

  const notify = () => {
    for (const listener of listeners) listener()
  }
  const setState = (next: AppState) => {
    state = next
    notify()
  }
  const broadcastState = () => channel.postMessage({ kind: 'state', state } satisfies Message)

  // State from a peer is merged over fresh defaults for the same reason
  // loadPersisted does it: a peer running an older build (or holding state it
  // loaded before a field existed) would otherwise leave this window reading
  // `undefined` for anything newly added.
  const defaults = createInitialState()
  channel.onmessage = (event: MessageEvent<Message>) => {
    const msg = event.data
    if (role === 'operator') {
      if (msg.kind === 'requestState') broadcastState()
    } else if (msg.kind === 'state') {
      setState({ ...defaults, ...msg.state })
    }
  }

  if (role === 'operator') {
    broadcastState()
  } else {
    channel.postMessage({ kind: 'requestState' } satisfies Message)
  }

  return {
    role,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispatch(command) {
      // Browser (dev prototype) only: the operator owns truth in-page, so no
      // other role can write. The soundboard is view-only here; Electron is its
      // real host, where main owns truth and any window may dispatch.
      if (role !== 'operator') return
      setState(reduce(state, command))
      persist(state)
      broadcastState()
    },
  }
}
