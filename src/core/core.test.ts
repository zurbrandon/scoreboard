import { describe, expect, it } from 'vitest'
import { createInitialState } from './state'
import type { AppState, LogoSlide, TextSlide } from './state'
import { reduce } from './reduce'
import { determineWinner } from './winner'
import { sideOf, teamOnSide } from './sides'
import { pickBumper } from './bumper'
import { formatScore } from './score'
import type { Command } from './commands'

// Small helper: run a list of commands from the initial state.
function run(...commands: Command[]) {
  return commands.reduce(reduce, createInitialState())
}

// Narrowing helpers for the Slides deck (union of logo | text slides).
function textSlide(s: AppState, id: string): TextSlide {
  const slide = s.slides.items.find((i) => i.id === id)
  if (slide?.type !== 'text') throw new Error(`${id} is not a text slide`)
  return slide
}
function logoSlideOf(s: AppState, id: string): LogoSlide {
  const slide = s.slides.items.find((i) => i.id === id)
  if (slide?.type !== 'logo') throw new Error(`${id} is not a logo slide`)
  return slide
}
const hasId = (s: AppState, id: string) => s.slides.items.some((i) => i.id === id)

describe('pending vs live (the sacred rule)', () => {
  it('score edits touch pending only, never live', () => {
    const s = run({ type: 'blue.increment' }, { type: 'blue.increment' })
    expect(s.teams.blue.pendingScore).toBe(2)
    expect(s.teams.blue.liveScore).toBe(0)
  })

  it('decimal scores stay decimal, and +1 keeps the fraction', () => {
    // Type 3.5, then step up twice: 3.5 -> 4.5 -> 5.5.
    let s = run({ type: 'team.setScore', team: 'blue', value: 3.5 })
    expect(s.teams.blue.pendingScore).toBe(3.5)
    s = reduce(s, { type: 'blue.increment' })
    s = reduce(s, { type: 'blue.increment' })
    expect(s.teams.blue.pendingScore).toBe(5.5)
    // Reveal carries the decimal through to live, and it wins the comparison.
    const revealed = reduce(reduce(s, { type: 'team.setScore', team: 'red', value: 5 }), {
      type: 'score.reveal',
    })
    expect(revealed.teams.blue.liveScore).toBe(5.5)
    expect(revealed.lastWinner).toBe('blue')
  })

  it('bumpScore steps pending by any amount (±1, ±10) and stays on pending', () => {
    let s = run({ type: 'team.bumpScore', team: 'blue', delta: 10 })
    s = reduce(s, { type: 'team.bumpScore', team: 'blue', delta: 10 })
    s = reduce(s, { type: 'team.bumpScore', team: 'blue', delta: -1 })
    expect(s.teams.blue.pendingScore).toBe(19)
    expect(s.teams.blue.liveScore).toBe(0) // still just pending
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

  it('reveal records the chosen celebration style (defaults to pop)', () => {
    expect(run({ type: 'score.reveal', style: 'bounce' }).revealStyle).toBe('bounce')
    expect(run({ type: 'score.reveal' }).revealStyle).toBe('pop') // default when omitted
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

  it('stop ends a normal reveal to idle and bumps the stop nonce', () => {
    const s = run(
      { type: 'blue.increment' },
      { type: 'score.reveal' },
      { type: 'reveal.stop' },
    )
    expect(s.revealPhase).toBe('idle')
    expect(s.revealSettled).toBe(false)
    expect(s.stopNonce).toBe(1)
    expect(s.teams.blue.liveScore).toBe(1) // scores untouched
    expect(s.revealNonce).toBe(1) // no fresh confetti/bumper fired
  })

  it('stop freezes a finale on the winner takeover (settled)', () => {
    const s = run(
      { type: 'blue.increment' },
      { type: 'half.set', half: 'end' },
      { type: 'score.reveal' }, // finale → tabulating
      { type: 'reveal.stop' },
    )
    expect(s.revealPhase).toBe('finale')
    expect(s.finaleStage).toBe('celebrate') // held on the winner frame
    expect(s.revealSettled).toBe(true)
    expect(s.stopNonce).toBe(1)
    expect(s.revealNonce).toBe(0) // frozen frame, no new celebration burst
  })

  it('music duck: nudges clamp to 0..1, and any reveal snaps it back to full', () => {
    let s = run(
      { type: 'music.nudgeDuck', delta: -0.3 },
      { type: 'music.nudgeDuck', delta: -0.3 },
    )
    expect(s.music.duck).toBeCloseTo(0.4)
    s = reduce(s, { type: 'music.nudgeDuck', delta: -1 }) // clamps at 0
    expect(s.music.duck).toBe(0)
    s = reduce(s, { type: 'score.reveal' }) // revealing something else un-ducks
    expect(s.music.duck).toBe(1)
    // clamps at the top too
    s = reduce(s, { type: 'music.nudgeDuck', delta: +0.5 })
    expect(s.music.duck).toBe(1)
  })

  it('moment.play switches to the moment scene, stores the visual, and bumps the nonce', () => {
    const s = run(
      { type: 'moment.play', kind: 'out', visual: { type: 'text', phrase: 'BYEEEEEE' } },
      { type: 'moment.play', kind: 'in', visual: { type: 'image', src: 'x.gif' } },
    )
    expect(s.scene).toBe('moment')
    expect(s.moment).toEqual({ kind: 'in', visual: { type: 'image', src: 'x.gif' } })
    expect(s.momentNonce).toBe(2) // bumps each trigger so a repeat replays
  })

  it('a fresh reveal clears the settled flag', () => {
    const s = run(
      { type: 'half.set', half: 'end' },
      { type: 'score.reveal' },
      { type: 'reveal.stop' }, // settled = true
      { type: 'half.set', half: 'first' },
      { type: 'score.reveal' }, // new normal reveal
    )
    expect(s.revealSettled).toBe(false)
    expect(s.revealPhase).toBe('revealing')
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

  it('display.reveal flags an animated entrance and bumps the nonce; display.set does not', () => {
    const revealed = run({ type: 'display.reveal', scene: 'slides' })
    expect(revealed.scene).toBe('slides')
    expect(revealed.displayWasReveal).toBe(true)
    expect(revealed.revealAnimNonce).toBe(1)
    // A subsequent silent switch clears the flag and leaves the nonce alone.
    const silent = reduce(revealed, { type: 'display.set', scene: 'black' })
    expect(silent.displayWasReveal).toBe(false)
    expect(silent.revealAnimNonce).toBe(1)
  })

  it('slide select stages a draft; commit publishes it to live', () => {
    const s = run({ type: 'slide.select', id: 'theater' })
    expect(s.slides.selectedId).toBe('theater')
    expect(s.slides.live).toBeNull() // nothing live until committed
    const s2 = reduce(s, { type: 'slide.commit' })
    expect(s2.slides.live?.id).toBe('theater')
  })

  it('slides deck: add logo (auto-selects), edit website, remove (selection stays valid)', () => {
    let s = run({ type: 'slide.addLogo', id: 'up1', name: 'Sponsor', src: 'data:image/png;base64,AA' })
    expect(hasId(s, 'up1')).toBe(true)
    expect(s.slides.selectedId).toBe('up1') // adding selects it

    s = reduce(s, { type: 'slide.setWebsite', id: 'up1', website: 'sponsor.com' })
    expect(logoSlideOf(s, 'up1').website).toBe('sponsor.com')

    s = reduce(s, { type: 'slide.remove', id: 'up1' })
    expect(hasId(s, 'up1')).toBe(false)
    expect(hasId(s, s.slides.selectedId)).toBe(true) // selection still points at a real slide
  })

  it('slide.reorder rebuilds the deck order without dropping or reselecting', () => {
    let s = run(
      { type: 'slide.addLogo', id: 'x', name: 'X', src: 'data:,' },
      { type: 'slide.addLogo', id: 'y', name: 'Y', src: 'data:,' },
    )
    const ids = s.slides.items.map((i) => i.id)
    s = reduce(s, { type: 'slide.select', id: 'x' })
    // Reverse the whole deck.
    const reversed = [...ids].reverse()
    s = reduce(s, { type: 'slide.reorder', ids: reversed })
    expect(s.slides.items.map((i) => i.id)).toEqual(reversed)
    expect(s.slides.items.length).toBe(ids.length) // nothing dropped
    expect(s.slides.selectedId).toBe('x') // selection follows the slide, not the slot
  })

  it('text slide: editing stages; commit publishes the selected slide', () => {
    let s = run({ type: 'slide.select', id: 'text-1' })
    s = reduce(s, { type: 'slide.setField', id: 'text-1', field: 'headline', value: 'Skiing' })
    s = reduce(s, { type: 'slide.setField', id: 'text-1', field: 'body', value: 'but with pizza sauce' })
    expect(textSlide(s, 'text-1')).toMatchObject({ headline: 'Skiing', body: 'but with pizza sauce' })
    expect(s.slides.live).toBeNull() // not shown until committed
    const live = reduce(s, { type: 'slide.commit' }).slides.live
    expect(live).toMatchObject({ id: 'text-1', type: 'text', headline: 'Skiing', body: 'but with pizza sauce' })
  })

  it('text slide: quadrants layout commits its four words', () => {
    let s = run({ type: 'slide.select', id: 'text-1' })
    s = reduce(s, { type: 'slide.setTemplate', id: 'text-1', template: 'quadrants' })
    s = reduce(s, { type: 'slide.setQuad', id: 'text-1', index: 0, value: 'TL' })
    s = reduce(s, { type: 'slide.setQuad', id: 'text-1', index: 3, value: 'BR' })
    const live = reduce(s, { type: 'slide.commit' }).slides.live
    expect(live?.type).toBe('text')
    if (live?.type === 'text') {
      expect(live.template).toBe('quadrants')
      expect(live.quads).toEqual(['TL', '', '', 'BR'])
    }
  })

  it('text slide: live-type is a toggle, independent of layout', () => {
    let s = run({ type: 'slide.setLiveType', id: 'text-1', value: true })
    expect(textSlide(s, 'text-1').liveType).toBe(true)
    expect(textSlide(s, 'text-1').template).toBe('basic') // layout unchanged
    s = reduce(s, { type: 'slide.setTemplate', id: 'text-1', template: 'quadrants' })
    expect(textSlide(s, 'text-1').liveType).toBe(true) // survives a layout change
    s = reduce(s, { type: 'slide.setLiveType', id: 'text-1', value: false })
    expect(textSlide(s, 'text-1').liveType).toBe(false)
  })

  it('image slide: added empty, then set the picture; commit publishes it', () => {
    let s = run({ type: 'slide.addImage', id: 'img1' })
    expect(s.slides.selectedId).toBe('img1')
    const empty = s.slides.items.find((i) => i.id === 'img1')
    expect(empty?.type === 'image' && empty.src).toBe('') // created empty, no picker

    s = reduce(s, { type: 'slide.setImage', id: 'img1', src: 'data:image/jpeg;base64,ZZ' })
    const live = reduce(s, { type: 'slide.commit' }).slides.live
    expect(live).toMatchObject({ id: 'img1', type: 'image', src: 'data:image/jpeg;base64,ZZ' })
  })

  it('slides: add / select / remove; commit follows the selection', () => {
    // Add a second text slide (auto-selected), give it content.
    let s = run({ type: 'slide.addText', id: 't2', template: 'basic' })
    expect(s.slides.selectedId).toBe('t2')
    s = reduce(s, { type: 'slide.setField', id: 't2', field: 'headline', value: 'Second' })

    // Commit publishes the selected (second) slide.
    const liveB = reduce(s, { type: 'slide.commit' }).slides.live
    expect(liveB?.type === 'text' && liveB.headline).toBe('Second')

    // Select the default text slide, commit publishes it instead.
    s = reduce(s, { type: 'slide.select', id: 'text-1' })
    expect(reduce(s, { type: 'slide.commit' }).slides.live?.id).toBe('text-1')

    // Removing the selected slide falls back to a remaining one.
    s = reduce(s, { type: 'slide.remove', id: 'text-1' })
    expect(hasId(s, 'text-1')).toBe(false)
    expect(hasId(s, s.slides.selectedId)).toBe(true)
  })

  it('slideshow: edit stages; commit publishes the selected slide; add/select/remove', () => {
    const url = 'https://docs.google.com/presentation/d/e/abc/embed?start=true&loop=true'
    let s = run({ type: 'slideshow.setSlideUrl', id: 'slide-1', url })
    expect(s.slideshow.slides[0].url).toBe(url)
    expect(s.slideshow.liveUrl).toBe('') // not live until committed
    expect(reduce(s, { type: 'slideshow.commit' }).slideshow.liveUrl).toBe(url)

    // Add a second slide (auto-selected), give it a URL, commit publishes it.
    const url2 = 'https://example.com/deck-two/embed'
    s = reduce(s, { type: 'slideshow.addSlide', id: 'slide-2' })
    expect(s.slideshow.slides).toHaveLength(2)
    expect(s.slideshow.selectedId).toBe('slide-2')
    s = reduce(s, { type: 'slideshow.setSlideUrl', id: 'slide-2', url: url2 })
    expect(reduce(s, { type: 'slideshow.commit' }).slideshow.liveUrl).toBe(url2)

    // Toggle back to the first and commit publishes it again.
    s = reduce(s, { type: 'slideshow.selectSlide', id: 'slide-1' })
    expect(reduce(s, { type: 'slideshow.commit' }).slideshow.liveUrl).toBe(url)

    // Removing the selected slide falls back; the last slide can't be removed.
    s = reduce(s, { type: 'slideshow.removeSlide', id: 'slide-1' })
    expect(s.slideshow.slides).toHaveLength(1)
    expect(s.slideshow.selectedId).toBe('slide-2')
    expect(reduce(s, { type: 'slideshow.removeSlide', id: 'slide-2' }).slideshow.slides).toHaveLength(1)
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

  it('final-score sequence: tabulate → countdown → celebrate → finish', () => {
    // Starting the finale fires the drum roll (finaleNonce) and enters
    // tabulating — but NOT the celebration bumper/confetti (revealNonce) yet.
    const started = run({ type: 'half.set', half: 'end' }, { type: 'score.reveal' })
    expect(started.finaleStage).toBe('tabulating')
    expect(started.finaleNonce).toBe(1)
    expect(started.revealNonce).toBe(0) // celebration waits for the 'celebrate' step

    // Countdown ticks set the visible number.
    const c2 = reduce(started, { type: 'finale.countdown', value: 2 })
    expect(c2.finaleStage).toBe('countdown')
    expect(c2.countdown).toBe(2)

    // Celebrate bumps revealNonce → confetti + high-energy bumper fire now.
    const celebrate = reduce(c2, { type: 'finale.celebrate' })
    expect(celebrate.finaleStage).toBe('celebrate')
    expect(celebrate.revealNonce).toBe(1)

    // Finish resets the whole sequence.
    const done = reduce(celebrate, { type: 'reveal.finish' })
    expect(done.revealPhase).toBe('idle')
    expect(done.finaleStage).toBe('idle')
    expect(done.countdown).toBe(0)
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

  it('effect.fire sets the kind and bumps the nonce each press', () => {
    let s = run({ type: 'effect.fire', kind: 'confetti' })
    expect(s.effect).toEqual({ kind: 'confetti', nonce: 1 })
    s = reduce(s, { type: 'effect.fire', kind: 'hearts' })
    expect(s.effect).toEqual({ kind: 'hearts', nonce: 2 })
  })

  it('records the played track so the next pick avoids it', () => {
    const s = run({ type: 'music.trackPlayed', id: 'b', name: 'B' })
    expect(s.music.lastTrackId).toBe('b')
    expect(s.music.lastTrackName).toBe('B')
  })

  it('next-song pick: set, and drop it when the library no longer has it', () => {
    const lib = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]
    let s = run({ type: 'music.setLibrary', tracks: lib })
    expect(s.music.librarySize).toBe(2)

    s = reduce(s, { type: 'music.setNextTrack', id: 'b' })
    expect(s.music.nextTrackId).toBe('b')

    // Re-scanning a folder that still has 'b' keeps the pick...
    s = reduce(s, { type: 'music.setLibrary', tracks: lib })
    expect(s.music.nextTrackId).toBe('b')

    // ...but a library without 'b' drops the stale pick back to random.
    s = reduce(s, { type: 'music.setLibrary', tracks: [{ id: 'a', name: 'A' }] })
    expect(s.music.nextTrackId).toBeNull()
  })
})

describe('home/away ribbons', () => {
  it('stage like the audience: edits publish only on reveal', () => {
    let s = run({ type: 'ribbons.setHome', value: 'Chickens' })
    s = reduce(s, { type: 'ribbons.setAway', value: 'Turkeys' })
    s = reduce(s, { type: 'ribbons.setVisible', visible: false })
    // Draft changed; live still the defaults until a reveal.
    expect(s.ribbons).toEqual({ home: 'Chickens', away: 'Turkeys', visible: false })
    expect(s.ribbonsLive).toEqual({ home: 'Home', away: 'Away', visible: true })
    const revealed = reduce(s, { type: 'score.reveal' })
    expect(revealed.ribbonsLive).toEqual({ home: 'Chickens', away: 'Turkeys', visible: false })
  })

  it('home follows Blue and away follows Red across the halftime swap', () => {
    // The ribbon label for a side is chosen by which team sits there, and
    // teamOnSide flips at the 2nd half — so the labels swap with the teams.
    expect(teamOnSide('left', 'first')).toBe('blue') // 1st half: Home (Blue) on the left
    expect(teamOnSide('left', 'second')).toBe('red') // 2nd half: Away (Red) on the left
  })
})

describe('formatScore', () => {
  it('shows whole numbers plainly and trims floating-point dust', () => {
    expect(formatScore(4)).toBe('4')
    expect(formatScore(3.5)).toBe('3.5')
    expect(formatScore(0.1 + 0.2)).toBe('0.3') // not "0.30000000000000004"
    expect(formatScore(-2.5)).toBe('-2.5')
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
