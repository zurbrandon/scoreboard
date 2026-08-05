// Scores can be decimals (e.g. 3.5 — comedy judges do funny things). Display
// them cleanly: trim floating-point dust and show at most two decimals, with no
// trailing zeros. 4 -> "4", 3.5 -> "3.5", 5.500000001 -> "5.5".
export function formatScore(n: number): string {
  return String(Math.round(n * 100) / 100)
}
