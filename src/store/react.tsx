// Thin React binding for the store. Components read state and dispatch commands
// through these hooks — they hold no business logic themselves
// (Principles: "Business Logic Never Lives in React Components").

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type { AppState } from '../core/state'
import type { Command } from '../core/commands'
import type { Store } from './store'

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({
  store,
  children,
}: {
  store: Store
  children: ReactNode
}) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside <StoreProvider>')
  return store
}

/** Subscribe to a slice of state. Re-renders only when the slice changes. */
export function useAppState<T>(selector: (state: AppState) => T): T {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()))
}

/** Get the command dispatcher. Stable for the life of the store. */
export function useDispatch(): (command: Command) => void {
  return useStore().dispatch
}
