// Turning songs into pads. Shared because two paths do it — dropping a drag on a
// bank, and the + on a search result — and they must produce the same thing.

import type { SoundPad, SoundPadMode } from '../core/state'
import type { SoundTrackInfo } from '../shared/bridge'
import { newId } from '../shared/ids'

/** A pad per track, labelled with the song's name to start. Unknown ids are
 *  dropped rather than becoming pads that point at nothing. */
export function makePads(tracks: readonly SoundTrackInfo[]): SoundPad[] {
  return tracks.map((track) => ({
    id: newId('pad'),
    kind: 'track',
    trackId: track.id,
    label: track.name,
  }))
}

/** Resolve dragged/selected ids against the library, preserving library order. */
export function tracksByIds(
  library: readonly SoundTrackInfo[],
  ids: readonly string[],
): SoundTrackInfo[] {
  const wanted = new Set(ids)
  return library.filter((t) => wanted.has(t.id))
}

/** A pad that plays from a tag. Labelled with the tag to start — the operator
 *  renames it to whatever the button means in their show. */
export function makeTagPad(tag: string, mode: SoundPadMode): SoundPad {
  return { id: newId('pad'), kind: 'tag', tag, mode, label: tag }
}
