// The scripted show-intro beats: full-screen themed cards the operator flips
// through to open a match (welcome the ref, the players, each team, the captains,
// or settle the room to black). Team beats pull the live team names so "the Blue
// team" reads as whatever the teams are actually called.
//
// Animation follows the projector rule: transform/opacity only, never per-frame
// blur — the ref stripes are one wide striped element sliding on translateX.

import { motion } from 'motion/react'
import type { ShowSlide, TeamId } from '../../core/state'

function rosterLines(roster: string): string[] {
  return roster
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

// A team welcome / captain card: solid team color, an eyebrow label, the team
// name, and either a roster or a single captain name.
function TeamCard({
  side,
  eyebrow,
  title,
  roster,
  name,
}: {
  side: TeamId
  eyebrow: string
  title: string
  roster?: string[]
  name?: string
}) {
  return (
    <div className={`show show--team show--${side}`}>
      <div className="show__eyebrow">{eyebrow}</div>
      <div className="show__title">{title}</div>
      {roster && roster.length > 0 && (
        <ul className="show__roster">
          {roster.map((n, i) => (
            <li key={i} className="show__roster-item" style={{ ['--i' as string]: i }}>
              {n}
            </li>
          ))}
        </ul>
      )}
      {name && <div className="show__name">{name}</div>}
    </div>
  )
}

// A dual split card (players / captains): a diagonal seam with blue on one side,
// red on the other. On reveal, blue rushes in from the left and red from the
// right; they meet on the seam, then the title appears. Just the title — no
// eyebrow. (Silent update: everything sits at its final spot, no entrance.)
function DualCard({ title, animate }: { title: string; animate: boolean }) {
  const spring = { type: 'spring' as const, stiffness: 95, damping: 19 }
  return (
    <div className="show show--dual">
      <motion.div
        className="show__half show__half--blue"
        initial={animate ? { x: '-105%' } : false}
        animate={{ x: 0 }}
        transition={spring}
      />
      <motion.div
        className="show__half show__half--red"
        initial={animate ? { x: '105%' } : false}
        animate={{ x: 0 }}
        transition={spring}
      />
      <motion.div
        className="show__dual-copy"
        initial={animate ? { opacity: 0, scale: 0.92 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: animate ? 0.55 : 0, duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <div className="show__title">{title}</div>
      </motion.div>
    </div>
  )
}

export function ShowScene({
  slide,
  teams,
  animate = false,
}: {
  slide: ShowSlide
  teams: Record<TeamId, { name: string }>
  animate?: boolean
}) {
  const blue = teams.blue.name || 'Blue'
  const red = teams.red.name || 'Red'

  switch (slide.beat) {
    case 'ref':
      // Near-black frame with subtle moving stripes peeking from the bottom-left;
      // a black gradient swallows the rest. Just the name — big, bold, white, with
      // a soft billowy shadow — under a quiet label. No plate, no chrome.
      return (
        <div className="show show--ref">
          <div className="show__stripes" aria-hidden />
          <div className="show__ref-fade" aria-hidden />
          <div className="show__ref-copy">
            <div className="show__eyebrow show__eyebrow--ref">Please welcome your referee</div>
            {slide.name && <div className="show__name show__name--ref">{slide.name}</div>}
          </div>
        </div>
      )
    case 'players':
      return <DualCard title="Welcome your players!" animate={animate} />
    case 'captains':
      return <DualCard title="Team captains" animate={animate} />
    case 'team-blue':
      return <TeamCard side="blue" eyebrow="Welcome" title={blue} roster={rosterLines(slide.roster)} />
    case 'team-red':
      return <TeamCard side="red" eyebrow="Welcome" title={red} roster={rosterLines(slide.roster)} />
    case 'captain-blue':
      return <TeamCard side="blue" eyebrow={`${blue} captain`} title={slide.name || 'Captain'} />
    case 'captain-red':
      return <TeamCard side="red" eyebrow={`${red} captain`} title={slide.name || 'Captain'} />
    case 'blackout':
    default:
      return <div className="show show--blackout" />
  }
}
