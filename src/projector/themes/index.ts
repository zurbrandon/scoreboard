// What each scoreboard theme draws. A theme is a light layer over the board —
// team colours, layout and legibility never change — so every hook here is
// optional and a theme fills in only the ones it wants. Keyed by ThemeId, so
// adding an id to core/themes.ts won't typecheck until it has an entry here.
//
// To add a theme: add its id + name to THEMES in core/themes.ts, write a file
// beside halloween.tsx exporting a ScoreboardSkin, and register it below.
// Projector rule still applies: animate transform/opacity only, never blur.

import type { ComponentType } from 'react'
import type { ThemeId } from '../../core/themes'
import { halloween } from './halloween'

export type ConfettiWinner = 'blue' | 'red' | 'tie'

export interface ScoreboardSkin {
  /** Drawn across the whole board, behind the teams (corners, edges, haze). */
  Decorations?: ComponentType
  /** Drawn inside the VS medallion, so it rides along wherever the seam is. */
  VsAccent?: ComponentType
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
}
