// Full-screen text scene: shows the committed (live) text the operator typed.
// Preserves line breaks so multi-line messages lay out as written.

import { useAppState } from '../../store/react'

export function TextScene() {
  const text = useAppState((s) => s.text.live)
  return <div className="scene-text">{text}</div>
}
