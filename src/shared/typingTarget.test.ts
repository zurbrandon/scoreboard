import { describe, expect, it } from 'vitest'
import { isTypingShape, isTypingTarget } from './typingTarget'

// The tests run without a DOM, so elements are stood in for by the handful of
// fields the check reads. isTypingTarget's own job is only to reject things that
// aren't elements at all and hand the rest to isTypingShape.
const input = (type?: string) => ({ tagName: 'INPUT', type })

describe('isTypingShape', () => {
  it('is true for text-entry fields', () => {
    expect(isTypingShape(input('text'))).toBe(true)
    expect(isTypingShape(input('search'))).toBe(true)
    expect(isTypingShape(input('password'))).toBe(true)
    expect(isTypingShape({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isTypingShape({ tagName: 'SELECT' })).toBe(true)
  })

  it('is true for an input with no type, which defaults to text', () => {
    expect(isTypingShape(input())).toBe(true)
  })

  it('is false for inputs you cannot type into', () => {
    // A focused volume slider must not swallow the shortcut.
    expect(isTypingShape(input('range'))).toBe(false)
    expect(isTypingShape(input('checkbox'))).toBe(false)
    expect(isTypingShape(input('button'))).toBe(false)
  })

  it('is true inside a contenteditable, whatever the tag', () => {
    expect(isTypingShape({ tagName: 'DIV', isContentEditable: true })).toBe(true)
  })

  it('is false for ordinary elements', () => {
    // The + on a search result is a button; Escape and "/" have to work there.
    expect(isTypingShape({ tagName: 'BUTTON' })).toBe(false)
    expect(isTypingShape({ tagName: 'DIV' })).toBe(false)
  })
})

describe('isTypingTarget', () => {
  it('reads a real-ish element the same way', () => {
    expect(isTypingTarget(input('text') as unknown as EventTarget)).toBe(true)
    expect(isTypingTarget({ tagName: 'BUTTON' } as unknown as EventTarget)).toBe(false)
  })

  it('is false for a target that is not an element', () => {
    // keydown on the window itself: the target has no tagName.
    expect(isTypingTarget(null)).toBe(false)
    expect(isTypingTarget({} as EventTarget)).toBe(false)
  })
})
