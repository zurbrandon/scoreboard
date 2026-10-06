// Full-screen web page scene — a Google Slides deck that plays itself, or any
// site the operator clicks around in right here on the projector (the audience
// sees the mouse). This is the one online-dependent scene; everything else runs
// offline.
//
// In the app it's a <webview>: a real browser view, so sites that forbid being
// framed (most of them) still load, and the main process locks it down (see
// lockDownWebPages). In a plain browser tab — the dev preview — there is no
// webview, so it falls back to the old iframe.

import { useEffect, useRef } from 'react'
import { useAppState } from '../../store/react'
import { webAddress } from '../../shared/webAddress'

// The <webview> element's navigation API, as much of it as this scene uses.
interface WebviewElement extends HTMLElement {
  canGoBack(): boolean
  goBack(): void
  loadURL(url: string): Promise<void>
}

const inApp = typeof window !== 'undefined' && 'showboard' in window

export function Slideshow({ url: typed }: { url: string }) {
  const url = webAddress(typed)
  const viewRef = useRef<WebviewElement>(null)
  const webNav = useAppState((s) => s.webNav)
  const seenNav = useRef(webNav?.nonce ?? 0)

  // The operator's Back / Home buttons. Only presses made while this page is up
  // count — mounting never replays an old one.
  useEffect(() => {
    if (!webNav || webNav.nonce === seenNav.current) return
    seenNav.current = webNav.nonce
    const view = viewRef.current
    if (!view) return
    try {
      if (webNav.action === 'back' && view.canGoBack()) view.goBack()
      else if (webNav.action === 'home') void view.loadURL(url).catch(() => {})
    } catch {
      // Not attached yet (still loading its first page) — nothing to go back from.
    }
  }, [webNav, url])

  if (!url.trim()) {
    return (
      <div className="scene-slideshow scene-slideshow--empty">
        Paste a link on the web page slide
      </div>
    )
  }

  if (inApp) {
    return <webview ref={viewRef} className="scene-slideshow" src={url} partition="persist:web" />
  }

  return (
    <iframe
      className="scene-slideshow"
      src={url}
      title="Web page"
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
