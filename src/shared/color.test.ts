import { describe, expect, it } from 'vitest'
import { isLightColor, normalizeHexColor } from './color'

describe('normalizeHexColor', () => {
  it('takes the hex however it was typed', () => {
    expect(normalizeHexColor('#0a84ff')).toBe('#0a84ff')
    expect(normalizeHexColor('0a84ff')).toBe('#0a84ff') // no hash
    expect(normalizeHexColor('#0A84FF')).toBe('#0a84ff') // shouting
    expect(normalizeHexColor('  #0a84ff  ')).toBe('#0a84ff') // pasted with spaces
  })

  it('expands the three-digit shorthand on the way in', () => {
    // So everything downstream only ever sees one form.
    expect(normalizeHexColor('#abc')).toBe('#aabbcc')
    expect(normalizeHexColor('fff')).toBe('#ffffff')
    expect(normalizeHexColor('#000')).toBe('#000000')
  })

  it('refuses anything that is not a hex, so a half-typed value never lands', () => {
    for (const bad of ['', '   ', '#', '#ab', '#abcd', '#abcde', '#abcdefg', 'red', '#gggggg', '##fff']) {
      expect(normalizeHexColor(bad), bad).toBeNull()
    }
  })
})

describe('isLightColor', () => {
  it('knows white and pale colors need dark text', () => {
    expect(isLightColor('#ffffff')).toBe(true)
    expect(isLightColor('#f2f4f8')).toBe(true)
    expect(isLightColor('#ffd23f')).toBe(true) // the gold
  })

  it('knows the stage darks keep white text', () => {
    expect(isLightColor('#05070d')).toBe(false)
    expect(isLightColor('#161a26')).toBe(false)
    expect(isLightColor('#1b2a4a')).toBe(false)
    expect(isLightColor('#c0392b')).toBe(false) // the red
  })

  it('weights green over blue, which a plain average gets backwards', () => {
    // Same numeric value, wildly different apparent brightness.
    expect(isLightColor('#00ff00')).toBe(true)
    expect(isLightColor('#0000ff')).toBe(false)
  })

  it('accepts the shorthand, since that is what someone types', () => {
    expect(isLightColor('#fff')).toBe(true)
    expect(isLightColor('#000')).toBe(false)
  })

  it('answers false for a non-color, keeping the safe white-on-dark default', () => {
    for (const bad of ['', 'nonsense', '#12345']) expect(isLightColor(bad)).toBe(false)
  })
})
