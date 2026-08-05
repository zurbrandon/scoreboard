// Application-level keyboard shortcuts (PRD: v1 is app-level only). Each key maps
// to exactly the same Command the on-screen buttons dispatch — no special-casing.

import { useEffect } from 'react'
import type { Command } from '../core/commands'
import type { Scene } from '../core/state'

const SCENE_KEYS: Record<string, Scene> = {
  '1': 'scoreboard',
  '2': 'cszLogo',
  '3': 'theaterLogo',
  '4': 'text',
  '5': 'slideshow',
  '6': 'black',
}

export const SHORTCUT_LEGEND = [
  ['A / Z', 'Blue +/−'],
  ['K / M', 'Red +/−'],
  ['Space', 'Reveal'],
  ['H', 'Swap half'],
  ['1–6', 'Scenes'],
] as const

export function useOperatorKeyboard(dispatch: (command: Command) => void) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Never hijack typing in a text field (names, score entry, mood).
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()
      let command: Command | null = null

      if (key === 'a') command = { type: 'blue.increment' }
      else if (key === 'z') command = { type: 'blue.decrement' }
      else if (key === 'k') command = { type: 'red.increment' }
      else if (key === 'm') command = { type: 'red.decrement' }
      else if (key === ' ') command = { type: 'score.reveal' }
      else if (key === 'h') command = { type: 'half.toggle' }
      else if (SCENE_KEYS[key]) command = { type: 'display.set', scene: SCENE_KEYS[key] }

      if (command) {
        e.preventDefault()
        dispatch(command)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch])
}
