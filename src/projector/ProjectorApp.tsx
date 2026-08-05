// The audience-facing window. It renders exactly one scene and exposes no
// controls (PRD). It only reads state — it never dispatches.

import { useAppState } from '../store/react'
import { findLogo } from '../core/logos'
import { Scoreboard } from './scenes/Scoreboard'
import { LogoScene } from './scenes/LogoScene'
import { Slideshow } from './scenes/Slideshow'

export function ProjectorApp() {
  const scene = useAppState((s) => s.scene)
  const liveLogoId = useAppState((s) => s.logo.liveId)
  const liveLogo = findLogo(liveLogoId)

  return (
    <div className="projector">
      {scene === 'scoreboard' && <Scoreboard />}
      {scene === 'logo' && (
        <LogoScene
          label={liveLogo?.name ?? 'Logo'}
          accent="#3b6fff"
          file={liveLogo?.file}
        />
      )}
      {scene === 'text' && <LogoScene label="Text" accent="#8e44ad" />}
      {scene === 'slideshow' && <Slideshow />}
      {scene === 'black' && <div className="scene-black" />}
    </div>
  )
}
