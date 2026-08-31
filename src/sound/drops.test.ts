import { describe, expect, it } from 'vitest'
import { DRAG_TYPE, PAD_DRAG_TYPE, TAG_DRAG_TYPE, readDrop } from './drops'
import type { SoundTrackInfo } from '../shared/bridge'

const LIBRARY: SoundTrackInfo[] = [
  { id: 't1', name: 'Pizza Party', url: '', tags: ['pizza', 'high energy'] },
  { id: 't2', name: 'Deep Dish', url: '', tags: ['pizza'] },
  { id: 't3', name: 'Rap Battle', url: '', tags: ['rap'] },
]

/** A stand-in for the event's reader, so these tests need no DataTransfer. */
const reader = (data: Record<string, string>) => (type: string) => data[type] ?? ''

describe('readDrop', () => {
  it('reads a song drag as pads for those songs, in library order', () => {
    const drop = readDrop(
      [DRAG_TYPE],
      reader({ [DRAG_TYPE]: JSON.stringify(['t3', 't1']) }),
      LIBRARY,
    )
    expect(drop?.kind).toBe('addPads')
    expect(drop?.kind === 'addPads' && drop.pads.map((p) => p.label)).toEqual([
      'Pizza Party',
      'Rap Battle',
    ])
  })

  it('reads a tag drag as a single tag pad, defaulting to one-and-done', () => {
    const drop = readDrop([TAG_DRAG_TYPE], reader({ [TAG_DRAG_TYPE]: 'pizza' }), LIBRARY)
    expect(drop).toEqual({
      kind: 'addPads',
      pads: [expect.objectContaining({ kind: 'tag', tag: 'pizza', mode: 'random', label: 'pizza' })],
    })
  })

  it('never lands a keeps-playing pad by accident — that is opted into on the pad', () => {
    const drop = readDrop([TAG_DRAG_TYPE], reader({ [TAG_DRAG_TYPE]: 'house' }), LIBRARY)
    const pad = drop?.kind === 'addPads' ? drop.pads[0] : null
    expect(pad?.kind === 'tag' && pad.mode).toBe('random')
  })

  it('treats a pad drag as a move, not an add, and checks it FIRST', () => {
    // A pad drag can carry other types too; moving must win, or dragging a pad
    // between banks would duplicate it instead of moving it.
    expect(readDrop([PAD_DRAG_TYPE, DRAG_TYPE], reader({}), LIBRARY)).toEqual({ kind: 'movePad' })
  })

  it('adds nothing for ids that are not in the library, rather than a pad pointing nowhere', () => {
    const drop = readDrop([DRAG_TYPE], reader({ [DRAG_TYPE]: JSON.stringify(['gone']) }), LIBRARY)
    expect(drop).toEqual({ kind: 'addPads', pads: [] })
  })

  it('ignores a drag from outside the app', () => {
    expect(readDrop(['text/plain'], reader({ 'text/plain': 'hello' }), LIBRARY)).toBeNull()
  })

  it('survives junk in our own payload without throwing', () => {
    expect(readDrop([DRAG_TYPE], reader({ [DRAG_TYPE]: 'not json' }), LIBRARY)).toBeNull()
    expect(readDrop([DRAG_TYPE], reader({ [DRAG_TYPE]: '"a string"' }), LIBRARY)).toBeNull()
    expect(
      readDrop([DRAG_TYPE], reader({ [DRAG_TYPE]: JSON.stringify([1, null, 't1']) }), LIBRARY),
    ).toEqual({ kind: 'addPads', pads: [expect.objectContaining({ label: 'Pizza Party' })] })
  })

  it('ignores an empty tag rather than making a pad with no tag', () => {
    expect(readDrop([TAG_DRAG_TYPE], reader({ [TAG_DRAG_TYPE]: '   ' }), LIBRARY)).toBeNull()
  })

  it('gives every pad its own id, so two drops of the same song are two pads', () => {
    const one = readDrop([DRAG_TYPE], reader({ [DRAG_TYPE]: JSON.stringify(['t1']) }), LIBRARY)
    const two = readDrop([DRAG_TYPE], reader({ [DRAG_TYPE]: JSON.stringify(['t1']) }), LIBRARY)
    const idOf = (d: typeof one) => (d?.kind === 'addPads' ? d.pads[0].id : null)
    expect(idOf(one)).not.toBe(idOf(two))
  })
})
