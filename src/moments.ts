// Run-out / run-in "moment" content and the random picker. The pool for each
// moment is the built-in text phrases PLUS any GIFs/images dropped in
// src/assets/moments/<kind>/ (bundled at build via import.meta.glob). The pick
// happens here — operator-side — so the reducer stays pure.

import type { MomentKind, MomentVisual } from './core/state'

// Editable starter phrases. One animated treatment renders any of them.
const PHRASES: Record<MomentKind, string[]> = {
  out: ['BYEEEEEE', 'SEE YA', 'GET OUT OF HERE', 'LATER', 'SHOO'],
  in: ['WELCOME BACK', "THEY'RE BACK", 'MISSED YOU', "LOOK WHO'S BACK"],
}

// Bundle every image dropped in the moment folders. `eager` + `?url` gives a
// plain map of path → served URL. Empty until files are added — handled below.
const GIFS: Record<MomentKind, string[]> = {
  out: Object.values(
    import.meta.glob('./assets/moments/goodbye/*.{gif,png,jpg,jpeg,webp}', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ) as string[],
  in: Object.values(
    import.meta.glob('./assets/moments/welcome-back/*.{gif,png,jpg,jpeg,webp}', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ) as string[],
}

// Pick a random visual for the moment: any GIF or any phrase, evenly across the
// combined pool. Falls back to phrases when no GIFs have been added yet.
export function pickMomentVisual(kind: MomentKind, rng: () => number = Math.random): MomentVisual {
  const gifs = GIFS[kind]
  const phrases = PHRASES[kind]
  const pool: MomentVisual[] = [
    ...gifs.map((src): MomentVisual => ({ type: 'image', src })),
    ...phrases.map((phrase): MomentVisual => ({ type: 'text', phrase })),
  ]
  return pool[Math.floor(rng() * pool.length)]
}
