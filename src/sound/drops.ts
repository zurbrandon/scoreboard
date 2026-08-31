// What a drop onto a bank tab means.
//
// Out of the component on purpose (Principles: "Business Logic Never Lives in
// React Components"), and for a sharper reason here: the soundboard window
// cannot dispatch in the browser dev build — the operator owns truth in-page —
// so this decision is only observable when running under Electron. A pure
// function is the only way to actually test it.
//
// Three payloads can land on a tab, and dragover can read their TYPES but never
// their data, which is why they're distinguished by type rather than by content.

import type { SoundPad } from '../core/state'
import type { SoundTrackInfo } from '../shared/bridge'
import { makePads, makeTagPad, tracksByIds } from './pads'

/** Payload for a drag out of the library list or the search grid. */
export const DRAG_TYPE = 'application/x-showboard-tracks'
/** Payload for dragging a TAG out of the search grid: the drop makes a pad that
 *  plays from that tag. */
export const TAG_DRAG_TYPE = 'application/x-showboard-tag'
/** Payload for dragging a pad within or between banks. */
export const PAD_DRAG_TYPE = 'application/x-showboard-pad'

export type Drop =
  /** A pad changing banks. The pad's identity comes from component state, not
   *  the payload, so there's nothing to carry here. */
  | { kind: 'movePad' }
  /** Songs to add as pads. Empty when nothing in the payload resolves against
   *  the library — a dropped id whose file has gone should add nothing rather
   *  than a pad pointing nowhere. */
  | { kind: 'addPads'; pads: SoundPad[] }
  /** Not ours: a drag from outside the app, or a payload we can't read. */
  | null

/**
 * Decide what a drop produces. `getData` is the event's reader — passed in so
 * this stays testable without a DataTransfer.
 *
 * Tag pads land as 'random' — one song and done. A pad that keeps playing
 * forever is a bigger thing to arrive by accident, so that's opted into
 * afterwards, on the pad's own back face.
 */
export function readDrop(
  types: readonly string[],
  getData: (type: string) => string,
  library: readonly SoundTrackInfo[],
): Drop {
  // Checked first: a pad already on the board is being moved, not added.
  if (types.includes(PAD_DRAG_TYPE)) return { kind: 'movePad' }

  if (types.includes(TAG_DRAG_TYPE)) {
    const tag = getData(TAG_DRAG_TYPE).trim()
    return tag ? { kind: 'addPads', pads: [makeTagPad(tag, 'random')] } : null
  }

  if (types.includes(DRAG_TYPE)) {
    let ids: unknown
    try {
      ids = JSON.parse(getData(DRAG_TYPE))
    } catch {
      return null // a drag from outside the app: nothing to add, nothing to report
    }
    if (!Array.isArray(ids)) return null
    const found = tracksByIds(library, ids.filter((id): id is string => typeof id === 'string'))
    return { kind: 'addPads', pads: makePads(found) }
  }

  return null
}
