import { describe, expect, it } from 'vitest'
import { parseByteRange } from './byteRange'

const SIZE = 1000

describe('parseByteRange', () => {
  it('reads an open-ended range as "to the end of the file"', () => {
    expect(parseByteRange('bytes=0-', SIZE)).toEqual({ start: 0, end: 999 })
    expect(parseByteRange('bytes=500-', SIZE)).toEqual({ start: 500, end: 999 })
  })

  it('reads an explicit range inclusively at both ends', () => {
    // 100..199 is 100 bytes; treating `end` as exclusive would drop one.
    expect(parseByteRange('bytes=100-199', SIZE)).toEqual({ start: 100, end: 199 })
  })

  it('reads the suffix form as the last N bytes', () => {
    expect(parseByteRange('bytes=-500', SIZE)).toEqual({ start: 500, end: 999 })
  })

  it('clamps a suffix longer than the file to the whole file', () => {
    expect(parseByteRange('bytes=-5000', SIZE)).toEqual({ start: 0, end: 999 })
  })

  it('clamps an end past the file rather than rejecting it', () => {
    expect(parseByteRange('bytes=900-99999', SIZE)).toEqual({ start: 900, end: 999 })
  })

  it('rejects ranges that start outside the file', () => {
    expect(parseByteRange('bytes=1000-', SIZE)).toBeNull()
    expect(parseByteRange('bytes=1500-1600', SIZE)).toBeNull()
  })

  it('rejects a backwards range', () => {
    expect(parseByteRange('bytes=800-700', SIZE)).toBeNull()
  })

  it('rejects malformed or absent headers', () => {
    expect(parseByteRange(null, SIZE)).toBeNull()
    expect(parseByteRange('bytes=', SIZE)).toBeNull()
    expect(parseByteRange('items=0-10', SIZE)).toBeNull()
    expect(parseByteRange('bytes=abc-def', SIZE)).toBeNull()
    expect(parseByteRange('bytes=0-10, 20-30', SIZE)).toBeNull() // multi-range: not supported
  })

  it('handles a single-byte file', () => {
    expect(parseByteRange('bytes=0-', 1)).toEqual({ start: 0, end: 0 })
  })
})
