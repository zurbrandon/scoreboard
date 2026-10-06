// The scoreboard scene. Fixed layout for v1 (PRD). Panels are ordered by SIDE,
// which is derived from the half — so teams visually swap at halftime while
// their scores stay with them. Reveal animations (count-up, winner grow,
// confetti) are driven off revealPhase / revealNonce; the store holds truth.

import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useAppState } from '../../store/react'
import { determineWinner } from '../../core/winner'
import {
  AUDIENCE_FIT_CHARS,
  FINALE_FIT_CHARS,
  FINALE_TIE_FIT_CHARS,
  PANEL_FIT_CHARS,
  formatScore,
  scoreScale,
} from '../../core/score'
import { sideOf, teamOnSide, type Side } from '../../core/sides'
import type { TeamId } from '../../core/state'
import { logoSrc } from './LogoScene'
import { useAnimatedNumber } from '../useAnimatedNumber'
import { Confetti } from '../Confetti'
import { EmojiRain } from '../EmojiRain'
import { SKINS } from '../themes'

const HALF_LABEL = { first: '1st Half', second: '2nd Half', end: 'Final' } as const

const CONFETTI_COLORS: Record<'blue' | 'red' | 'tie', string[]> = {
  blue: ['#2f6bff', '#8fb0ff', '#ffffff'],
  red: ['#e23b3b', '#ff9a9a', '#ffffff'],
  tie: ['#ffd23f', '#ffffff', '#8fb0ff', '#ff9a9a'],
}

export function Scoreboard() {
  const half = useAppState((s) => s.halfLive)
  const audienceVisible = useAppState((s) => s.audienceLive.visible)
  const ribbons = useAppState((s) => s.ribbonsLive)
  const winner = useAppState((s) => s.lastWinner)
  const revealNonce = useAppState((s) => s.revealNonce)
  const revealPhase = useAppState((s) => s.revealPhase)
  const finaleStage = useAppState((s) => s.finaleStage)
  const countdown = useAppState((s) => s.countdown)
  const logos = useAppState((s) => s.scoreboardLogos) ?? { left: 'logos/comedysportz.png', right: 'logos/seattle-comedy-theater.png' }

  const leftTeam = teamOnSide('left', half)
  const rightTeam = teamOnSide('right', half)

  // Confetti bursts from the winner's side; a tie bursts from the middle.
  const originX =
    winner === 'tie' || winner === null
      ? 0.5
      : sideOf(winner, half) === 'left'
        ? 0.25
        : 0.75
  // A theme may recolour the burst and mix its own emoji in; the plain board's
  // palette is what it starts from.
  const theme = useAppState((s) => s.scoreboardTheme) ?? 'none'
  const skin = SKINS[theme] ?? SKINS.none
  const colors = useMemo(() => {
    const key = winner ?? 'tie'
    return skin.confetti?.colors?.(CONFETTI_COLORS[key], key) ?? CONFETTI_COLORS[key]
  }, [skin, winner])

  // The winning team's mood emoji (if any) rains across the screen on reveal.
  const winnerEmoji = useAppState((s) =>
    winner === 'blue' || winner === 'red' ? s.teams[winner].mood : '',
  )

  return (
    <div className={`scoreboard scoreboard--theme-${theme}`}>
      {skin.Decorations && <skin.Decorations />}
      <header className="scoreboard__top">
        <HeaderLogo src={logos.left} alt="Home logo" fallback="CSz" />
        <div className="scoreboard__half">{HALF_LABEL[half]}</div>
        <HeaderLogo
          src={logos.right}
          alt="Venue logo"
          fallback="Theater"
          extraClass="scoreboard__logo--theater"
        />
      </header>

      <div className="scoreboard__teams">
        <TeamPanel team={leftTeam} side="left" />
        <TeamPanel team={rightTeam} side="right" />
        <div className="scoreboard__vs" aria-hidden="true">
          VS
          {skin.VsAccent && <skin.VsAccent />}
        </div>
      </div>

      {audienceVisible && <AudiencePanel />}

      <footer className="scoreboard__bottom">
        {/* Ribbons follow their team across the halftime side-swap: the label +
            color are keyed to whichever team sits on that side. The empty centre
            slot is the spacer that holds them to their own edges. */}
        <span className="ribbon-slot ribbon-slot--left">
          {ribbons.visible && (
            <span className={`ribbon ribbon--${leftTeam}`}>
              {leftTeam === 'blue' ? ribbons.home : ribbons.away}
            </span>
          )}
        </span>
        <span className="ribbon-slot ribbon-slot--center" />
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
      <Confetti nonce={revealNonce} colors={colors} originX={originX} glyphs={skin.confetti?.glyphs} />
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
  const tieLine = `${formatScore(blueScore)} – ${formatScore(redScore)}`

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
            style={scoreScaleStyle(tieLine, FINALE_TIE_FIT_CHARS)}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...pop, delay: 0.12 }}
          >
            {tieLine}
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
            style={scoreScaleStyle(formatScore(winScore), FINALE_FIT_CHARS)}
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

