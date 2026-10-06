# Scoreboard themes

A theme is a seasonal skin over the scoreboard — Halloween, Christmas. The
operator picks one from **Scoreboard tab → Custom → Theme**; it goes to the
board immediately (no Update needed), persists across restarts, and never
switches on a date by itself.

Themes are built into the app. A new one ships with an app update; there is no
in-app theme editor.

## What a theme may change

A theme is a light layer. It never changes team colours, layout, or anything
that makes the score harder to read. Every hook is optional:

| Hook | What it does |
| --- | --- |
| `Decorations` | A component drawn across the whole board. Put it at `z-index: 0` to sit behind the header/teams/footer (all `1`), or `2` to sit over them (still under the finale and confetti). |
| `FooterCenter` | A component in the footer's centre slot, between the Home/Away ribbons. It takes real layout space, so the panels can't cover it when the ribbons are hidden. |
| `VsAccent` | A component drawn inside the VS medallion, so it moves with the seam. |
| `winnerStyle` | Replaces the random winner entrance with your own: names the suffix of a `team-panel--winner-<name>` class your stylesheet defines. |
| `confetti.colors` | Recolours the reveal burst. Keep the winner's colour (`base[0]`) in it so the burst still says who won. |
| `confetti.glyphs` | Emoji mixed in among the paper pieces. Keep the array at module level. |

## Adding one

1. **`src/core/themes.ts`** — add the id to `ThemeId` and an entry to `THEMES`
   (name + emoji for the picker).
2. **`src/projector/themes/<id>.tsx` + `<id>.css`** — export a
   `ScoreboardSkin`. Copy `christmas.tsx` or `halloween.tsx` as a start.
3. **`src/projector/themes/index.ts`** — add it to `SKINS`. This won't
   typecheck until you do.
4. Relaunch with `npm run electron:dev` (the main process needs the new id),
   pick it, leave the board up for a minute, and run a reveal.

## Rules for the projector

- **Animate `transform` and `opacity` only.** Never animate `box-shadow`,
  `text-shadow` or `filter` — on the big screen a moving blur re-rasters every
  frame and flickers. A glow that pulses is a pre-drawn gradient whose
  *opacity* changes (see the pumpkin glow and the Christmas bulb halos).
- A static `filter: drop-shadow(...)` is fine — it paints once.
- Put `will-change` on moving elements permanently; never toggle it with a class.
- Winner entrances settle at `scale(1.07)` like the stock ones, about the
  centre, so the held winner card lands in the same place.
- Emoji drawn on a canvas (confetti glyphs) are warmed automatically by
  `Confetti`. Emoji in the DOM use the vendored Noto font as-is.
- Dark emoji (bats, spiders) vanish on the dark board; give them a static
  coloured `drop-shadow` rim.
