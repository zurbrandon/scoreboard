// Full-screen image slide. The picture is contained (whole image visible) on a
// black field. On a reveal it pops in; a still-empty slide shows nothing.

import type { ImageSlide } from '../../core/state'

export function ImageScene({ slide, animate = false }: { slide: ImageSlide; animate?: boolean }) {
  // Image slides carry a data: URL (embedded) or an http(s): URL (browser-dev
  // fallback) — both load directly, no BASE_URL resolution needed.
  if (!slide.src) return <div className="scene-image" />
  return (
    <div className={`scene-image ${animate ? 'scene-image--reveal' : ''}`}>
      <img className="scene-image__img" src={slide.src} alt="" />
    </div>
  )
}
