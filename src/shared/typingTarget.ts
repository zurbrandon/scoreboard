// Is the keyboard currently going into a text field?
//
// A bare "/" shortcut has to know: it's also a character someone might be typing
// into a song name or a tag, and a shortcut that eats a keystroke mid-word is
// worse than no shortcut.

const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
])

// Only the three fields the decision actually reads. Split out as a plain shape
// so the rule can be tested without standing up a DOM, and so the check doesn't
// lean on `instanceof HTMLElement` — Electron hands us elements from more than
// one realm, and that test quietly returns false for the foreign ones.
export type TypingTargetShape = {
  tagName: string
  isContentEditable?: boolean
  type?: string
}

export function isTypingShape(el: TypingTargetShape): boolean {
  if (el.isContentEditable) return true
  const tag = el.tagName.toUpperCase()
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag !== 'INPUT') return false
  // Buttons, checkboxes and range sliders are inputs too, but typing into them
  // isn't a thing — a slider shouldn't block the shortcut. An input with no
  // type attribute is a text box, which is why the default here is 'text'.
  return TEXT_INPUT_TYPES.has((el.type ?? 'text').toLowerCase())
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as Partial<HTMLInputElement> | null
  if (!el || typeof el.tagName !== 'string') return false
  return isTypingShape(el as TypingTargetShape)
}
