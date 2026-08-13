// Full-screen slideshow scene. Loads whatever URL the operator set — typically a
// published Google Slides "embed" link with ?start=true&loop=true&delayms=...,
// which auto-plays and loops on its own. This is the one online-dependent scene
// (it needs internet to reach the slides); everything else runs offline.

export function Slideshow({ url }: { url: string }) {
  if (!url.trim()) {
    return (
      <div className="scene-slideshow scene-slideshow--empty">
        Paste a slideshow link in the operator settings
      </div>
    )
  }

  return (
    <iframe
      className="scene-slideshow"
      src={url}
      title="Pre-show slideshow"
      allow="autoplay; fullscreen"
      allowFullScreen
    />
  )
}
