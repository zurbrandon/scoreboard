import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import { reduce } from './reduce'
import { determineWinner } from './winner'
import { sideOf, teamOnSide } from './sides'
import { pickBumper } from './bumper'
import type { Command } from './commands'

// Small helper: run a list of commands from the initial state.
function run(...commands: Command[]) {
  return commands.reduce(reduce, createInitialState())
}

describe('pending vs live (the sacred rule)', () => {
  it('score edits touch pending only, never live', () => {
    const s = run({ type: 'blue.increment' }, { type: 'blue.increment' })
    expect(s.teams.blue.pendingScore).toBe(2)
    expect(s.teams.blue.liveScore).toBe(0)
  })

  it('reveal copies pending to live for both teams atomically', () => {
    const s = run(
      { type: 'blue.increment' },
      { type: 'blue.increment' },
      { type: 'red.increment' },
      { type: 'score.reveal' },
    )
    expect(s.teams.blue.liveScore).toBe(2)
    expect(s.teams.red.liveScore).toBe(1)
    expect(s.lastWinner).toBe('blue')
  })

  it('commitSilent pushes pending to live without triggering a reveal', () => {
    const s = run(
      { type: 'blue.increment' },
      { type: 'blue.increment' },
      { type: 'red.increment' },
      { type: 'score.commitSilent' },
    )
    expect(s.teams.blue.liveScore).toBe(2)
    expect(s.teams.red.liveScore).toBe(1)
    expect(s.lastWinner).toBe('blue')
    // The tell-tale: no reveal ceremony fired.
    expect(s.revealPhase).toBe('idle')
    expect(s.revealNonce).toBe(0)
  })

  it('revertPending discards pending edits back to live', () => {
    const s = run(
      { type: 'blue.increment' },
      { type: 'score.reveal' }, // live = 1
      { type: 'blue.increment' }, // pending = 2, live still 1
      { type: 'score.revertPending' },
    )
    expect(s.teams.blue.pendingScore).toBe(1)
    expect(s.teams.blue.liveScore).toBe(1)
  })
})

describe('reveal sequence flags', () => {
  it('reveal enters the revealing phase and bumps the nonce', () => {
    const s = run({ type: 'blue.increment' }, { type: 'score.reveal' })
    expect(s.revealPhase).toBe('revealing')
    expect(s.revealNonce).toBe(1)
  })

  it('reveal.finish returns to idle without touching scores', () => {
    const s = run(
      { type: 'blue.increment' },
      { type: 'score.reveal' },
      { type: 'reveal.finish' },
    )
    expect(s.revealPhase).toBe('idle')
    expect(s.teams.blue.liveScore).toBe(1)
    expect(s.revealNonce).toBe(1)
  })

  it('each reveal bumps the nonce so effects can re-trigger', () => {
    const s = run({ type: 'score.reveal' }, { type: 'score.reveal' })
    expect(s.revealNonce).toBe(2)
  })
})

describe('scoring details', () => {
  it('setScore sets an exact pending value', () => {
    const s = run({ type: 'team.setScore', team: 'red', value: 42 })
    expect(s.teams.red.pendingScore).toBe(42)
  })

  it('allows negative scores (no clamping)', () => {
    const s = run(
      { type: 'blue.decrement' },
      { type: 'blue.decrement' },
      { type: 'blue.decrement' },
    )
    expect(s.teams.blue.pendingScore).toBe(-3)
  })

  it('audience score updates immediately (no reveal)', () => {
    const s = run({ type: 'audience.increment' }, { type: 'audience.increment' })
    expect(s.audience.score).toBe(2)
  })

  it('audience label and visibility are editable', () => {
    const s = run(
      { type: 'audience.setLabel', label: 'Ref' },
      { type: 'audience.setVisible', visible: false },
    )
    expect(s.audience.label).toBe('Ref')
    expect(s.audience.visible).toBe(false)
  })

  it('logo select stages a draft; commit makes it live', () => {
    const s = run({ type: 'logo.select', id: 'theater' })
    expect(s.logo.draftId).toBe('theater')
    expect(s.logo.liveId).not.toBe('theater') // still the default until committed
    const s2 = reduce(s, { type: 'logo.commit' })
    expect(s2.logo.liveId).toBe('theater')
  })

  it('text draft stages; commit makes it live', () => {
    const s = run({ type: 'text.setDraft', value: 'Next up: The Improvisors' })
    expect(s.text.draft).toBe('Next up: The Improvisors')
    expect(s.text.live).toBe('') // not shown until committed
    const s2 = reduce(s, { type: 'text.commit' })
    expect(s2.text.live).toBe('Next up: The Improvisors')
  })

  it('stores the slideshow URL', () => {
    const url = 'https://docs.google.com/presentation/d/e/abc/embed?start=true&loop=true'
    const s = run({ type: 'slideshow.setUrl', url })
    expect(s.slideshowUrl).toBe(url)
  })
})

