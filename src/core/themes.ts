// Scoreboard themes — a seasonal skin over the scoreboard (Halloween, Christmas…).
// Code-defined like the show templates: a new theme ships with an app update and
// the operator picks it; nothing switches on a date by itself. This file is only
// the list the state and the picker share — what a theme actually draws lives in
// src/projector/themes/.

export type ThemeId = 'none' | 'halloween' | 'christmas'

export interface ThemeInfo {
  id: ThemeId
  name: string
  emoji: string
}

export const THEMES: ThemeInfo[] = [
  { id: 'none', name: 'None', emoji: '' },
  { id: 'halloween', name: 'Halloween', emoji: '🎃' },
  { id: 'christmas', name: 'Christmas', emoji: '🎄' },
]

/** An id written by a newer build (or a theme that's since been retired) falls
 *  back to no theme rather than breaking the board. */
export function normThemeId(v: unknown): ThemeId {
  return THEMES.some((t) => t.id === v) ? (v as ThemeId) : 'none'
}
