// The audience-facing window. It renders exactly one scene and exposes no
// controls (PRD). It only reads state — it never dispatches.

import { useAppState } from '../store/react'
import { Scoreboard } from './scenes/Scoreboard'
import { LogoScene } from './scenes/LogoScene'
import { TextScene } from './scenes/TextScene'
import { Slideshow } from './scenes/Slideshow'
import { EffectOverlay } from './EffectOverlay'

export function ProjectorApp() {
  const scene = useAppState((s) => s.scene)
  // key on the nonce so a fresh reveal remounts the scene and replays its
  // entrance; `animate` gates whether the entrance runs at all (off for silent).
  const animNonce = useAppState((s) => s.revealAnimNonce)
  const animate = useAppState((s) => s.displayWasReveal)
  const liveSlide = useAppState((s) => s.slides.live)
  const effect = useAppState((s) => s.effect)

  return (
    <div className="projector">
      {scene === 'scoreboard' && <Scoreboard />}
      {scene === 'slides' && liveSlide?.type === 'logo' && (
        <LogoScene key={animNonce} slide={liveSlide} animate={animate} />
      )}
      {scene === 'slides' && liveSlide?.type === 'text' && (
        <TextScene key={animNonce} slide={liveSlide} animate={animate} />
      )}
      {scene === 'slides' && !liveSlide && <div className="scene-logo" />}
      {scene === 'slideshow' && <Slideshow />}
      {scene === 'black' && <div className="scene-black" />}
      {/* Overlay effects play on top of every scene. */}
      <EffectOverlay kind={effect.kind} nonce={effect.nonce} />
    </div>
  )
}
