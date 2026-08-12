// A searched GIF laid over the current scene (from the operator's GIF tool).
// Sits above the scene but below the effect overlay, so confetti can still fly
// over it. Cleared by picking "Clear", going to Black, or the auto-dismiss timer.
// AnimatePresence gives it a graceful fade+settle OUT (and a crossfade when the
// operator swaps to a different GIF), instead of just vanishing.

import { AnimatePresence, motion } from 'motion/react'
import { useAppState } from '../store/react'

export function GifOverlay() {
  const src = useAppState((s) => s.gifOverlay)
  return (
    <AnimatePresence>
      {src && (
        <motion.div
          key={src}
          className="gif-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* the img keeps its CSS pop-in + gentle sway */}
          <img className="gif-overlay__img" src={src} alt="" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
