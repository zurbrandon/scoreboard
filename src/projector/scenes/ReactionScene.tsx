// The audience side of a "reaction" control slide (first game: Yay Boo). When no
// reaction is live it shows a neutral holding wordmark; each operator tap flashes
// the whole screen a team color with a big word (YAY / BOO). Keyed on the nonce
// so the flash replays even when the same team+word is tapped twice in a row.
//
// Animation is transform/opacity only (projector rule): the field pops in and the
// word slams down — no per-frame blur.

import { motion } from 'motion/react'
import type { ReactionKind, TeamId } from '../../core/state'

export function ReactionScene({
  reaction,
  nonce,
}: {
  reaction: { team: TeamId; kind: ReactionKind } | null
  nonce: number
}) {
  if (!reaction) {
    return (
      <div className="reaction reaction--idle">
        <div className="reaction__wordmark">Yay Boo</div>
      </div>
    )
  }
  const word = reaction.kind === 'yay' ? 'YAY!' : 'BOO!'
  return (
    <motion.div
      key={nonce}
      className={`reaction reaction--${reaction.team} reaction--${reaction.kind}`}
      initial={{ opacity: 0, scale: 1.06 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div
        className="reaction__word"
        initial={{ scale: 1.45, y: '-4%' }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 15, mass: 0.9 }}
      >
        {word}
      </motion.div>
    </motion.div>
  )
}
