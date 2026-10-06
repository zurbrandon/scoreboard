import { describe, expect, it } from 'vitest'
import { webAddress } from './Slideshow'

describe('webAddress', () => {
  it('gives a bare address https://', () => {
    expect(webAddress('google.com')).toBe('https://google.com')
    expect(webAddress('  en.wikipedia.org/wiki/Comedy ')).toBe('https://en.wikipedia.org/wiki/Comedy')
    expect(webAddress('//example.com')).toBe('https://example.com')
  })
  it('leaves an address that already has a scheme alone', () => {
    expect(webAddress('http://example.com')).toBe('http://example.com')
    expect(webAddress('https://docs.google.com/presentation/d/x/pub')).toBe('https://docs.google.com/presentation/d/x/pub')
  })
  it('keeps empty empty', () => {
    expect(webAddress('   ')).toBe('')
  })
})
