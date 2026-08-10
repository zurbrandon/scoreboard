// The scoreboard scene. Fixed layout for v1 (PRD). Panels are ordered by SIDE,
// which is derived from the half — so teams visually swap at halftime while
// their scores stay with them. Reveal animations (count-up, winner grow,
// confetti) are driven off revealPhase / revealNonce; the store holds truth.

import { type CSSProperties, useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useAppState } from '../../store/react'
import { determineWinner } from '../../core/winner'
import { formatScore } from '../../core/score'
import { sideOf, teamOnSide, type Side } from '../../core/sides'
import type { TeamId } from '../../core/state'
import { useAnimatedNumber } from '../useAnimatedNumber'
import { Confetti } from '../Confetti'
import { EmojiRain } from '../EmojiRain'

const HALF_LABEL = { first: '1st Half', second: '2nd Half', end: 'Final' } as const

const CONFETTI_COLORS: Record<'blue' | 'red' | 'tie', string[]> = {
  blue: ['#2f6bff', '#8fb0ff', '#ffffff'],
  red: ['#e23b3b', '#ff9a9a', '#ffffff'],
  tie: ['#ffd23f', '#ffffff', '#8fb0ff', '#ff9a9a'],
}

export function Scoreboard() {
  const half = useAppState((s) => s.halfLive)
  const audienceScore = useAppState((s) => s.audienceLive.score)
  const audienceLabel = useAppState((s) => s.audienceLive.label)
  const audienceVisible = useAppState((s) => s.audienceLive.visible)
  const ribbons = useAppState((s) => s.ribbonsLive)
  const winner = useAppState((s) => s.lastWinner)
  const revealNonce = useAppState((s) => s.revealNonce)
  const revealPhase = useAppState((s) => s.revealPhase)
  const finaleStage = useAppState((s) => s.finaleStage)
  const countdown = useAppState((s) => s.countdown)

  const leftTeam = teamOnSide('left', half)
  const rightTeam = teamOnSide('right', half)

  // Confetti bursts from the winner's side; a tie bursts from the middle.
  const originX =
    winner === 'tie' || winner === null
      ? 0.5
      : sideOf(winner, half) === 'left'
        ? 0.25
        : 0.75
  const colors = CONFETTI_COLORS[winner ?? 'tie']

  // The winning team's mood emoji (if any) rains across the screen on reveal.
  const winnerEmoji = useAppState((s) =>
    winner === 'blue' || winner === 'red' ? s.teams[winner].mood : '',
  )

  return (
    <div className="scoreboard">
      <header className="scoreboard__top">
        <HeaderLogo file="comedysportz.png" alt="ComedySportz" fallback="CSz" />
        <div className="scoreboard__half">{HALF_LABEL[half]}</div>
        <HeaderLogo
          file="seattle-comedy-theater.png"
          alt="Seattle Comedy Theater"
          fallback="Theater"
          extraClass="scoreboard__logo--theater"
        />
      </header>

      <div className="scoreboard__teams">
        <TeamPanel team={leftTeam} side="left" />
        <TeamPanel team={rightTeam} side="right" />
        <div className="scoreboard__vs" aria-hidden="true">VS</div>
      </div>

      <footer className="scoreboard__bottom">
        {/* Ribbons follow their team across the halftime side-swap: the label +
            color are keyed to whichever team sits on that side. Fixed left/center/
            right slots keep the audience centered even when parts are hidden. */}
        <span className="ribbon-slot ribbon-slot--left">
          {ribbons.visible && (
            <span className={`ribbon ribbon--${leftTeam}`}>
              {leftTeam === 'blue' ? ribbons.home : ribbons.away}
            </span>
          )}
        </span>
        <span className="ribbon-slot ribbon-slot--center">
          {audienceVisible && (
            <span className="audience">
              {audienceLabel} · {audienceScore}
            </span>
          )}
        </span>
        <span className="ribbon-slot ribbon-slot--right">
          {ribbons.visible && (
            <span className={`ribbon ribbon--${rightTeam}`}>
              {rightTeam === 'blue' ? ribbons.home : ribbons.away}
            </span>
          )}
        </span>
      </footer>

      {revealPhase === 'finale' && finaleStage === 'tabulating' && <FinaleTabulating />}
      {revealPhase === 'finale' && finaleStage === 'countdown' && <FinaleCountdown value={countdown} />}
      {revealPhase === 'finale' && finaleStage === 'celebrate' && <FinaleOverlay />}
      <Confetti nonce={revealNonce} colors={colors} originX={originX} />
      <EmojiRain nonce={revealNonce} emoji={winnerEmoji} />
    </div>
  )
}

