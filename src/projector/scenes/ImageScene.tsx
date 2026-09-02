// Full-screen image slide. `fit` decides how the picture meets the frame: fill
// the screen and crop the overflow, or show the whole image letterboxed on
// black. Absent means contain, which is how every image slide behaved before
// the choice existed. On a reveal it pops in; a still-empty slide shows nothing.

import type { ImageSlide } from '../../core/state'

export function ImageScene({ slide, animate = false }: { slide: ImageSlide; animate?: boolean }) {
  // Image slides carry a data: URL (embedded) or an http(s): URL (browser-dev
  // fallback) — both load directly, no BASE_URL resolution needed.
  if (!slide.src) return <div className="scene-image" />
  const fitCls = slide.fit === 'cover' ? 'scene-image--cover' : ''
  return (
    <div className={`scene-image ${fitCls} ${animate ? 'scene-image--reveal' : ''}`}>
      <img className="scene-image__img" src={slide.src} alt="" />
    </div>
  )
}
