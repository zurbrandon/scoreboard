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
      // Everything an embedded deck needs — EXCEPT top navigation, so a Canva /
      // Google "present" page can't frame-bust and yank the projector off-screen
      // mid-show. (Header stripping in the main process is what lets these non-
      // embed pages load in the first place.)
      sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms"
    />
  )
}