describe('winner detection', () => {
  it('picks the higher score, or tie', () => {
    expect(determineWinner(5, 3)).toBe('blue')
    expect(determineWinner(3, 5)).toBe('red')
    expect(determineWinner(4, 4)).toBe('tie')
  })
})

describe('half swaps sides but not scores', () => {
  it('blue starts left, red right in the first half', () => {
    expect(sideOf('blue', 'first')).toBe('left')
    expect(sideOf('red', 'first')).toBe('right')
    expect(teamOnSide('left', 'first')).toBe('blue')
  })

  it('teams swap sides in the second half', () => {
    expect(sideOf('blue', 'second')).toBe('right')
    expect(sideOf('red', 'second')).toBe('left')
    expect(teamOnSide('left', 'second')).toBe('red')
  })

  it('the end phase keeps the first-half sides', () => {
    expect(sideOf('blue', 'end')).toBe('left')
    expect(sideOf('red', 'end')).toBe('right')
  })

  it('reveal at the end phase becomes the finale', () => {
    const s = run({ type: 'half.set', half: 'end' }, { type: 'score.reveal' })
    expect(s.revealPhase).toBe('finale')
    const normal = run({ type: 'score.reveal' })
    expect(normal.revealPhase).toBe('revealing')
  })

  it('toggling the half keeps each team score intact', () => {
    const s = run(
      { type: 'blue.increment' },
      { type: 'score.reveal' },
      { type: 'half.toggle' },
    )
    expect(s.half).toBe('second')
    expect(s.teams.blue.liveScore).toBe(1) // score followed the team, not the side
  })
})

describe('bumper selection', () => {
  const tracks = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
  ]

  it('returns null when there are no tracks', () => {
    expect(pickBumper([], null, () => 0)).toBeNull()
  })

  it('always returns the only track when there is one', () => {
    const one = [{ id: 'a', name: 'A' }]
    expect(pickBumper(one, 'a', () => 0.99)?.id).toBe('a')
  })

  it('never immediately repeats the last track', () => {
    // rand=0 would normally pick index 0 ('a'); with lastTrackId 'a' it must skip it.
    const picked = pickBumper(tracks, 'a', () => 0)
    expect(picked?.id).not.toBe('a')
  })

  it('can pick any non-repeat track across the random range', () => {
    const ids = new Set<string>()
    for (const r of [0, 0.5, 0.99]) ids.add(pickBumper(tracks, 'a', () => r)!.id)
    expect(ids.has('a')).toBe(false)
    expect(ids.size).toBeGreaterThan(1) // b and c both reachable
  })

  it('records the played track so the next pick avoids it', () => {
    const s = run({ type: 'music.trackPlayed', id: 'b', name: 'B' })
    expect(s.music.lastTrackId).toBe('b')
    expect(s.music.lastTrackName).toBe('B')
  })
})

describe('robustness', () => {
  it('ignores an unrecognized command instead of returning undefined', () => {
    const before = createInitialState()
    // Simulates a newer renderer sending a command an older reducer never saw.
    const after = reduce(before, { type: 'something.unknown' } as unknown as Command)
    expect(after).toBe(before) // unchanged, never undefined
  })
})

describe('board staging: half + audience only go live on publish', () => {
  it('half.set stages; halfLive changes only on reveal', () => {
    const s = run({ type: 'half.set', half: 'second' })
    expect(s.half).toBe('second')
    expect(s.halfLive).toBe('first') // not published yet
    const r = reduce(s, { type: 'score.reveal' })
    expect(r.halfLive).toBe('second')
  })

  it('audience edits stage; audienceLive changes only on publish', () => {
    const s = run(
      { type: 'audience.setVisible', visible: false },
      { type: 'audience.increment' },
    )
    expect(s.audience.visible).toBe(false)
    expect(s.audienceLive.visible).toBe(true) // still what's on the board
    expect(s.audienceLive.score).toBe(0)
    const c = reduce(s, { type: 'score.commitSilent' })
    expect(c.audienceLive.visible).toBe(false)
    expect(c.audienceLive.score).toBe(1)
  })

  it('revertPending pulls half and audience back to live', () => {
    const s = run(
      { type: 'half.set', half: 'second' },
      { type: 'audience.setLabel', label: 'Ref' },
      { type: 'score.revertPending' },
    )
    expect(s.half).toBe('first')
    expect(s.audience.label).toBe('Audience')
  })
})

describe('state stays serializable', () => {
  it('survives a JSON round-trip', () => {
    const s = run({ type: 'blue.increment' }, { type: 'display.set', scene: 'black' })
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })
})
