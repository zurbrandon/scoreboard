// Team-color screen wash (a radial vignette) driven by press-and-hold on the
// operator's wash effect. While `washHold` is set it PULSES (opacity loop); when
// the operator lets go the state clears and AnimatePresence settles it out over
// a beat, rather than cutting. Opacity-only (composited — no per-frame blur).

import { AnimatePresence, motion } from 'motion/react'
import { useAppState } from '../store/react'

// One in→out pulse while held. Slow and gentle — a team-color swell, not a
// frantic strobe. Exported so the operator can hold a TAP for one full pulse.
export const WASH_PULSE_MS = 2000

export function WashOverlay() {
  const kind = useAppState((s) => s.washHold)
  return (
    <AnimatePresence>
      {kind && (
        <motion.div
          key={kind}
          className={`fx-wash fx-wash--${kind}`}
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.88, 0] }}
          exit={{ opacity: 0, transition: { duration: 0.7, ease: 'easeOut' } }}
          transition={{ duration: WASH_PULSE_MS / 1000, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </AnimatePresence>
  )
}
