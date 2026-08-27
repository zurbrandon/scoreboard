import { describe, expect, it } from 'vitest'
import { normalizeTag, normalizeTags } from './soundTags'

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
