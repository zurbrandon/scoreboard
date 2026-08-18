// The audience side of a "reaction" control slide (first game: Yay Boo). When no
// reaction is live it shows a neutral holding wordmark; each operator tap flashes
// the whole screen a team color with a big word (YAY / BOO), holds for a beat,
// then fades back to black on its own — so there's no neutral state to manage and
// each tap is fully self-contained (tap → pop → gone).
//
// Entrances are randomized per tap (never the same one twice in a row) so a run
// of flashes doesn't feel mechanical. Animation is transform/opacity only
// (projector rule): no per-frame blur.

import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { ReactionKind, TeamId } from '../../core/state'

// How long the word stays fully up before it fades out. A "yay" lingers; a "boo"
// is quick and dismissive.
const HOLD_MS: Record<ReactionKind, number> = { yay: 2000, boo: 1000 }
const FADE = { duration: 0.5, ease: 'easeIn' as const }
const REST = { opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 }

// A spread of distinct entrances. Each is a starting transform + the spring that
// carries it to REST; the fade-out is shared.
const ENTRANCES: { from: Record<string, number | string>; spring: object }[] = [
  { from: { opacity: 0, scale: 1.6 }, spring: { type: 'spring', stiffness: 520, damping: 15, mass: 0.9 } }, // slam
  { from: { opacity: 0, scale: 0.3 }, spring: { type: 'spring', stiffness: 300, damping: 12 } }, // pop
  { from: { opacity: 0, y: '-75%' }, spring: { type: 'spring', stiffness: 420, damping: 18 } }, // drop from top
  { from: { opacity: 0, y: '75%' }, spring: { type: 'spring', stiffness: 440, damping: 22 } }, // rise up
  { from: { opacity: 0, x: '-70%', rotate: -6 }, spring: { type: 'spring', stiffness: 360, damping: 17 } }, // swoop left
  { from: { opacity: 0, x: '70%', rotate: 6 }, spring: { type: 'spring', stiffness: 360, damping: 17 } }, // swoop right
]

// Pick a random entrance, but never the same one twice in a row. Module-level
// (projector-only presentation, not app state) so it persists across taps.
let lastEntrance = -1
function pickEntrance() {
  if (ENTRANCES.length < 2) return ENTRANCES[0]
  let i = Math.floor(Math.random() * ENTRANCES.length)
  if (i === lastEntrance) i = (i + 1) % ENTRANCES.length
  lastEntrance = i
  return ENTRANCES[i]
}

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
  // key={nonce} remounts on every tap, so the entrance + hold timer replay fresh.
  return <ReactionFlash key={nonce} reaction={reaction} />
}

function ReactionFlash({ reaction }: { reaction: { team: TeamId; kind: ReactionKind } }) {
  const [gone, setGone] = useState(false)
  const [entrance] = useState(pickEntrance)
  useEffect(() => {
    const t = setTimeout(() => setGone(true), HOLD_MS[reaction.kind])
    return () => clearTimeout(t)
  }, [reaction.kind])
  const word = reaction.kind === 'yay' ? 'YAY!' : 'BOO!'
  // Static black field; only the (team-colored) word animates in and fades out —
  // a whole-screen color flash was too much motion on a big projector.
  return (
    <div className={`reaction reaction--flash reaction--${reaction.team}`}>
      <motion.div
        className="reaction__word"
        initial={entrance.from}
        animate={gone ? { opacity: 0 } : REST}
        transition={gone ? FADE : entrance.spring}
      >
        {word}
      </motion.div>
    </div>
  )
}
