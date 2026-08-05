// The audience-facing window. It renders exactly one scene and exposes no
// controls (PRD). It only reads state — it never dispatches.

import { useAppState } from '../store/react'
import { Scoreboard } from './scenes/Scoreboard'
import { LogoScene } from './scenes/LogoScene'
import { Slideshow } from './scenes/Slideshow'

export function ProjectorApp() {
  const scene = useAppState((s) => s.scene)

  return (
    <div className="projector">
      {scene === 'scoreboard' && <Scoreboard />}
      {scene === 'cszLogo' && (
        <LogoScene label="ComedySportz" accent="#3b6fff" file="comedysportz.png" />
      )}
      {scene === 'theaterLogo' && (
        <LogoScene
          label="Seattle Comedy Theater"
          accent="#c0392b"
          file="seattle-comedy-theater.png"
        />
      )}
      {scene === 'comic' && <LogoScene label="Comic" accent="#8e44ad" />}
      {scene === 'slideshow' && <Slideshow />}
      {scene === 'black' && <div className="scene-black" />}
    </div>
  )
}
