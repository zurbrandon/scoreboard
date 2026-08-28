import { describe, expect, it } from 'vitest'
import { refillBag, shuffle } from './shuffleBag'

// A deterministic stand-in for Math.random, cycling through fixed values.
const seeded = (values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

describe('shuffle', () => {
  it('keeps every item exactly once', () => {
    const out = shuffle(['a', 'b', 'c', 'd'], seeded([0.1, 0.7, 0.3, 0.9]))
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('does not mutate the input', () => {
    const input = ['a', 'b', 'c']
    shuffle(input, seeded([0.5]))
    expect(input).toEqual(['a', 'b', 'c'])
  })

  it('handles empty and single-item pools', () => {
    expect(shuffle([])).toEqual([])
    expect(shuffle(['only'])).toEqual(['only'])
  })
})

describe('refillBag', () => {
  it('deals every song before any repeats', () => {
    const pool = ['a', 'b', 'c', 'd', 'e']
    const bag = refillBag(pool, null, seeded([0.2, 0.8, 0.4, 0.6]))
    expect([...bag].sort()).toEqual([...pool].sort())
    expect(new Set(bag).size).toBe(pool.length)
  })

  it('avoids opening the new pass with the song that just played', () => {
    // A shuffle that would otherwise put 'a' first.
    const bag = refillBag(['a', 'b', 'c'], 'a', () => 0)
    expect(bag[0]).not.toBe('a')
    expect([...bag].sort()).toEqual(['a', 'b', 'c'])
  })

  it('still returns the only song when the pool has one', () => {
    // Nothing else to play: repeating is the only option, not a bug.
    expect(refillBag(['only'], 'only', () => 0)).toEqual(['only'])
  })

  it('returns an empty bag for an empty pool', () => {
    expect(refillBag([], null, () => 0)).toEqual([])
  })
})
