// The scripted show-intro beats: full-screen themed cards the operator flips
// through to open a match (welcome the ref, the players, each team, the captains,
// or settle the room to black). Team beats pull the live team names so "the Blue
// team" reads as whatever the teams are actually called.
//
// Animation follows the projector rule: transform/opacity only, never per-frame
// blur — the ref stripes are one wide striped element sliding on translateX.

import { useLayoutEffect, useRef } from 'react'
import { motion } from 'motion/react'
import type { ShowSlide, TeamId } from '../../core/state'
import { logoSrc } from './LogoScene'
import { CenterConfetti } from './CenterConfetti'

function rosterLines(roster: string): string[] {
  return roster
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

// Auto-fit the roster names: shrink the whole grid's font (uniformly, so every
// tile matches) until no name overflows its equal-width tile — names then wrap
// only at spaces (first / last on two lines) and never break mid-word, at any
// projector size or name length. Re-runs when the names or the grid width change.
// Measures scrollWidth/clientWidth, which ignore the entrance scale transform.
function useFitRoster(rosterKey: string) {
  const ref = useRef<HTMLUListElement>(null)
  useLayoutEffect(() => {
    const ul = ref.current
    if (!ul) return
    let lastWidth = -1
    const fit = () => {
      // Skip re-runs triggered by our own height changes (width is what matters).
      if (ul.clientWidth === lastWidth) return
      lastWidth = ul.clientWidth
      const items = Array.from(ul.children) as HTMLElement[]
      if (!items.length) return
      const max = window.innerWidth * 0.03 // the 3vw design size…
      const min = window.innerWidth * 0.012 // …shrinking no further than 1.2vw
      let size = max
      const apply = (px: number) => items.forEach((el) => (el.style.fontSize = `${px}px`))
      apply(size)
      let guard = 0
      while (size > min && items.some((el) => el.scrollWidth > el.clientWidth + 0.5) && guard++ < 80) {
        size = Math.max(min, size - 1)
        apply(size)
      }
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(ul)
    return () => ro.disconnect()
  }, [rosterKey])
  return ref
}

// A bright gold bar that wipes in under the title — the broadcast "accent rule".
function AccentBar({ animate, delay = 0.28 }: { animate: boolean; delay?: number }) {
  return (
    <motion.div
      className="show__accent"
      aria-hidden
      initial={animate ? { scaleX: 0, opacity: 0 } : false}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ delay: animate ? delay : 0, type: 'spring', stiffness: 360, damping: 26 }}
    />
  )
}

