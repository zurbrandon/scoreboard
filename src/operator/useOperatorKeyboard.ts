// Application-level keyboard shortcuts. Score +/- and half-toggle are plain
// commands; scene selection and reveal/black go through handlers so the keyboard
// obeys the same Preview/Program rules as the on-screen deck (selecting a scene
// only previews it; reveal/black are what actually change the projector).

import { useEffect, useRef } from 'react'
import type { Command } from '../core/commands'
import type { Scene } from '../core/state'

const SCENE_KEYS: Record<string, Scene> = {
  '1': 'scoreboard',
  '2': 'slides',
  '3': 'slideshow',
}

export interface KeyboardHandlers {
  selectScene: (scene: Scene) => void
  reveal: () => void
  black: () => void
}

export function useOperatorKeyboard(
  dispatch: (command: Command) => void,
  handlers: KeyboardHandlers,
) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()
      const h = handlersRef.current
      let matched = true

      if (key === 'a') dispatch({ type: 'blue.increment' })
      else if (key === 'z') dispatch({ type: 'blue.decrement' })
      else if (key === 'k') dispatch({ type: 'red.increment' })
      else if (key === 'm') dispatch({ type: 'red.decrement' })
      else if (key === ' ') h.reveal()
      else if (key === 'h') dispatch({ type: 'half.toggle' })
      else if (key === 'b') h.black()
      else if (SCENE_KEYS[key]) h.selectScene(SCENE_KEYS[key])
      else matched = false

      if (matched) e.preventDefault()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch])
}
