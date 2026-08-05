import type { Winner } from './state'

// Winner detection is automatic and lives here, never in a component or in the
// operator's head (PRD: "The operator should never manually choose the winner").
export function determineWinner(blueScore: number, redScore: number): Winner {
  if (blueScore > redScore) return 'blue'
  if (redScore > blueScore) return 'red'
  return 'tie'
}
