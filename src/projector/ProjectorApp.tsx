// The audience-facing window. It renders exactly one scene and exposes no
// controls (PRD). It only reads state — it never dispatches.

import { useAppState } from '../store/react'
import { Scoreboard } from './scenes/Scoreboard'
import { LogoScene } from './scenes/LogoScene'
import { TextScene } from './scenes/TextScene'
import { Slideshow } from './scenes/Slideshow'

export function ProjectorApp() {
  const scene = useAppState((s) => s.scene)
  // key on the nonce so a fresh reveal remounts the scene and replays its
  // entrance; `animate` gates whether the entrance runs at all (off for silent).
  const animNonce = useAppState((s) => s.revealAnimNonce)
  const animate = useAppState((s) => s.displayWasReveal)

  return (
    <div className="projector">
      {scene === 'scoreboard' && <Scoreboard />}
      {scene === 'logo' && <LogoScene key={animNonce} animate={animate} />}
      {scene === 'text' && <TextScene key={animNonce} animate={animate} />}
      {scene === 'slideshow' && <Slideshow />}
      {scene === 'black' && <div className="scene-black" />}
    </div>
  )
}