// The "Show end" finale: a full-screen winner takeover. First pass — a bigger
// celebration than a normal reveal; confetti and the emoji rain play over it.
function FinaleOverlay() {
  const winner = useAppState((s) => s.lastWinner)
  const blueName = useAppState((s) => s.teams.blue.name)
  const blueScore = useAppState((s) => s.teams.blue.liveScore)
  const redName = useAppState((s) => s.teams.red.name)
  const redScore = useAppState((s) => s.teams.red.liveScore)

  const color = winner === 'blue' ? '#2f6bff' : winner === 'red' ? '#e23b3b' : '#ffd23f'
  const winName = winner === 'blue' ? blueName : winner === 'red' ? redName : ''
  const winScore = winner === 'blue' ? blueScore : redScore

  const pop = { type: 'spring', stiffness: 300, damping: 15, mass: 0.8 } as const
  const rise = { type: 'spring', stiffness: 260, damping: 20 } as const
  return (
    <motion.div
      className="finale"
      style={{ ['--win' as string]: color } as CSSProperties}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {winner === 'tie' ? (
        <>
          <motion.div
            className="finale__label"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={rise}
          >
            It's a tie
          </motion.div>
          <motion.div
            className="finale__score"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...pop, delay: 0.12 }}
          >
            {formatScore(blueScore)} – {formatScore(redScore)}
          </motion.div>
        </>
      ) : (
        <>
          <motion.div
            className="finale__label"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={rise}
          >
            Winner
          </motion.div>
          <motion.div
            className="finale__name"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...pop, delay: 0.08 }}
          >
            {winName}
          </motion.div>
          <motion.div
            className="finale__score"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...pop, delay: 0.2 }}
          >
            {formatScore(winScore)}
          </motion.div>
        </>
      )}
    </motion.div>
  )
}

// Step 1 of the Final-score sequence: the drum-roll build. Scrambling numbers
// sell the "computing right now" feel while the tension mounts.
function FinaleTabulating() {
  const [a, setA] = useState(0)
  const [b, setB] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setA(Math.floor(Math.random() * 100))
      setB(Math.floor(Math.random() * 100))
    }, 80)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="finale-tab">
      <div className="finale-tab__label">Tabulating final score</div>
      <div className="finale-tab__nums" aria-hidden="true">
        <span className="finale-tab__num finale-tab__num--blue">{a}</span>
        <span className="finale-tab__vs">VS</span>
        <span className="finale-tab__num finale-tab__num--red">{b}</span>
      </div>
      <div className="finale-tab__dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </div>
  )
}

// Step 2: the 3 · 2 · 1 countdown. Keying on the value remounts the number so
// its spring pop replays on each tick.
function FinaleCountdown({ value }: { value: number }) {
  return (
    <div className="finale-count">
      <motion.div
        key={value}
        className="finale-count__num"
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 13, mass: 0.7 }}
      >
        {value}
      </motion.div>
    </div>
  )
}

// Shows a logo image from public/logos/, falling back to text if the file
// isn't there yet — so the scoreboard never breaks before the art is dropped in.
function HeaderLogo({
  file,
  alt,
  fallback,
  extraClass = '',
}: {
  file: string
  alt: string
  fallback: string
  extraClass?: string
}) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <div className={`scoreboard__logo ${extraClass}`}>{fallback}</div>
  }
  return (
    <img
      className={`scoreboard__logo-img ${extraClass}`}
      src={`${import.meta.env.BASE_URL}logos/${file}`}
      alt={alt}
      onError={() => setFailed(true)}
    />
  )
}

function TeamPanel({ team, side }: { team: TeamId; side: Side }) {
  const name = useAppState((s) => s.teams[team].name)
  const liveScore = useAppState((s) => s.teams[team].liveScore)
  const mood = useAppState((s) => s.teams[team].mood)
  const revealPhase = useAppState((s) => s.revealPhase)
  const winner = useAppState((s) => s.lastWinner)
  // Ambient highlight of the current leader (from LIVE scores, never pending).
  const leader = useAppState((s) =>
    determineWinner(s.teams.blue.liveScore, s.teams.red.liveScore),
  )

  const shownScore = useAnimatedNumber(liveScore)
  const isLeading = leader === team
  // Transient emphasis during the reveal sequence only.
  const revealing = revealPhase === 'revealing'
  const isWinner = revealing && winner === team
  const isLoser = revealing && winner !== 'tie' && winner !== null && winner !== team

  return (
    <section
      className={[
        'team-panel',
        `team-panel--${team}`,
        isLeading ? 'team-panel--leading' : '',
        isWinner ? 'team-panel--winner' : '',
        isLoser ? 'team-panel--dimmed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-side={side}
    >
      <div className="team-panel__banner">
        <span className="team-panel__name">{name}</span>
        {mood && <span className="team-panel__mood">{mood}</span>}
      </div>
      <div className="led-screen">
        {/* key on the phase so the pop animation restarts on each reveal */}
        <div
          className={`team-panel__score ${isWinner ? 'team-panel__score--pop' : ''}`}
          key={isWinner ? `pop-${winner}` : 'rest'}
        >
          {formatScore(shownScore)}
        </div>
      </div>
    </section>
  )
}
