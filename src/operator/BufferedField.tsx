// Text fields backed by the app store round-trip their value through the owner
// of truth (in Electron, an async IPC hop to main and back). A plain controlled
// <input value={store}> therefore doesn't see its value change synchronously on
// a keystroke, so React snaps the DOM back to the old value — which drops the
// caret to the end whenever you edit mid-string.
//
// These wrappers fix that: they show a LOCAL value while the field is focused
// (so the caret stays exactly where you put it) and commit every keystroke to
// the store. They re-sync from the store only when the field isn't being edited,
// so external changes (loading a template, another edit) still show up.

import { useEffect, useRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

function useBuffered(value: string) {
  const [local, setLocal] = useState(value)
  const editing = useRef(false)
  // Pull the store value in only when we're not mid-edit; while typing, local is
  // the source of truth and the async echo of our own edit never fights the caret.
  useEffect(() => {
    if (!editing.current) setLocal(value)
  }, [value])
  return { local, setLocal, editing }
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onCommit: (value: string) => void
}

export function BufferedInput({ value, onCommit, onFocus, onBlur, ...rest }: InputProps) {
  const { local, setLocal, editing } = useBuffered(value)
  return (
    <input
      {...rest}
      value={local}
      onChange={(e) => {
        setLocal(e.target.value)
        onCommit(e.target.value)
      }}
      onFocus={(e) => {
        editing.current = true
        onFocus?.(e)
      }}
      onBlur={(e) => {
        editing.current = false
        onBlur?.(e)
      }}
    />
  )
}

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onCommit: (value: string) => void
}

export function BufferedTextarea({ value, onCommit, onFocus, onBlur, ...rest }: TextareaProps) {
  const { local, setLocal, editing } = useBuffered(value)
  return (
    <textarea
      {...rest}
      value={local}
      onChange={(e) => {
        setLocal(e.target.value)
        onCommit(e.target.value)
      }}
      onFocus={(e) => {
        editing.current = true
        onFocus?.(e)
      }}
      onBlur={(e) => {
        editing.current = false
        onBlur?.(e)
      }}
    />
  )
}
