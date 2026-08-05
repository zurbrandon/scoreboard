// Makes the AudioController available to operator components without threading
// it through props. Only the operator loads/controls bumpers.

import { createContext, useContext, type ReactNode } from 'react'
import type { AudioController } from './audioController'

const AudioContext = createContext<AudioController | null>(null)

export function AudioProvider({
  controller,
  children,
}: {
  controller: AudioController
  children: ReactNode
}) {
  return <AudioContext.Provider value={controller}>{children}</AudioContext.Provider>
}

export function useAudio(): AudioController {
  const controller = useContext(AudioContext)
  if (!controller) throw new Error('useAudio must be used inside <AudioProvider>')
  return controller
}
