import { describe, expect, it } from 'vitest'
import {
  normalizeSoundMeta,
  normalizeTag,
  normalizeTags,
  serializeSoundMeta,
} from './soundTags'

describe('normalizeTag', () => {
  it('lowercases and collapses whitespace so casing cannot fork a tag', () => {
    expect(normalizeTag('Hip Hop')).toBe('hip hop')
    expect(normalizeTag('hip  hop')).toBe('hip hop')
    expect(normalizeTag('  HIP HOP  ')).toBe('hip hop')
  })

  it('rejects anything that is not a usable tag', () => {
    expect(normalizeTag('')).toBeNull()
    expect(normalizeTag('   ')).toBeNull()
    expect(normalizeTag(null)).toBeNull()
    expect(normalizeTag(42)).toBeNull()
  })
})

describe('normalizeTags', () => {
  it('drops empties and duplicate variants, sorted', () => {
    expect(normalizeTags(['Rap', 'rap', ' RAP ', '', 'guessing game'])).toEqual([
      'guessing game',
      'rap',
    ])
  })

  it('survives a hand-edited file full of junk', () => {
    expect(normalizeTags([null, 7, {}, 'ok'])).toEqual(['ok'])
  })

  it('returns an empty list rather than throwing on an empty input', () => {
    expect(normalizeTags([])).toEqual([])
  })
})

describe('normalizeSoundMeta', () => {
  it('reads the bare tag list written before start times existed', () => {
    expect(normalizeSoundMeta(['Run In', 'run in', 'pizza'])).toEqual({ tags: ['pizza', 'run in'] })
  })

  it('reads the record written since', () => {
    expect(normalizeSoundMeta({ tags: ['run in'], startAt: 70 })).toEqual({
      tags: ['run in'],
      startAt: 70,
    })
  })

  it('keeps a start time on a song carrying no tags', () => {
    // Perfectly reasonable: the song is on a pad by name and just starts late.
    expect(normalizeSoundMeta({ tags: [], startAt: 70 })).toEqual({ tags: [], startAt: 70 })
  })

  it('treats 0 as the top of the file rather than as a stored value', () => {
    expect(normalizeSoundMeta({ tags: ['x'], startAt: 0 })).toEqual({ tags: ['x'] })
  })

  it('drops a nonsense start time instead of seeking somewhere impossible', () => {
    for (const bad of [-5, Number.NaN, Number.POSITIVE_INFINITY, '70', null]) {
      expect(normalizeSoundMeta({ tags: ['x'], startAt: bad })).toEqual({ tags: ['x'] })
    }
  })

  it('returns null for an entry holding nothing, so the key can be dropped', () => {
    expect(normalizeSoundMeta([])).toBeNull()
    expect(normalizeSoundMeta({ tags: [] })).toBeNull()
    expect(normalizeSoundMeta('nonsense')).toBeNull()
    expect(normalizeSoundMeta(null)).toBeNull()
  })
})

describe('serializeSoundMeta', () => {
  it('stays in the old shape when there is no start time', () => {
    // So a file this build writes is still mostly readable by one that predates
    // start times, instead of stranding every tag behind a new format.
    expect(serializeSoundMeta({ tags: ['run in'] })).toEqual(['run in'])
  })

  it('uses the record only for the songs that need it', () => {
    expect(serializeSoundMeta({ tags: ['run in'], startAt: 70 })).toEqual({
      tags: ['run in'],
      startAt: 70,
    })
  })

  it('says drop-the-key for an entry that holds nothing', () => {
    expect(serializeSoundMeta({ tags: [] })).toBeNull()
    expect(serializeSoundMeta({ tags: [], startAt: 0 })).toBeNull()
  })

  it('round-trips both shapes', () => {
    for (const meta of [{ tags: ['a', 'b'] }, { tags: ['a'], startAt: 70 }, { tags: [], startAt: 4.5 }]) {
      expect(normalizeSoundMeta(serializeSoundMeta(meta))).toEqual(meta)
    }
  })
})
