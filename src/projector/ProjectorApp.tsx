// The audience-facing window. It renders exactly one scene and exposes no
// controls (PRD). It only reads state — it never dispatches.

import { AnimatePresence, motion } from 'motion/react'
import { useAppState } from '../store/react'
import { Scoreboard } from './scenes/Scoreboard'
import { LogoScene } from './scenes/LogoScene'
import { TextScene } from './scenes/TextScene'
import { ImageScene } from './scenes/ImageScene'
import { Slideshow } from './scenes/Slideshow'
import { EffectOverlay } from './EffectOverlay'

export function ProjectorApp() {
  const scene = useAppState((s) => s.scene)
  // revealAnimNonce bumps only on a REVEAL (not silent). Keying the slide stage
  // on it lets Motion crossfade between slides on reveal, while `animate` gates
  // each slide's own inner entrance (logo pop, text slam, …). On silent the
  // nonce is unchanged, so the slide swaps instantly with no transition.
  const animNonce = useAppState((s) => s.revealAnimNonce)
  const animate = useAppState((s) => s.displayWasReveal)
  const liveSlide = useAppState((s) => s.slides.live)
  const effect = useAppState((s) => s.effect)

  return (
    <div className="projector">
      {scene === 'scoreboard' && <Scoreboard />}
      {scene === 'slides' && (
        <AnimatePresence>
          <motion.div
            key={animNonce}
            className="slide-stage"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.015 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            {liveSlide?.type === 'logo' && <LogoScene slide={liveSlide} animate={animate} />}
            {liveSlide?.type === 'text' && <TextScene slide={liveSlide} animate={animate} />}
            {liveSlide?.type === 'image' && <ImageScene slide={liveSlide} animate={animate} />}
            {!liveSlide && <div className="scene-logo" />}
          </motion.div>
        </AnimatePresence>
      )}
      {scene === 'slideshow' && <Slideshow />}
      {scene === 'black' && <div className="scene-black" />}
      {/* Overlay effects play on top of every scene. */}
      <EffectOverlay kind={effect.kind} nonce={effect.nonce} />
    </div>
  )
}
