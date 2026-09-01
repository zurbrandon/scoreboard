import { describe, expect, it } from 'vitest'
import { formatTimecode, parseTimecode } from './timecode'

describe('formatTimecode', () => {
  it('pads the seconds so the field never jumps a character wide', () => {
    expect(formatTimecode(67)).toBe('1:07')
    expect(formatTimecode(70)).toBe('1:10')
    expect(formatTimecode(5)).toBe('0:05')
    expect(formatTimecode(0)).toBe('0:00')
    expect(formatTimecode(3 * 60 + 48)).toBe('3:48')
  })

  it('floors rather than rounds, so a marker never reads past where it sits', () => {
    expect(formatTimecode(69.9)).toBe('1:09')
  })

  it('shows 0:00 for junk instead of NaN, since this goes on screen', () => {
    expect(formatTimecode(Number.NaN)).toBe('0:00')
    expect(formatTimecode(-4)).toBe('0:00')
    expect(formatTimecode(Number.POSITIVE_INFINITY)).toBe('0:00')
  })
})

describe('parseTimecode', () => {
  it('reads the form the field shows', () => {
    expect(parseTimecode('1:07')).toBe(67)
    expect(parseTimecode('0:05')).toBe(5)
    expect(parseTimecode('3:48')).toBe(228)
  })

  it('accepts the shapes you actually type one-handed', () => {
    expect(parseTimecode('1:7')).toBe(67) // no leading zero
    expect(parseTimecode('67')).toBe(67) // bare seconds
    expect(parseTimecode('  1:07  ')).toBe(67) // stray spaces
    expect(parseTimecode('1.5')).toBe(1.5) // sub-second nudge
  })

  it('takes 1:70 as 130 rather than refusing an obvious intent', () => {
    expect(parseTimecode('1:70')).toBe(130)
  })

  it('returns null for anything that is not a time', () => {
    for (const bad of ['', '   ', 'abc', '1:', ':30', '1:2:3', '-5', '1:-7', '1:070']) {
      expect(parseTimecode(bad)).toBeNull()
    }
  })

  it('round-trips whole seconds, so opening a field and closing it moves nothing', () => {
    for (const secs of [0, 5, 59, 60, 67, 70, 228, 3599, 3600]) {
      expect(parseTimecode(formatTimecode(secs))).toBe(secs)
    }
  })
})
