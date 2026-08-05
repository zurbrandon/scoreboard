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
import { createInitialState, type AppState } from '../core/state'
import type { Command } from '../core/commands'
import type { ShowboardBridge } from '../shared/bridge'

export type Role = 'operator' | 'projector'

export interface Store {
  getState(): AppState
  /** Dispatch a command. On the projector this is a no-op (read-only view). */
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
      if (role !== 'operator') return // projector is read-only
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
      return { ...createInitialState(), ...parsed }
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

  channel.onmessage = (event: MessageEvent<Message>) => {
    const msg = event.data
    if (role === 'operator') {
      if (msg.kind === 'requestState') broadcastState()
    } else if (msg.kind === 'state') {
      setState(msg.state)
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
      if (role !== 'operator') return
      setState(reduce(state, command))
      persist(state)
      broadcastState()
    },
  }
}