// Shows a logo image (bundled path or uploaded data URL), falling back to text
// if it's missing/broken — so the scoreboard never breaks before art is set.
function HeaderLogo({
  src,
  alt,
  fallback,
  extraClass = '',
}: {
  src: string
  alt: string
  fallback: string
  extraClass?: string
}) {
  const [failed, setFailed] = useState(false)
  // Re-try when the logo changes (a previously-broken src shouldn't stick).
  useEffect(() => setFailed(false), [src])
  if (!src || failed) {
    return <div className={`scoreboard__logo ${extraClass}`}>{fallback}</div>
  }
  return (
    <img
      className={`scoreboard__logo-img ${extraClass}`}
      src={logoSrc(src)}
      alt={alt}
      onError={() => setFailed(true)}
    />
  )
}

// The third score — a running count that isn't either team's (the bar tab, the
// audience, a running gag). It reads as a score in its own right rather than a
// caption: same recessed LED face and pixel numerals as the team panels, run the
// full width of the stage, but at roughly half their type size and glowing a
// neutral cyan rather than a team colour, so it never competes with the match.
// Rendered only when toggled on, and as a sibling of the flex:1 teams row — so
// turning it on is what shortens the team panels, with no second place to keep
// the heights in sync.
function AudiencePanel() {
  const score = useAppState((s) => s.audienceLive.score)
  const label = useAppState((s) => s.audienceLive.label)

  // Counts up the same way the team readouts do, so a point awarded here reads
  // as the same kind of event.
  const shown = useAnimatedNumber(score)
  const scoreText = formatScore(shown)

  return (
    <section className="audience-panel" aria-label={label || 'Third score'}>
      <span className="audience-panel__label">{label}</span>
      <span className="audience-panel__score" style={scoreScaleStyle(scoreText, AUDIENCE_FIT_CHARS)}>
        {scoreText}
      </span>
    </section>
  )
}

function TeamPanel({ team, side }: { team: TeamId; side: Side }) {
  const name = useAppState((s) => s.teams[team].name)
  const liveScore = useAppState((s) => s.teams[team].liveScore)
  const mood = useAppState((s) => s.teams[team].mood)
  const revealPhase = useAppState((s) => s.revealPhase)
  const revealStyle = useAppState((s) => s.revealStyle)
  const winner = useAppState((s) => s.lastWinner)
  // Ambient highlight of the current leader (from LIVE scores, never pending).
  const leader = useAppState((s) =>
    determineWinner(s.teams.blue.liveScore, s.teams.red.liveScore),
  )

  const shownScore = useAnimatedNumber(liveScore)
  const scoreText = formatScore(shownScore)
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
        isWinner ? `team-panel--winner team-panel--winner-${revealStyle}` : '',
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
        {/* Stable element — the --pop class alone drives the reveal pop (adding
            the class restarts its CSS animation). Do NOT key this on the reveal
            phase: a key that flips at reveal start/end remounts the div and
            resets useAnimatedNumber, making the score flash on and off. */}
        <div
          className={`team-panel__score ${isWinner ? 'team-panel__score--pop' : ''}`}
          style={scoreScaleStyle(scoreText, PANEL_FIT_CHARS)}
        >
          {scoreText}
        </div>
      </div>
    </section>
  )
}

// Hands the stepped-down size to CSS as a multiplier on the readout's base font
// size (see --score-scale in styles.css), so each readout keeps its own base
// size in one place and only the step lives here.
function scoreScaleStyle(text: string, fitChars: number): CSSProperties {
  return { ['--score-scale' as string]: scoreScale(text, fitChars) } as CSSProperties
}
