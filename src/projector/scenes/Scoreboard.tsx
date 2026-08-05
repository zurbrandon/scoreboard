// The scoreboard scene. Fixed layout for v1 (PRD). Panels are ordered by SIDE,
// which is derived from the half — so teams visually swap at halftime while
// their scores stay with them. Reveal animations (count-up, winner grow,
// confetti) are driven off revealPhase / revealNonce; the store holds truth.

import { useState } from 'react'
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

      {revealPhase === 'finale' && <FinaleOverlay />}
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

  return (
    <div className="finale" style={{ ['--win' as string]: color }}>
      {winner === 'tie' ? (
        <>
          <div className="finale__label">It's a tie</div>
          <div className="finale__score">
            {formatScore(blueScore)} – {formatScore(redScore)}
          </div>
        </>
      ) : (
        <>
          <div className="finale__label">Winner</div>
          <div className="finale__name">{winName}</div>
          <div className="finale__score">{formatScore(winScore)}</div>
        </>
      )}
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
