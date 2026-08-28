import { describe, expect, it } from 'vitest'
import { pickFromPool, tracksWithTag } from './bumper'
import { normSoundSlots } from './state'

const track = (name: string, tags: string[]) => ({ id: name, name, url: '', tags })
const LIBRARY = [
  track('a', ['run in']),
  track('b', ['run in', 'high energy']),
  track('c', ['run out']),
  track('d', []),
]

describe('tracksWithTag', () => {
  it('collects every song carrying the tag', () => {
    expect(tracksWithTag(LIBRARY, 'run in').map((t) => t.name)).toEqual(['a', 'b'])
  })

  it('returns nothing for an unset slot, which is the signal to fall back', () => {
    expect(tracksWithTag(LIBRARY, null)).toEqual([])
  })

  it('returns nothing for a tag no song carries yet', () => {
    expect(tracksWithTag(LIBRARY, 'captains')).toEqual([])
  })

  it('ignores songs with no tags yet', () => {
    expect(tracksWithTag(LIBRARY, 'run in').map((t) => t.name)).not.toContain('d')
  })
})

describe('pickFromPool', () => {
  it('picks by the given random, so the choice is testable', () => {
    expect(pickFromPool(['a', 'b', 'c'], () => 0)).toBe('a')
    expect(pickFromPool(['a', 'b', 'c'], () => 0.99)).toBe('c')
  })

  it('returns null for an empty pool rather than undefined', () => {
    expect(pickFromPool([], () => 0)).toBeNull()
  })
})

describe('normSoundSlots', () => {
  it('fills every slot, keeping the ones that were set', () => {
    expect(normSoundSlots({ runIn: 'run in', bogus: 'x' })).toEqual({
      runOut: null,
      runIn: 'run in',
      captain: null,
      drumroll: null,
    })
  })

  it('returns all-empty for a missing or junk value', () => {
    expect(normSoundSlots(undefined)).toEqual({ runOut: null, runIn: null, captain: null, drumroll: null })
    expect(normSoundSlots('nope')).toEqual({ runOut: null, runIn: null, captain: null, drumroll: null })
  })
})