// A single diagonal light sweep across the whole card on reveal — the glossy
// "shine" pass sports graphics do. Purely decorative; only plays on a reveal.
function SheenSweep({ animate, delay = 0.12, reverse = false }: { animate: boolean; delay?: number; reverse?: boolean }) {
  if (!animate) return null
  return (
    <motion.div
      className="show__sheen"
      aria-hidden
      initial={{ x: reverse ? '130%' : '-130%' }}
      animate={{ x: reverse ? '-130%' : '130%' }}
      transition={{ delay, duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
    />
  )
}

// A team welcome / captain card: solid team color, an eyebrow label, the team
// name, and either a roster (2×2 grid) or a single captain name. On reveal the
// title slams in bold, then each player pops in separately, one after another.
function TeamCard({
  side,
  eyebrow,
  title,
  roster,
  name,
  animate,
}: {
  side: TeamId
  eyebrow: string
  title: string
  roster?: string[]
  name?: string
  animate: boolean
}) {
  const slam = { type: 'spring' as const, stiffness: 520, damping: 16, mass: 0.9 }
  const rosterRef = useFitRoster((roster ?? []).join('\n'))
  return (
    <div className={`show show--team show--${side}`}>
      <div className="show__stars" aria-hidden>
        <div className="show__stars-grid" />
      </div>
      <SheenSweep animate={animate} delay={0.18} />
      <motion.div
        className="show__eyebrow"
        initial={animate ? { opacity: 0, y: '-45%' } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {eyebrow}
      </motion.div>
      <motion.div
        className="show__title"
        initial={animate ? { opacity: 0, scale: 1.4 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...slam, delay: animate ? 0.08 : 0 }}
      >
        {title}
      </motion.div>
      <AccentBar animate={animate} delay={0.3} />
      {roster && roster.length > 0 && (
        <ul className="show__roster" ref={rosterRef}>
          {roster.map((n, i) => (
            <motion.li
              key={i}
              className="show__roster-item"
              initial={animate ? { opacity: 0, scale: 0.5, y: '30%' } : false}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 480, damping: 20, delay: animate ? 0.45 + i * 0.13 : 0 }}
            >
              {n}
            </motion.li>
          ))}
        </ul>
      )}
      {name && (
        <motion.div
          className="show__name"
          initial={animate ? { opacity: 0, scale: 1.3 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...slam, delay: animate ? 0.12 : 0 }}
        >
          {name}
        </motion.div>
      )}
    </div>
  )
}

// A dual split card (players / captains): a diagonal seam with blue on one side,
// red on the other. On reveal, blue rushes in from the left and red from the
// right; they meet on the seam, then the title appears. Just the title — no
// eyebrow. (Silent update: everything sits at its final spot, no entrance.)
function DualCard({ title, animate }: { title: string; animate: boolean }) {
  // Snappy, underdamped spring: the halves slam together fast and bounce back off
  // each other before settling on the seam.
  const slam = { type: 'spring' as const, stiffness: 340, damping: 15, mass: 1.1 }
  return (
    <div className="show show--dual">
      <motion.div
        className="show__half show__half--blue"
        initial={animate ? { x: '-105%' } : false}
        animate={{ x: 0 }}
        transition={slam}
      />
      <motion.div
        className="show__half show__half--red"
        initial={animate ? { x: '105%' } : false}
        animate={{ x: 0 }}
        transition={slam}
      />
      <SheenSweep animate={animate} delay={0.4} />
      <motion.div
        className="show__dual-copy"
        // Jarring pop: the title punches in oversized right as the halves collide,
        // then springs down to size with a hard little overshoot.
        initial={animate ? { opacity: 0, scale: 1.55 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          delay: animate ? 0.34 : 0,
          opacity: { delay: animate ? 0.34 : 0, duration: 0.08 },
          type: 'spring',
          stiffness: 620,
          damping: 14,
          mass: 0.9,
        }}
      >
        <div className="show__title">{title}</div>
        <AccentBar animate={animate} delay={0.5} />
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
      // On reveal the label drops in from the top and skids to a stop (a springy
      // overshoot), then the name rises up from the bottom.
      return (
        <div className="show show--ref">
          <div className="show__stripes" aria-hidden />
          <div className="show__ref-fade" aria-hidden />
          <SheenSweep animate={animate} delay={0.35} />
          <div className="show__ref-copy">
            <motion.div
              className="show__eyebrow show__eyebrow--ref"
              initial={animate ? { opacity: 0, y: -220 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 19, mass: 1 }}
            >
              Please welcome your referee
            </motion.div>
            {slide.name && (
              <motion.div
                className="show__name show__name--ref"
                initial={animate ? { opacity: 0, y: 220 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22, delay: animate ? 0.45 : 0 }}
              >
                {slide.name}
              </motion.div>
            )}
            <AccentBar animate={animate} delay={0.7} />
          </div>
        </div>
      )
    case 'logo':
      // The brand card: black + drifting stars, then the ComedySportz logo pops
      // in big after a couple of seconds, followed by a couple of sheen passes.
      return (
        <div className="show show--logo">
          <div className="show__stars" aria-hidden>
            <div className="show__stars-grid" />
          </div>
          {/* Logo lands (~1.6s), holds a couple seconds, then the burst pops out
              from behind it on all sides. */}
          <CenterConfetti animate={animate} delayMs={4000} />
          <motion.img
            className="show__logo-img"
            src={logoSrc('logos/comedysportz.png')}
            alt=""
            initial={animate ? { opacity: 0, scale: 0.2 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: animate ? 1.6 : 0, type: 'spring', stiffness: 240, damping: 13, mass: 1.2 }}
          />
          <SheenSweep animate={animate} delay={2.7} />
          <SheenSweep animate={animate} delay={3.25} reverse />
        </div>
      )
    case 'players':
      return <DualCard title="Welcome your players!" animate={animate} />
    case 'captains':
      return <DualCard title="Team captains" animate={animate} />
    case 'team-blue':
      return <TeamCard side="blue" eyebrow="Welcome" title={blue} roster={rosterLines(slide.roster)} animate={animate} />
    case 'team-red':
      return <TeamCard side="red" eyebrow="Welcome" title={red} roster={rosterLines(slide.roster)} animate={animate} />
    // Generic captain (deck quick button): team name big under a plain "Captain"
    // eyebrow — no scripted person's name. Scripted captain slides keep the
    // named treatment: the person's name big under a "{team} captain" eyebrow.
    case 'captain-blue':
      return slide.generic ? (
        <TeamCard side="blue" eyebrow="Captain" title={blue} animate={animate} />
      ) : (
        <TeamCard side="blue" eyebrow={`${blue} captain`} title={slide.name || 'Captain'} animate={animate} />
      )
    case 'captain-red':
      return slide.generic ? (
        <TeamCard side="red" eyebrow="Captain" title={red} animate={animate} />
      ) : (
        <TeamCard side="red" eyebrow={`${red} captain`} title={slide.name || 'Captain'} animate={animate} />
      )
    case 'blackout':
    default:
      return <div className="show show--blackout" />
  }
}
