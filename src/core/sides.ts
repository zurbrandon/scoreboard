import type { Half, TeamId } from './state'

export type Side = 'left' | 'right'

// A team's score follows the TEAM; only its on-screen position follows the HALF.
// 1st half: Blue left / Red right. 2nd half: they swap. This is presentation
// only — commands stay team-based (blue.increment always adds to Blue).
export function sideOf(team: TeamId, half: Half): Side {
  const blueOnLeft = half === 'first'
  if (team === 'blue') return blueOnLeft ? 'left' : 'right'
  return blueOnLeft ? 'right' : 'left'
}

// Which team occupies a given side this half — handy for rendering left→right.
export function teamOnSide(side: Side, half: Half): TeamId {
  return sideOf('blue', half) === side ? 'blue' : 'red'
}
