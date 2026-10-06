// What each scoreboard theme draws. A theme is a light layer over the board —
// team colours, layout and legibility never change — so every hook here is
// optional and a theme fills in only the ones it wants. Keyed by ThemeId, so
// adding an id to core/themes.ts won't typecheck until it has an entry here.
//
// To add a theme, see docs/THEMES.md. Projector rule still applies: animate
// transform/opacity only, never blur.

import type { ComponentType } from 'react'
import type { ThemeId } from '../../core/themes'
import { christmas } from './christmas'
import { halloween } from './halloween'
import { newyear } from './newyear'
import { pride } from './pride'
import { valentines } from './valentines'

export type ConfettiWinner = 'blue' | 'red' | 'tie'

export interface ScoreboardSkin {
  /** Drawn across the whole board, behind the teams (corners, edges, haze). */
  Decorations?: ComponentType
  /** Drawn inside the VS medallion, so it rides along wherever the seam is. */
  VsAccent?: ComponentType
  /** Replaces the random winner entrance (pop/slam/bounce/throb) with the
   *  theme's own. Names a CSS class suffix: `team-panel--winner-<name>`, which
   *  the theme's stylesheet defines — transform-only, settling at ~scale(1.07). */
  winnerStyle?: string
  confetti?: {
    /** Recolour the reveal burst. `base` is the plain board's palette for this
     *  winner — keep the winner's colour in it so the burst still says who won. */
    colors?: (base: string[], winner: ConfettiWinner) => string[]
    /** Emoji mixed in among the paper pieces. Module-level array, so the
     *  confetti's effect deps stay stable. */
    glyphs?: string[]
  }
}

export const SKINS: Record<ThemeId, ScoreboardSkin> = {
  none: {},
  halloween,
  christmas,
  newyear,
  valentines,
  pride,
}
