import { describe, expect, it } from 'vitest'
import { filterTracks, matchesQuery, suggestTags, tagsForSelection, topTags } from './search'
import type { SoundTrackInfo } from '../shared/bridge'

const track = (name: string, tags: string[] = []): SoundTrackInfo => ({
  id: `/music/${name}.mp3`,
  name,
  url: `sbmedia://audio/?p=${name}`,
  tags,
})

const LIBRARY = [
  track('Hail to the Chief', ['guessing game', 'classic']),
  track('Straight Outta Nowhere', ['rap', 'high energy']),
  track('Slow Jam', ['rap']),
  track('Curtain Call', ['musical numbers']),
]

describe('matchesQuery', () => {
  it('matches on tag as well as name', () => {
    expect(matchesQuery(LIBRARY[1], 'rap')).toBe(true)
    expect(matchesQuery(LIBRARY[1], 'nowhere')).toBe(true)
  })

  it('matches substrings so a partial word still finds the song', () => {
    expect(matchesQuery(LIBRARY[0], 'guess')).toBe(true)
  })

  it('is case-insensitive on both sides', () => {
    expect(matchesQuery(LIBRARY[0], 'HAIL')).toBe(true)
  })

  it('ANDs terms, and may match one term on the name and another on a tag', () => {
    expect(matchesQuery(LIBRARY[1], 'rap nowhere')).toBe(true)
    expect(matchesQuery(LIBRARY[1], 'rap curtain')).toBe(false)
  })

  it('treats an empty or whitespace query as matching everything', () => {
    expect(matchesQuery(LIBRARY[0], '')).toBe(true)
    expect(matchesQuery(LIBRARY[0], '   ')).toBe(true)
  })
})

describe('filterTracks', () => {
  it('returns the whole library for an empty query', () => {
    expect(filterTracks(LIBRARY, '')).toHaveLength(4)
  })

  it('narrows to a tag', () => {
    expect(filterTracks(LIBRARY, 'rap').map((t) => t.name)).toEqual([
      'Straight Outta Nowhere',
      'Slow Jam',
    ])
  })

  it('ANDs pinned tags with each other and with the query', () => {
    expect(filterTracks(LIBRARY, '', ['rap', 'high energy']).map((t) => t.name)).toEqual([
      'Straight Outta Nowhere',
    ])
    expect(filterTracks(LIBRARY, 'slow', ['rap']).map((t) => t.name)).toEqual(['Slow Jam'])
  })

  it('normalizes pinned tags, so casing from anywhere still filters', () => {
    expect(filterTracks(LIBRARY, '', ['RAP'])).toHaveLength(2)
  })
})

describe('tagsForSelection', () => {
  it('splits tags shared by all from tags held by only some', () => {
    expect(tagsForSelection([LIBRARY[1], LIBRARY[2]])).toEqual({
      all: ['rap'],
      some: ['high energy'],
    })
  })

  it('reports a single selection as all-shared', () => {
    expect(tagsForSelection([LIBRARY[0]])).toEqual({ all: ['classic', 'guessing game'], some: [] })
  })

  it('handles an empty selection', () => {
    expect(tagsForSelection([])).toEqual({ all: [], some: [] })
  })
})

describe('suggestTags', () => {
  const ALL = ['classic', 'guessing game', 'high energy', 'musical numbers', 'rap']

  it('completes on substring', () => {
    expect(suggestTags(ALL, 'gue')).toEqual(['guessing game'])
  })

  it('offers everything for empty input', () => {
    expect(suggestTags(ALL, '')).toEqual(ALL)
  })

  it('never offers a tag the selection already has', () => {
    expect(suggestTags(ALL, 'rap', ['rap'])).toEqual([])
  })
})

describe('topTags', () => {
  it('ranks by how many songs carry the tag', () => {
    expect(topTags(LIBRARY).map((t) => t.tag)).toEqual([
      'rap',
      'classic',
      'guessing game',
      'high energy',
      'musical numbers',
    ])
  })

  it('reports the count alongside each tag', () => {
    expect(topTags(LIBRARY)[0]).toEqual({ tag: 'rap', count: 2 })
  })

  it('honours the limit', () => {
    expect(topTags(LIBRARY, 2).map((t) => t.tag)).toEqual(['rap', 'classic'])
  })

  it('returns nothing for an untagged library', () => {
    expect(topTags([{ id: 'a', name: 'a', url: '', tags: [] }])).toEqual([])
  })
})
