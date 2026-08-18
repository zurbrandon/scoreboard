// The audience-facing window. It renders exactly one scene and exposes no
// controls (PRD). It only reads state — it never dispatches.

import { AnimatePresence, motion } from 'motion/react'
import { useAppState } from '../store/react'
import type { LogoSlide } from '../core/state'
import { Scoreboard } from './scenes/Scoreboard'
import { LogoScene } from './scenes/LogoScene'
import { TextScene } from './scenes/TextScene'
import { ImageScene } from './scenes/ImageScene'
import { Slideshow } from './scenes/Slideshow'
import { ShowScene } from './scenes/ShowScene'
import { ReactionScene } from './scenes/ReactionScene'
import { MomentScene } from './scenes/MomentScene'
import { GifOverlay } from './GifOverlay'
import { WashOverlay } from './WashOverlay'
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
  const teams = useAppState((s) => s.teams)
  const moment = useAppState((s) => s.moment)
  const momentNonce = useAppState((s) => s.momentNonce)
  const reaction = useAppState((s) => s.reaction)
  const reactionNonce = useAppState((s) => s.reactionNonce)
  // Idle (Blank) screen: null → black; else a logo src held static on black. If
  // the src matches a deck logo slide we borrow its website so the URL shows too.
  const idleLogoSrc = useAppState((s) => s.idleLogoSrc)
  const idleWebsite = useAppState((s) => {
    if (!idleLogoSrc) return ''
    const match = s.slides.items.find((x): x is LogoSlide => x.type === 'logo' && x.src === idleLogoSrc)
    return match?.website ?? ''
  })
  const idleLogoSlide: LogoSlide | null = idleLogoSrc
    ? { id: '__idle', type: 'logo', deck: 'show', name: '', src: idleLogoSrc, website: idleWebsite }
    : null
  const effect = useAppState((s) => s.effect)
  // 'team-emoji' effect: which team's scoreboard mood(s) to rain. A blue-side beat
  // → blue's emoji, a red-side beat → red's, anything else → both mixed. Empty
  // moods fall back to a colored circle so there's always something to throw.
  const blueEmoji = useAppState((s) => s.teams.blue.mood).trim() || '🔵'
  const redEmoji = useAppState((s) => s.teams.red.mood).trim() || '🔴'
  const liveBeat = liveSlide?.type === 'show' ? liveSlide.beat : null
  const emojiSide = liveBeat?.endsWith('blue') ? 'blue' : liveBeat?.endsWith('red') ? 'red' : 'both'

  return (
    <div className="projector">
      {scene === 'scoreboard' && <Scoreboard />}
      {scene === 'slides' && (
        <AnimatePresence>
          <motion.div
            key={animNonce}
            className="slide-stage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          >
            {liveSlide?.type === 'logo' && <LogoScene slide={liveSlide} animate={animate} />}
            {liveSlide?.type === 'text' && <TextScene slide={liveSlide} animate={animate} />}
            {liveSlide?.type === 'image' && <ImageScene slide={liveSlide} animate={animate} />}
            {liveSlide?.type === 'slideshow' && <Slideshow url={liveSlide.url} />}
            {liveSlide?.type === 'show' && <ShowScene slide={liveSlide} teams={teams} animate={animate} />}
            {liveSlide?.type === 'reaction' && <ReactionScene reaction={reaction} nonce={reactionNonce} />}
            {!liveSlide && <div className="scene-logo" />}
          </motion.div>
        </AnimatePresence>
      )}
      {scene === 'moment' && moment && <MomentScene key={momentNonce} moment={moment} />}
      {scene === 'black' &&
        (idleLogoSlide ? (
          <div className="scene-black">
            <LogoScene slide={idleLogoSlide} />
          </div>
        ) : (
          <div className="scene-black" />
        ))}
      {/* A searched GIF over the scene; effects still fly on top of it. */}
      <GifOverlay />
      {/* Held team-color wash (press-and-hold from the operator). */}
      <WashOverlay />
      {/* Overlay effects play on top of every scene. */}
      <EffectOverlay
        kind={effect.kind}
        nonce={effect.nonce}
        emojiSide={emojiSide}
        blueEmoji={blueEmoji}
        redEmoji={redEmoji}
      />
    </div>
  )
}
