import { describe, expect, it, vi } from 'vitest'
import {
  createInitialState,
  defaultSavedTemplates,
  normActiveTemplate,
  normActiveBoard,
  normSavedBoards,
  normSavedSlideshows,
  normSavedTemplates,
  normSoundBanks,
  reactionSlide,
  showSlide,
  templateSkeleton,
} from './state'
import type { AppState, LogoSlide, ShowSlide, Slide, SoundPad, TextSlide } from './state'
import { reduce } from './reduce'
import { determineWinner } from './winner'
import { sideOf, teamOnSide } from './sides'
import { pickBumper } from './bumper'
import {
  FINALE_FIT_CHARS,
  FINALE_TIE_FIT_CHARS,
  PANEL_FIT_CHARS,
  formatScore,
  scoreScale,
} from './score'
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

describe('reaction control slide (Yay Boo)', () => {
  it('flash sets the live reaction and bumps the nonce each tap', () => {
    let s = run({ type: 'reaction.flash', team: 'blue', kind: 'boo' })
    expect(s.reaction).toEqual({ team: 'blue', kind: 'boo' })
    expect(s.reactionNonce).toBe(1)
    // A repeat of the same team+word still bumps the nonce so the flash replays.
    s = reduce(s, { type: 'reaction.flash', team: 'blue', kind: 'boo' })
    expect(s.reactionNonce).toBe(2)
    s = reduce(s, { type: 'reaction.flash', team: 'red', kind: 'yay' })
    expect(s.reaction).toEqual({ team: 'red', kind: 'yay' })
  })

  it('airing a reaction slide resets to the neutral holding screen', () => {
    const s = run(
      { type: 'slide.addReaction', id: 'yb', deck: 'games' },
      { type: 'reaction.flash', team: 'red', kind: 'boo' }, // stale flash from a prior round
      { type: 'slide.select', id: 'yb' },
      { type: 'slide.commit' },
    )
    expect(s.slides.live?.type).toBe('reaction')
    expect(s.reaction).toBeNull()
  })

  it('committing a non-reaction slide leaves any live reaction untouched', () => {
    const s = run(
      { type: 'reaction.flash', team: 'blue', kind: 'yay' },
      { type: 'slide.addText', id: 'tx', template: 'basic', deck: 'games' },
      { type: 'slide.select', id: 'tx' },
      { type: 'slide.commit' },
    )
    expect(s.reaction).toEqual({ team: 'blue', kind: 'yay' })
  })
})

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

  it('slideshow slide: add to a deck, set its URL, reveal via commit', () => {
    const url = 'https://docs.google.com/presentation/d/e/abc/embed?start=true&loop=true'
    let s = run({ type: 'slide.addSlideshow', id: 'ss-1', deck: 'show' })
    const added = s.slides.items.find((i) => i.id === 'ss-1')
    expect(added?.type).toBe('slideshow')
    expect(added?.deck).toBe('show')
    expect(s.slides.selectedId).toBe('ss-1') // adding selects it

    s = reduce(s, { type: 'slide.setSlideshowUrl', id: 'ss-1', url })
    const ss = s.slides.items.find((i) => i.id === 'ss-1')
    expect(ss?.type === 'slideshow' && ss.url).toBe(url)
    expect(s.slides.live).toBeNull() // not on air until committed
    expect(reduce(s, { type: 'slide.commit' }).slides.live?.id).toBe('ss-1')
  })

  it('slides carry a deck; adds land in the requested deck', () => {
    const s = run(
      { type: 'slide.addText', id: 'g1', template: 'quadrants', deck: 'games' },
      { type: 'slide.addLogo', id: 's1', name: 'X', src: 'data:,', deck: 'show' },
    )
    expect(s.slides.items.find((i) => i.id === 'g1')?.deck).toBe('games')
    expect(s.slides.items.find((i) => i.id === 's1')?.deck).toBe('show')
  })

  it('clearDeck wipes only its own deck; loading a game template replaces, not piles', () => {
    // Two games slides + one show slide in the deck.
    let s = run(
      { type: 'slide.addText', id: 'old1', template: 'basic', deck: 'games' },
      { type: 'slide.addText', id: 'old2', template: 'basic', deck: 'games' },
      { type: 'slide.addLogo', id: 'show1', name: 'X', src: 'data:,', deck: 'show' },
    )
    expect(s.slides.items.filter((i) => i.deck === 'games')).toHaveLength(2)
    // Load a new template: clear games, then add the template's slide.
    s = reduce(s, { type: 'slide.clearDeck', deck: 'games' })
    expect(s.slides.items.filter((i) => i.deck === 'games')).toHaveLength(0)
    expect(s.slides.items.find((i) => i.id === 'show1')).toBeDefined() // show deck untouched
    s = reduce(s, { type: 'slide.addText', id: 'new1', template: 'basic', deck: 'games', theme: 'spellingbee' })
    expect(s.slides.items.filter((i) => i.deck === 'games')).toHaveLength(1)
    const added = s.slides.items.find((i) => i.id === 'new1')
    expect(added?.type === 'text' && added.theme).toBe('spellingbee')
  })

  it('show beats: default sequence is seeded, and addShow / setShowField edit a beat', () => {
    // A fresh state carries the scripted Show run-of-show, ref first.
    const beats = createInitialState().slides.items.filter((i) => i.type === 'show')
    expect(beats.length).toBeGreaterThanOrEqual(8)
    expect(beats[0]).toMatchObject({ type: 'show', beat: 'ref', deck: 'show' })
    // Add a beat and fill its fields.
    let s = run({ type: 'slide.addShow', id: 'b-ref', beat: 'ref', deck: 'show' })
    s = reduce(s, { type: 'slide.setShowField', id: 'b-ref', field: 'name', value: 'Rowan' })
    const added = s.slides.items.find((i) => i.id === 'b-ref')
    expect(added?.type === 'show' && added.name).toBe('Rowan')
  })

  it('reveal signals a cue effect via revealAnimNonce, without firing it inline', () => {
    let s = run(
      { type: 'slide.addShow', id: 'b1', beat: 'players', deck: 'show' },
      { type: 'slide.setCue', id: 'b1', cue: { effect: 'confetti', trackId: 't-1' } },
      { type: 'slide.select', id: 'b1' },
      { type: 'slide.commit' },
    )
    const beforeEffect = s.effect.nonce
    const beforeAnim = s.revealAnimNonce
    // A silent display change moves neither.
    s = reduce(s, { type: 'display.set', scene: 'slides' })
    expect(s.effect.nonce).toBe(beforeEffect)
    expect(s.revealAnimNonce).toBe(beforeAnim)
    // A Reveal bumps the anim nonce (what the timed cue service keys on) but does
    // NOT fire the effect inline — the service fires it after a delay.
    s = reduce(s, { type: 'display.reveal', scene: 'slides' })
    expect(s.revealAnimNonce).toBe(beforeAnim + 1)
    expect(s.effect.nonce).toBe(beforeEffect)
  })

  it('setCue with an empty cue clears it', () => {
    let s = run(
      { type: 'slide.addShow', id: 'b1', beat: 'ref', deck: 'show' },
      { type: 'slide.setCue', id: 'b1', cue: { effect: 'stars' } },
    )
    expect((s.slides.items.find((i) => i.id === 'b1') as { cue?: unknown }).cue).toEqual({ effect: 'stars' })
    s = reduce(s, { type: 'slide.setCue', id: 'b1', cue: {} })
    expect((s.slides.items.find((i) => i.id === 'b1') as { cue?: unknown }).cue).toBeUndefined()
  })

  it('a silence cue is kept (it is a real instruction, not an empty cue)', () => {
    const s = run(
      { type: 'slide.addShow', id: 'b1', beat: 'blackout', deck: 'show' },
      { type: 'slide.setCue', id: 'b1', cue: { silence: true } },
    )
    expect((s.slides.items.find((i) => i.id === 'b1') as { cue?: unknown }).cue).toEqual({ silence: true })
  })
})

describe('live mode', () => {
  it('off: selecting a slide only previews — nothing goes on air', () => {
    let s = run({ type: 'slide.addText', id: 't1', template: 'basic', deck: 'show' })
    const beforeAnim = s.revealAnimNonce
    s = reduce(s, { type: 'slide.select', id: 't1' })
    expect(s.slides.selectedId).toBe('t1')
    expect(s.slides.live).toBeNull()
    expect(s.revealAnimNonce).toBe(beforeAnim)
  })

  it('on: selecting a slide auto-reveals it (animated + cue trigger)', () => {
    let s = run({ type: 'slide.addText', id: 't1', template: 'basic', deck: 'show' }, { type: 'live.toggle' })
    const beforeAnim = s.revealAnimNonce
    s = reduce(s, { type: 'slide.select', id: 't1' })
    expect(s.slides.live?.id).toBe('t1')
    expect(s.scene).toBe('slides')
    expect(s.displayWasReveal).toBe(true)
    expect(s.revealAnimNonce).toBe(beforeAnim + 1)
  })

  it('on: a score bump publishes live AND shows the scoreboard, silently', () => {
    const s = run({ type: 'live.toggle' }, { type: 'blue.increment' })
    expect(s.teams.blue.pendingScore).toBe(1)
    expect(s.teams.blue.liveScore).toBe(1)
    expect(s.scene).toBe('scoreboard') // score is reachable on air in live
    expect(s.displayWasReveal).toBe(false) // …but silent — no celebration animation
    expect(s.revealNonce).toBe(0) // no celebration bumper
  })

  it('off: a score bump stays pending until a reveal', () => {
    const s = run({ type: 'blue.increment' })
    expect(s.teams.blue.pendingScore).toBe(1)
    expect(s.teams.blue.liveScore).toBe(0)
  })

  it('on: editing the on-air slide mirrors to the live copy', () => {
    let s = run(
      { type: 'slide.addText', id: 't1', template: 'basic', deck: 'show' },
      { type: 'live.toggle' },
      { type: 'slide.select', id: 't1' },
    )
    s = reduce(s, { type: 'slide.setField', id: 't1', field: 'headline', value: 'HI' })
    expect(s.slides.live?.type === 'text' && s.slides.live.headline).toBe('HI')
  })

  it('live.toggle flips the mode', () => {
    expect(run({ type: 'live.toggle' }).liveMode).toBe(true)
    expect(run({ type: 'live.toggle' }, { type: 'live.toggle' }).liveMode).toBe(false)
  })
})

describe('saved templates', () => {
  it('seeds Standard + Simple on a fresh state', () => {
    const s = createInitialState()
    expect(s.savedTemplates.map((t) => t.id).sort()).toEqual(['simple', 'std'])
    const std = s.savedTemplates.find((t) => t.id === 'std')!
    expect(std.slides[0].type).toBe('slideshow') // pre-show first
  })

  it('templateSkeleton strips per-show name/roster but keeps the cue', () => {
    const beat: ShowSlide = {
      id: 'x',
      type: 'show',
      deck: 'show',
      beat: 'ref',
      name: 'Dana',
      roster: 'a\nb',
      cue: { trackId: 'trk-1' },
    }
    const sk = templateSkeleton(beat) as ShowSlide
    expect(sk.name).toBe('')
    expect(sk.roster).toBe('')
    expect(sk.cue).toEqual({ trackId: 'trk-1' })
  })

  it('save / update / rename / remove a template', () => {
    const slides: Slide[] = [{ id: 'a', type: 'show', deck: 'show', beat: 'logo', name: '', roster: '' }]
    let s = run({ type: 'template.saveNew', id: 'mine', name: 'My show', slides })
    expect(s.savedTemplates.find((t) => t.id === 'mine')?.name).toBe('My show')

    const slides2: Slide[] = [...slides, { id: 'b', type: 'show', deck: 'show', beat: 'players', name: '', roster: '' }]
    s = reduce(s, { type: 'template.update', id: 'mine', slides: slides2 })
    expect(s.savedTemplates.find((t) => t.id === 'mine')?.slides).toHaveLength(2)

    s = reduce(s, { type: 'template.rename', id: 'mine', name: 'Renamed' })
    expect(s.savedTemplates.find((t) => t.id === 'mine')?.name).toBe('Renamed')

    s = reduce(s, { type: 'template.remove', id: 'mine' })
    expect(s.savedTemplates.some((t) => t.id === 'mine')).toBe(false)
  })

  it('slide.addMany appends slides and selects the first', () => {
    const slides: Slide[] = [
      { id: 'n1', type: 'show', deck: 'show', beat: 'logo', name: '', roster: '' },
      { id: 'n2', type: 'show', deck: 'show', beat: 'players', name: '', roster: '' },
    ]
    const before = createInitialState().slides.items.length
    const s = run({ type: 'slide.clearDeck', deck: 'show' }, { type: 'slide.addMany', deck: 'show', slides })
    expect(s.slides.items.filter((x) => x.deck === 'show')).toHaveLength(2)
    expect(s.slides.items.length).toBeLessThan(before) // clearDeck removed the seeded show slides first
    expect(s.slides.selectedId).toBe('n1')
  })

  it('normSavedTemplates falls back to the seed when absent, keeps a valid array', () => {
    expect(normSavedTemplates(undefined).length).toBeGreaterThan(0)
    expect(normSavedTemplates([])).toEqual([])
  })
})

describe('saved slideshows (curated library)', () => {
  it('starts empty; save / update / remove', () => {
    expect(createInitialState().savedSlideshows).toEqual([])
    let s = run({ type: 'slideshow.save', id: 'cs', name: 'ComedySportz', url: 'https://x/pub' })
    expect(s.savedSlideshows).toEqual([{ id: 'cs', name: 'ComedySportz', url: 'https://x/pub' }])
    s = reduce(s, { type: 'slideshow.update', id: 'cs', name: 'CSz', url: 'https://y/watch?embed' })
    expect(s.savedSlideshows[0]).toEqual({ id: 'cs', name: 'CSz', url: 'https://y/watch?embed' })
    s = reduce(s, { type: 'slideshow.remove', id: 'cs' })
    expect(s.savedSlideshows).toEqual([])
  })

  it('normSavedSlideshows drops junk, defaults a missing url to empty', () => {
    expect(normSavedSlideshows(undefined)).toEqual([])
    expect(
      normSavedSlideshows([{ id: 'a', name: 'A' }, { name: 'no id' }, { id: 'b', name: 'B', url: 'u' }]),
    ).toEqual([
      { id: 'a', name: 'A', url: '' },
      { id: 'b', name: 'B', url: 'u' },
    ])
  })
})

describe('presentation (cue stack)', () => {
  const firstShow = createInitialState().slides.items.find((x) => x.deck === 'show')!
  const showCount = createInitialState().slides.items.filter((x) => x.deck === 'show').length

  it('start airs the first beat and marks the playhead', () => {
    const s = run({ type: 'present.start', deck: 'show' })
    expect(s.presentation).toEqual({ deck: 'show', index: 0 })
    expect(s.scene).toBe('slides')
    expect(s.slides.live?.id).toBe(firstShow.id)
    expect(s.revealAnimNonce).toBe(1)
  })

  it('start begins at the currently selected slide, not always the top', () => {
    const showItems = createInitialState().slides.items.filter((x) => x.deck === 'show')
    const third = showItems[2]
    const s = run({ type: 'slide.select', id: third.id }, { type: 'present.start', deck: 'show' })
    expect(s.presentation).toEqual({ deck: 'show', index: 2 })
    expect(s.slides.live?.id).toBe(third.id)
  })

  it('next / prev advance the playhead and clamp at the ends', () => {
    let s = run({ type: 'present.start', deck: 'show' })
    s = reduce(s, { type: 'present.prev' })
    expect(s.presentation?.index).toBe(0) // clamps at the top
    s = reduce(s, { type: 'present.next' })
    expect(s.presentation?.index).toBe(1)
    s = reduce(s, { type: 'present.goto', index: 999 })
    expect(s.presentation?.index).toBe(showCount - 1) // clamps at the end
  })

  it('stop exits the cue stack and cuts to black', () => {
    let s = run({ type: 'present.start', deck: 'show' })
    s = reduce(s, { type: 'present.stop' })
    expect(s.presentation).toBeNull()
    expect(s.scene).toBe('black')
  })

  it('next / prev do nothing when not presenting', () => {
    expect(run({ type: 'present.next' }).presentation).toBeNull()
    expect(run({ type: 'present.prev' }).presentation).toBeNull()
  })
})

describe('generic captain (deck quick buttons)', () => {
  it('reveals a generic captain with no scripted name, no deck slide needed', () => {
    const s = run({ type: 'show.captain', which: 'blue' })
    expect(s.scene).toBe('slides')
    expect(s.displayWasReveal).toBe(true)
    expect(s.revealAnimNonce).toBe(1)
    expect(s.slides.live?.type).toBe('show')
    expect(s.slides.live?.type === 'show' && s.slides.live.beat).toBe('captain-blue')
    expect(s.slides.live?.type === 'show' && s.slides.live.generic).toBe(true)
    expect(s.slides.live?.type === 'show' && s.slides.live.name).toBe('') // ignores any scripted name
  })

  it('is independent of the scripted captain slide (does not select or alter the deck)', () => {
    let s = run(
      { type: 'slide.addShow', id: 'cap', beat: 'captain-blue', deck: 'show' },
      { type: 'slide.setShowField', id: 'cap', field: 'name', value: 'Dana' },
      { type: 'slide.select', id: 'cap' },
    )
    const itemsBefore = s.slides.items
    s = reduce(s, { type: 'show.captain', which: 'blue' })
    // The scripted slide is untouched and still selected; the live card is the
    // transient generic one, not the named deck slide.
    expect(s.slides.items).toBe(itemsBefore)
    expect(s.slides.selectedId).toBe('cap')
    expect(s.slides.live?.id).not.toBe('cap')
    expect(s.slides.live?.type === 'show' && s.slides.live.name).toBe('')
  })

  it('both captains maps to the dual captains beat', () => {
    const s = run({ type: 'show.captain', which: 'both' })
    expect(s.slides.live?.type === 'show' && s.slides.live.beat).toBe('captains')
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

describe('scoreScale', () => {
  // Measured off the real projector render. Geist Pixel has no tabular figures,
  // so digits differ in width; "8" is the widest at 0.646em, which is the worst
  // case every fit budget is set against.
  const EM = { digit: 0.646, dash: 0.494, space: 0.38 }
  // Worst-case width of a readout, in cqw: every character as wide as an "8".
  const widestAt = (text: string, base: number, fitChars: number) =>
    text.length * EM.digit * base * scoreScale(text, fitChars)
  // Actual width of a tie line, whose dash and spaces are narrower than digits.
  const tieWidthAt = (a: string, b: string, base: number) => {
    const line = `${a} – ${b}`
    const em = (a.length + b.length) * EM.digit + EM.dash + 2 * EM.space
    return em * base * scoreScale(line, FINALE_TIE_FIT_CHARS)
  }

  const LED_FACE = 44.1 // cqw available on the team panel's LED screen
  const PANEL_BASE = 15 // cqw, .team-panel__score
  const WINNER_POP = 1.09 // the reveal grows the winning score this much
  const TAKEOVER = 100 // cqw available to the finale
  const FINALE_BASE = 20 // cqw, .finale__score

  it('holds full size for every score a real game produces', () => {
    // Nothing may shrink in normal play — an operator watching 7 -> 8 -> 9 must
    // never see the digits twitch.
    for (const text of ['0', '7', '42', '3.5', '-2.5', '100', '999', '1000']) {
      expect(scoreScale(text, PANEL_FIT_CHARS)).toBe(1)
    }
  })

  it('steps down once a joke score outgrows the LED face', () => {
    // The show that prompted this: the score became a bit and ran to the
    // millions. Five, six and seven digits each get their own held size.
    expect(scoreScale('10000', PANEL_FIT_CHARS)).toBeCloseTo(0.8)
    expect(scoreScale('100000', PANEL_FIT_CHARS)).toBeCloseTo(0.667, 3)
    expect(scoreScale('1000000', PANEL_FIT_CHARS)).toBeCloseTo(0.571, 3)
  })

  it('never steps back up as a score gets longer', () => {
    const lengths = ['1', '99', '999', '9999', '99999', '999999', '9999999', '99999999']
    const scales = lengths.map((t) => scoreScale(t, PANEL_FIT_CHARS))
    for (let i = 1; i < scales.length; i++) {
      expect(scales[i]).toBeLessThanOrEqual(scales[i - 1])
    }
  })

  it('gives one size per length, not a fit to the rendered width', () => {
    // Every 5-digit score is the size of every other 5-digit score, so a
    // count-up within a length never resizes mid-animation — even though "11111"
    // is visibly narrower than "88888" in this face.
    expect(scoreScale('10000', PANEL_FIT_CHARS)).toBe(scoreScale('99999', PANEL_FIT_CHARS))
  })

  it('keeps every score inside the LED face, winner pop included', () => {
    for (const text of ['9', '99', '999', '9999', '99999', '999999', '9999999', '99999999.5']) {
      const width = widestAt(text, PANEL_BASE, PANEL_FIT_CHARS)
      expect(width * WINNER_POP).toBeLessThanOrEqual(LED_FACE)
    }
  })

  it('fills the LED face without ever quite touching it', () => {
    // Each step holds the readout at the same width, so a stepped-down score
    // still reads as big — it does not shrink to a dot.
    for (const text of ['9999', '99999', '9999999']) {
      const fill = widestAt(text, PANEL_BASE, PANEL_FIT_CHARS) / LED_FACE
      expect(fill).toBeGreaterThan(0.85)
      expect(fill).toBeLessThan(1)
    }
  })

  it('holds the finale at full size for a normal winning score, and steps a silly one', () => {
    expect(scoreScale('42', FINALE_FIT_CHARS)).toBe(1)
    expect(scoreScale('999999', FINALE_FIT_CHARS)).toBe(1)
    expect(scoreScale('1000000', FINALE_FIT_CHARS)).toBeCloseTo(0.857, 3)
    for (const text of ['9', '999999', '9999999', '99999999']) {
      expect(widestAt(text, FINALE_BASE, FINALE_FIT_CHARS)).toBeLessThan(TAKEOVER)
    }
  })

  it('keeps the finale tie line on one line, at full size for a normal tie', () => {
    // A real tie is two short scores, and it must not shrink.
    expect(scoreScale('42 – 39', FINALE_TIE_FIT_CHARS)).toBe(1)
    expect(tieWidthAt('42', '39', FINALE_BASE)).toBeLessThan(TAKEOVER)
    // Three digits each already overflows at full size, so it has to step down.
    expect(scoreScale('999 – 999', FINALE_TIE_FIT_CHARS)).toBeLessThan(1)
    // The widest line this scene can draw: two seven-digit scores.
    expect(tieWidthAt('9999999', '9999999', FINALE_BASE)).toBeLessThan(TAKEOVER)
  })

  it('affords the tie line more characters than a bare score, because its dash is narrow', () => {
    expect(FINALE_TIE_FIT_CHARS).toBeGreaterThan(FINALE_FIT_CHARS)
    // ...and the finale has roughly twice the panel's room, so it holds longer.
    expect(FINALE_FIT_CHARS).toBeGreaterThan(PANEL_FIT_CHARS)
  })
})

describe('templates cover a whole show', () => {
  it('reads the per-deck active pointer a previous build persisted', () => {
    // Templates used to be scoped to one deck, so this was { show, games }.
    // The show slot was the only one ever populated, so it's the one that
    // carries over — the operator stays on the template they were already on.
    expect(normActiveTemplate({ show: 'std', games: null })).toBe('std')
    expect(normActiveTemplate({ show: null, games: null })).toBeNull()
    expect(normActiveTemplate('std')).toBe('std') // already migrated
    expect(normActiveTemplate(undefined)).toBeNull()
    expect(normActiveTemplate(42)).toBeNull()
  })

  it('drops the deck off a template saved when templates had one', () => {
    const [first] = normSavedTemplates([
      { id: 't1', deck: 'games', name: 'Old one', slides: [] },
    ])
    expect(first).toEqual({ id: 't1', name: 'Old one', slides: [] })
    expect('deck' in first).toBe(false)
  })

  it('saving captures both decks and puts you on it', () => {
    const slides: Slide[] = [
      { ...showSlide('a', 'logo', 'show') },
      { ...reactionSlide('b', 'games') },
    ]
    const after = run({ type: 'template.saveNew', id: 'mine', name: 'My show', slides })
    const saved = after.savedTemplates.find((t) => t.id === 'mine')
    expect(saved?.slides.map((s) => s.deck)).toEqual(['show', 'games'])
    expect(after.activeTemplate).toBe('mine') // saving means you're on it
  })

  it('deleting the template you are on leaves you on nothing', () => {
    const after = run(
      { type: 'template.saveNew', id: 'mine', name: 'My show', slides: [] },
      { type: 'template.remove', id: 'mine' },
    )
    expect(after.activeTemplate).toBeNull()
    expect(after.savedTemplates.find((t) => t.id === 'mine')).toBeUndefined()
  })

  it('deleting a different template leaves your pointer alone', () => {
    const after = run(
      { type: 'template.saveNew', id: 'keep', name: 'Keep', slides: [] },
      { type: 'template.saveNew', id: 'drop', name: 'Drop', slides: [] },
      { type: 'template.setActive', id: 'keep' },
      { type: 'template.remove', id: 'drop' },
    )
    expect(after.activeTemplate).toBe('keep')
  })

  it('ships only whole-show built-ins, with no deck of their own', () => {
    for (const t of defaultSavedTemplates()) expect('deck' in t).toBe(false)
  })
})

describe('generic text slides', () => {
  it('reads a slide saved as the retired centered layout as a basic one', () => {
    // 'centered' turned out to be 'basic' at another size, so it folded back in.
    // A slide saved while it existed has to keep rendering, not vanish.
    const [slide] = normSavedTemplates([
      { id: 't', name: 'n', slides: [{ id: 's1', type: 'text', deck: 'show', template: 'centered' }] },
    ])[0].slides
    expect(slide.type === 'text' && slide.template).toBe('basic')
  })

  it('falls back to basic for a template it does not recognise', () => {
    // A slide from a newer build, or a hand-edited file, must still render.
    for (const bad of ['fancy', '', undefined, 7]) {
      const [slide] = normSavedTemplates([
        { id: 't', name: 'n', slides: [{ id: 's1', type: 'text', deck: 'show', template: bad }] },
      ])[0].slides
      expect(slide.type === 'text' && slide.template).toBe('basic')
    }
  })

  it('sets and clears a background, and clearing drops the key', () => {
    const after = run(
      { type: 'slide.addText', id: 'tx', template: 'basic', deck: 'show' },
      { type: 'slide.setTextBg', id: 'tx', src: 'data:image/png;base64,AAA' },
    )
    const withBg = after.slides.items.find((s) => s.id === 'tx')
    expect(withBg?.type === 'text' && withBg.bg).toBe('data:image/png;base64,AAA')

    const cleared = reduce(after, { type: 'slide.setTextBg', id: 'tx', src: '' })
    const gone = cleared.slides.items.find((s) => s.id === 'tx')
    // Absent, not '' — so "has a background" is one check everywhere downstream.
    expect(gone && 'bg' in gone).toBe(false)
  })

  it('a background survives the trip through a template', () => {
    const [slide] = normSavedTemplates([
      { id: 't', name: 'n', slides: [{ id: 's1', type: 'text', deck: 'show', template: 'basic', bg: 'data:x' }] },
    ])[0].slides
    expect(slide.type === 'text' && slide.bg).toBe('data:x')
  })

  it('drops an empty background rather than storing one', () => {
    const [slide] = normSavedTemplates([
      { id: 't', name: 'n', slides: [{ id: 's1', type: 'text', deck: 'show', template: 'basic', bg: '' }] },
    ])[0].slides
    expect(slide.type === 'text' && 'bg' in slide).toBe(false)
  })

  it('leaves other slide types alone when a background is set at one', () => {
    const after = run(
      { type: 'slide.addImage', id: 'im', deck: 'show' },
      { type: 'slide.setTextBg', id: 'im', src: 'data:x' },
    )
    const img = after.slides.items.find((s) => s.id === 'im')
    expect(img && 'bg' in img).toBe(false) // an image slide has no background of its own
  })
})

describe('cues belong to every slide', () => {
  it('keeps a cue on a text slide across a reload', () => {
    // The bug this guards: cues were attached on load for show beats only, so a
    // cue set on any other slide type vanished the next time you opened the app.
    for (const type of ['text', 'image', 'logo', 'slideshow', 'reaction'] as const) {
      const [slide] = normSavedTemplates([
        {
          id: 't',
          name: 'n',
          slides: [{ id: 's1', type, deck: 'show', cue: { effect: 'confetti', trackId: 'song-1' } }],
        },
      ])[0].slides
      expect(slide.cue, `${type} lost its cue`).toEqual({ effect: 'confetti', trackId: 'song-1' })
    }
  })

  it('still keeps one on a show beat', () => {
    const [slide] = normSavedTemplates([
      { id: 't', name: 'n', slides: [{ id: 's1', type: 'show', deck: 'show', beat: 'ref', cue: { silence: true } }] },
    ])[0].slides
    expect(slide.cue).toEqual({ silence: true })
  })

  it('leaves a slide with no cue cueless rather than storing an empty one', () => {
    const [slide] = normSavedTemplates([
      { id: 't', name: 'n', slides: [{ id: 's1', type: 'text', deck: 'show' }] },
    ])[0].slides
    expect(slide.cue).toBeUndefined()
  })
})

describe('how an image meets the frame', () => {
  it('fills the screen for a slide made now', () => {
    const after = run({ type: 'slide.addImage', id: 'im', deck: 'show' })
    const img = after.slides.items.find((s) => s.id === 'im')
    expect(img?.type === 'image' && img.fit).toBe('cover')
  })

  it('letterboxes a slide saved before the choice existed', () => {
    // Absent fit has to keep meaning contain, or every image slide already in a
    // show would silently start cropping.
    const [slide] = normSavedTemplates([
      { id: 't', name: 'n', slides: [{ id: 's1', type: 'image', deck: 'show', src: 'data:x' }] },
    ])[0].slides
    expect(slide.type === 'image' && slide.fit).toBeUndefined()
  })

  it('round-trips an explicit choice', () => {
    for (const fit of ['cover', 'contain'] as const) {
      const [slide] = normSavedTemplates([
        { id: 't', name: 'n', slides: [{ id: 's1', type: 'image', deck: 'show', src: 'data:x', fit }] },
      ])[0].slides
      expect(slide.type === 'image' && slide.fit).toBe(fit)
    }
  })

  it('ignores a fit it does not recognise', () => {
    const [slide] = normSavedTemplates([
      { id: 't', name: 'n', slides: [{ id: 's1', type: 'image', deck: 'show', src: 'data:x', fit: 'stretch' }] },
    ])[0].slides
    expect(slide.type === 'image' && slide.fit).toBeUndefined()
  })
})

describe('one text slide, with background options', () => {
  it('switching layout keeps both sets of content, so it is lossless', () => {
    // This is what lets the three layouts collapse into one menu entry: you can
    // flip between them without losing what you typed.
    const after = run(
      { type: 'slide.addText', id: 'tx', template: 'basic', deck: 'show' },
      { type: 'slide.setField', id: 'tx', field: 'headline', value: 'Skiing' },
      { type: 'slide.setQuad', id: 'tx', index: 0, value: 'north' },
      { type: 'slide.setTemplate', id: 'tx', template: 'quadrants' },
      { type: 'slide.setTemplate', id: 'tx', template: 'basic' },
    )
    const tx = after.slides.items.find((s) => s.id === 'tx')
    expect(tx?.type === 'text' && tx.template).toBe('basic')
    expect(tx?.type === 'text' && tx.headline).toBe('Skiing')
    expect(tx?.type === 'text' && tx.quads[0]).toBe('north')
  })

  it('treats a missing dim as dim, so an older slide looks unchanged', () => {
    const [slide] = normSavedTemplates([
      { id: 't', name: 'n', slides: [{ id: 's1', type: 'text', deck: 'show', bg: 'data:x' }] },
    ])[0].slides
    expect(slide.type === 'text' && slide.bgDim).toBeUndefined()
  })

  it('round-trips each dim level and ignores one it does not know', () => {
    for (const dim of ['full', 'dim', 'faint'] as const) {
      const [slide] = normSavedTemplates([
        { id: 't', name: 'n', slides: [{ id: 's1', type: 'text', deck: 'show', bg: 'data:x', bgDim: dim }] },
      ])[0].slides
      expect(slide.type === 'text' && slide.bgDim).toBe(dim)
    }
    const [bad] = normSavedTemplates([
      { id: 't', name: 'n', slides: [{ id: 's1', type: 'text', deck: 'show', bg: 'data:x', bgDim: 'pitch' }] },
    ])[0].slides
    expect(bad.type === 'text' && bad.bgDim).toBeUndefined()
  })

  it('keeps a background color, and clearing it drops the key', () => {
    const after = run(
      { type: 'slide.addText', id: 'tx', template: 'basic', deck: 'show' },
      { type: 'slide.setTextBgColor', id: 'tx', color: '#0a84ff' },
    )
    const set = after.slides.items.find((s) => s.id === 'tx')
    expect(set?.type === 'text' && set.bgColor).toBe('#0a84ff')

    const cleared = reduce(after, { type: 'slide.setTextBgColor', id: 'tx', color: '' })
    const gone = cleared.slides.items.find((s) => s.id === 'tx')
    expect(gone && 'bgColor' in gone).toBe(false)
  })
})

describe('one logo slide', () => {
  it('can change which logo it shows', () => {
    const after = run(
      { type: 'slide.addLogo', id: 'lg', name: 'ComedySportz', src: 'logos/comedysportz.png', deck: 'show' },
      { type: 'slide.setLogo', id: 'lg', name: 'Seattle Comedy Theater', src: 'logos/seattle-comedy-theater.png' },
    )
    const lg = after.slides.items.find((s) => s.id === 'lg')
    expect(lg?.type === 'logo' && lg.src).toBe('logos/seattle-comedy-theater.png')
    expect(lg?.type === 'logo' && lg.name).toBe('Seattle Comedy Theater')
  })

  it('leaves other slides alone', () => {
    const after = run(
      { type: 'slide.addText', id: 'tx', template: 'basic', deck: 'show' },
      { type: 'slide.setLogo', id: 'tx', name: 'x', src: 'y' },
    )
    const tx = after.slides.items.find((s) => s.id === 'tx')
    expect(tx?.type).toBe('text')
    expect(tx && 'src' in tx).toBe(false)
  })
})

describe('robustness', () => {
  it('ignores an unrecognized command instead of returning undefined', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const before = createInitialState()
    // Simulates a newer renderer sending a command an older reducer never saw.
    const after = reduce(before, { type: 'something.unknown' } as unknown as Command)
    expect(after).toBe(before) // unchanged, never undefined
    // ...but not in silence: a stale main bundle otherwise shows up only as a
    // button that does nothing.
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toContain('something.unknown')
    warn.mockRestore()
  })

  it('warns once per command type, not once per dispatch', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const before = createInitialState()
    // A dead button gets clicked more than once; the log shouldn't fill up.
    for (let i = 0; i < 3; i++) reduce(before, { type: 'another.unknown' } as unknown as Command)
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
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

describe('soundboard banks', () => {
  const pad = (id: string, trackId = '/m/a.mp3', label = 'A') =>
    ({ id, kind: 'track', trackId, label }) satisfies SoundPad

  it('adds a bank, then appends pads to it', () => {
    const s = run(
      { type: 'soundBank.add', id: 'b1', name: 'high energy beats' },
      { type: 'soundPad.add', bankId: 'b1', pads: [pad('p1'), pad('p2')] },
    )
    expect(s.soundBanks).toHaveLength(1)
    expect(s.soundBanks[0].name).toBe('high energy beats')
    expect(s.soundBanks[0].pads.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('appends rather than replacing, so a second drop keeps the first', () => {
    const s = run(
      { type: 'soundBank.add', id: 'b1', name: 'one' },
      { type: 'soundPad.add', bankId: 'b1', pads: [pad('p1')] },
      { type: 'soundPad.add', bankId: 'b1', pads: [pad('p2')] },
    )
    expect(s.soundBanks[0].pads.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('leaves other banks alone when editing one', () => {
    const s = run(
      { type: 'soundBank.add', id: 'b1', name: 'one' },
      { type: 'soundBank.add', id: 'b2', name: 'two' },
      { type: 'soundPad.add', bankId: 'b2', pads: [pad('p1')] },
      { type: 'soundBank.rename', id: 'b1', name: 'renamed' },
    )
    expect(s.soundBanks[0]).toEqual({ id: 'b1', name: 'renamed', pads: [] })
    expect(s.soundBanks[1].pads).toHaveLength(1)
  })

  it('removes a pad and a bank', () => {
    const s = run(
      { type: 'soundBank.add', id: 'b1', name: 'one' },
      { type: 'soundPad.add', bankId: 'b1', pads: [pad('p1'), pad('p2')] },
      { type: 'soundPad.remove', bankId: 'b1', padId: 'p1' },
    )
    expect(s.soundBanks[0].pads.map((p) => p.id)).toEqual(['p2'])
    expect(reduce(s, { type: 'soundBank.remove', id: 'b1' }).soundBanks).toEqual([])
  })

  it('relabels one pad without touching the track it points at', () => {
    const s = run(
      { type: 'soundBank.add', id: 'b1', name: 'one' },
      { type: 'soundPad.add', bankId: 'b1', pads: [pad('p1', '/m/song.mp3', 'song')] },
      { type: 'soundPad.relabel', bankId: 'b1', padId: 'p1', label: 'SHOOT OUT' },
    )
    expect(s.soundBanks[0].pads[0]).toEqual({
      id: 'p1',
      kind: 'track',
      trackId: '/m/song.mp3',
      label: 'SHOOT OUT',
    })
  })

  it('switches a tag pad between one-and-done and house music', () => {
    const tagPad = { id: 'p1', kind: 'tag', tag: 'run-in', mode: 'random', label: 'Run-in' } satisfies SoundPad
    const s = run(
      { type: 'soundBank.add', id: 'b1', name: 'one' },
      { type: 'soundPad.add', bankId: 'b1', pads: [tagPad] },
      { type: 'soundPad.setMode', bankId: 'b1', padId: 'p1', mode: 'continuous' },
    )
    expect(s.soundBanks[0].pads[0]).toEqual({ ...tagPad, mode: 'continuous' })
  })

  it('leaves a track pad alone when asked to set a mode it cannot have', () => {
    const s = run(
      { type: 'soundBank.add', id: 'b1', name: 'one' },
      { type: 'soundPad.add', bankId: 'b1', pads: [pad('p1')] },
      { type: 'soundPad.setMode', bankId: 'b1', padId: 'p1', mode: 'continuous' },
    )
    // A stray mode field would make the pad fail its own kind check on reload.
    expect(s.soundBanks[0].pads[0]).toEqual(pad('p1'))
  })

  it('reorders pads, keeping any the caller did not mention', () => {
    const s = run(
      { type: 'soundBank.add', id: 'b1', name: 'one' },
      { type: 'soundPad.add', bankId: 'b1', pads: [pad('p1'), pad('p2'), pad('p3')] },
      { type: 'soundPad.reorder', bankId: 'b1', ids: ['p3', 'p1'] },
    )
    // A stale drag must never silently drop a pad off the board.
    expect(s.soundBanks[0].pads.map((p) => p.id)).toEqual(['p3', 'p1', 'p2'])
  })

  it('ignores unknown ids instead of throwing mid-show', () => {
    const s = run(
      { type: 'soundBank.add', id: 'b1', name: 'one' },
      { type: 'soundPad.add', bankId: 'nope', pads: [pad('p1')] },
      { type: 'soundPad.remove', bankId: 'b1', padId: 'nope' },
    )
    expect(s.soundBanks[0].pads).toEqual([])
  })
})

describe('saved soundboards', () => {
  const pad = (id: string) => ({ id, kind: 'track', trackId: `/m/${id}.mp3`, label: id }) satisfies SoundPad
  const banks = [{ id: 'b1', name: 'Act One', pads: [pad('p1')] }]

  it('saves the board and marks it the one you are on', () => {
    const s = run({ type: 'soundBoard.saveNew', id: 'sb1', name: 'Tuesday', banks })
    // By id, not by position: a default board ships, so this is no longer the
    // only entry in the list.
    expect(s.savedBoards.find((b) => b.id === 'sb1')).toEqual({ id: 'sb1', name: 'Tuesday', banks })
    expect(s.activeBoard).toBe('sb1')
  })

  it('loads a board over the top of whatever was there', () => {
    const s = run(
      { type: 'soundBank.add', id: 'old', name: 'Old' },
      { type: 'soundBoard.load', banks, activeId: 'sb1' },
    )
    // Replaced wholesale — never the old tabs plus the new ones.
    expect(s.soundBanks).toEqual(banks)
    expect(s.activeBoard).toBe('sb1')
  })

  it('editing the board after loading never writes back to the preset', () => {
    const s = run(
      { type: 'soundBoard.saveNew', id: 'sb1', name: 'Tuesday', banks },
      { type: 'soundBoard.load', banks, activeId: 'sb1' },
      { type: 'soundPad.remove', bankId: 'b1', padId: 'p1' },
    )
    expect(s.soundBanks[0].pads).toEqual([])
    const preset = s.savedBoards.find((b) => b.id === 'sb1')
    expect(preset?.banks[0].pads).toEqual([pad('p1')]) // preset untouched
  })

  it('updates and renames a saved board', () => {
    const s = run(
      { type: 'soundBoard.saveNew', id: 'sb1', name: 'Tuesday', banks },
      { type: 'soundBoard.rename', id: 'sb1', name: 'Corporate' },
      { type: 'soundBoard.update', id: 'sb1', banks: [] },
    )
    expect(s.savedBoards.find((b) => b.id === 'sb1')).toEqual({ id: 'sb1', name: 'Corporate', banks: [] })
  })

  it('deleting the board you are on keeps your pads and only drops the marker', () => {
    const s = run(
      { type: 'soundBoard.saveNew', id: 'sb1', name: 'Tuesday', banks },
      { type: 'soundBoard.load', banks, activeId: 'sb1' },
      { type: 'soundBoard.remove', id: 'sb1' },
    )
    expect(s.savedBoards.find((b) => b.id === 'sb1')).toBeUndefined()
    expect(s.activeBoard).toBeNull() // off the deleted one; nothing auto-selected
    expect(s.soundBanks).toEqual(banks) // the pads on screen are yours now
  })

  it('deleting a different board leaves the marker alone', () => {
    const s = run(
      { type: 'soundBoard.saveNew', id: 'sb1', name: 'One', banks },
      { type: 'soundBoard.saveNew', id: 'sb2', name: 'Two', banks },
      { type: 'soundBoard.setActive', id: 'sb1' },
      { type: 'soundBoard.remove', id: 'sb2' },
    )
    expect(s.activeBoard).toBe('sb1')
  })
})

describe('a board ships, so the picker has something to name', () => {
  it('opens on a named board rather than on nothing', () => {
    // The bug this fixes is bigger than an empty list: with activeBoard null,
    // `dirty` can never be true, so the Update button could never render. The
    // feature was there and unreachable.
    const fresh = createInitialState()
    expect(fresh.savedBoards).toHaveLength(1)
    expect(fresh.savedBoards[0].name).toBe('ComedySportz — Standard')
    expect(fresh.activeBoard).toBe(fresh.savedBoards[0].id)
  })

  it('seeds from the live board, so an install with tabs is not instantly dirty', () => {
    const mine = [{ id: 'b1', name: 'Walk-ons', pads: [] }]
    const [seeded] = normSavedBoards(undefined, mine)
    expect(seeded.banks).toEqual(mine)
  })

  it('seeds when the saved list is present but empty', () => {
    // The state this actually had to repair: savedBoards: [] persisted from
    // before a board shipped.
    expect(normSavedBoards([], [])).toHaveLength(1)
  })

  it('leaves a real saved list alone', () => {
    const boards = normSavedBoards([{ id: 'mine', name: 'Mine', banks: [] }], [])
    expect(boards.map((b) => b.id)).toEqual(['mine'])
  })

  it('points activeBoard at a board that exists', () => {
    const boards = [{ id: 'a', name: 'A', banks: [] }, { id: 'b', name: 'B', banks: [] }]
    expect(normActiveBoard('b', boards)).toBe('b')
    expect(normActiveBoard('gone', boards)).toBe('a') // stale id falls to the first
    expect(normActiveBoard(undefined, boards)).toBe('a')
    expect(normActiveBoard('a', [])).toBeNull()
  })
})

describe('normSavedBoards', () => {
  it('drops junk and runs banks through the same check as the live board', () => {
    const boards = normSavedBoards([
      { id: 'ok', name: 'Good', banks: [{ id: 'b1', name: 'A', pads: [{ id: 'p1', trackId: '/m/a.mp3', label: 'A' }] }] },
      { id: 'no-name' },
      'nonsense',
      { id: 'empty', name: 'Empty', banks: 'not an array' },
    ])
    expect(boards.map((b) => b.id)).toEqual(['ok', 'empty'])
    // A pad with no `kind` predates tag pads and is a song pad.
    expect(boards[0].banks[0].pads[0]).toEqual({ id: 'p1', kind: 'track', trackId: '/m/a.mp3', label: 'A' })
    expect(boards[1].banks).toEqual([])
  })

  it('keeps trackName when it is there and omits it when it is not', () => {
    const withName = normSoundBanks([
      { id: 'b1', name: 'A', pads: [{ id: 'p1', kind: 'track', trackId: '/m/a.mp3', trackName: 'a', label: 'A' }] },
    ])
    expect(withName[0].pads[0]).toEqual({ id: 'p1', kind: 'track', trackId: '/m/a.mp3', trackName: 'a', label: 'A' })
    const without = normSoundBanks([
      { id: 'b1', name: 'A', pads: [{ id: 'p1', kind: 'track', trackId: '/m/a.mp3', label: 'A' }] },
    ])
    expect(without[0].pads[0]).not.toHaveProperty('trackName')
  })
})

describe('normSoundBanks', () => {
  it('drops junk banks and pads from a hand-edited or older state file', () => {
    expect(
      normSoundBanks([
        { id: 'b1', name: 'ok', pads: [{ id: 'p1', trackId: '/a' }, { nope: true }, null] },
        { id: 'no-name' },
        'garbage',
      ]),
    ).toEqual([
      { id: 'b1', name: 'ok', pads: [{ id: 'p1', kind: 'track', trackId: '/a', label: '' }] },
    ])
  })

  it('returns an empty list when the field is missing entirely', () => {
    expect(normSoundBanks(undefined)).toEqual([])
  })
})

describe('soundboard playback commands', () => {
  it('records which track a cue asked for and bumps the nonce', () => {
    const s = run({ type: 'sound.play', id: '/m/song.mp3' })
    expect(s.soundCueTrackId).toBe('/m/song.mp3')
    expect(s.soundCueNonce).toBe(1)
  })

  it('bumps the nonce again for the same track, so a re-tap re-triggers', () => {
    const s = run({ type: 'sound.play', id: '/m/a' }, { type: 'sound.play', id: '/m/a' })
    expect(s.soundCueNonce).toBe(2)
  })

  it('stops without touching the reveal, unlike the reveal STOP', () => {
    const before = run({ type: 'display.reveal', scene: 'scoreboard' })
    const after = reduce(before, { type: 'sound.stop' })
    expect(after.soundStopNonce).toBe(before.soundStopNonce + 1)
    expect(after.revealPhase).toBe(before.revealPhase)
    expect(after.stopNonce).toBe(before.stopNonce)
    expect(after.scene).toBe(before.scene)
  })

  it('clamps a negative seek rather than passing it to the audio element', () => {
    expect(run({ type: 'sound.seek', seconds: -12 }).soundSeekTo).toBe(0)
  })

  it('records the seek target and bumps its nonce', () => {
    const s = run({ type: 'sound.seek', seconds: 42.5 })
    expect(s.soundSeekTo).toBe(42.5)
    expect(s.soundSeekNonce).toBe(1)
  })
})

describe('tag pads', () => {
  it('keeps a tag pad through normalization, defaulting an unknown mode to random', () => {
    expect(
      normSoundBanks([
        {
          id: 'b1',
          name: 'ok',
          pads: [
            { id: 'p1', kind: 'tag', tag: 'run in', mode: 'continuous', label: 'RUN IN' },
            { id: 'p2', kind: 'tag', tag: 'rap', mode: 'nonsense', label: 'RAP' },
            { id: 'p3', kind: 'tag', label: 'no tag' },
          ],
        },
      ])[0].pads,
    ).toEqual([
      { id: 'p1', kind: 'tag', tag: 'run in', mode: 'continuous', label: 'RUN IN' },
      { id: 'p2', kind: 'tag', tag: 'rap', mode: 'random', label: 'RAP' },
    ])
  })

  it('reads a pad saved before tag pads existed as a song pad', () => {
    // No `kind` in the file: it predates the union and is a track pad.
    expect(normSoundBanks([{ id: 'b1', name: 'ok', pads: [{ id: 'p1', trackId: '/a' }] }])[0].pads).toEqual([
      { id: 'p1', kind: 'track', trackId: '/a', label: '' },
    ])
  })

  it('records the tag and mode a tag pad asked for', () => {
    const s = run({ type: 'sound.playTag', tag: 'run in', mode: 'continuous' })
    expect(s.soundTagCue).toEqual({ tag: 'run in', mode: 'continuous' })
    expect(s.soundTagCueNonce).toBe(1)
  })

  it('bumps the nonce on a re-tap of the same tag pad', () => {
    const s = run(
      { type: 'sound.playTag', tag: 'rap', mode: 'random' },
      { type: 'sound.playTag', tag: 'rap', mode: 'random' },
    )
    expect(s.soundTagCueNonce).toBe(2)
  })
})

describe('moving a pad between banks', () => {
  const twoBanks = () =>
    run(
      { type: 'soundBank.add', id: 'b1', name: 'one' },
      { type: 'soundBank.add', id: 'b2', name: 'two' },
      {
        type: 'soundPad.add',
        bankId: 'b1',
        pads: [
          { id: 'p1', kind: 'track', trackId: '/a', label: 'A' },
          { id: 'p2', kind: 'track', trackId: '/b', label: 'B' },
        ],
      },
    )

  it('takes the pad out of one bank and appends it to the other', () => {
    const s = reduce(twoBanks(), {
      type: 'soundPad.move',
      fromBankId: 'b1',
      toBankId: 'b2',
      padId: 'p1',
    })
    expect(s.soundBanks[0].pads.map((p) => p.id)).toEqual(['p2'])
    expect(s.soundBanks[1].pads.map((p) => p.id)).toEqual(['p1'])
  })

  it('carries the pad whole, including the mode of a tag pad', () => {
    const start = run(
      { type: 'soundBank.add', id: 'b1', name: 'one' },
      { type: 'soundBank.add', id: 'b2', name: 'two' },
      {
        type: 'soundPad.add',
        bankId: 'b1',
        pads: [{ id: 'p1', kind: 'tag', tag: 'house', mode: 'continuous', label: 'HOUSE' }],
      },
    )
    const s = reduce(start, { type: 'soundPad.move', fromBankId: 'b1', toBankId: 'b2', padId: 'p1' })
    expect(s.soundBanks[1].pads[0]).toEqual({
      id: 'p1',
      kind: 'tag',
      tag: 'house',
      mode: 'continuous',
      label: 'HOUSE',
    })
  })

  it('does nothing when the pad or bank is unknown, rather than losing the pad', () => {
    const start = twoBanks()
    expect(reduce(start, { type: 'soundPad.move', fromBankId: 'b1', toBankId: 'b2', padId: 'nope' })).toEqual(start)
    expect(reduce(start, { type: 'soundPad.move', fromBankId: 'b1', toBankId: 'zzz', padId: 'p1' }).soundBanks[0].pads).toHaveLength(2)
  })

  it('is a no-op when dropped on its own bank', () => {
    const start = twoBanks()
    expect(reduce(start, { type: 'soundPad.move', fromBankId: 'b1', toBankId: 'b1', padId: 'p1' })).toEqual(start)
  })
})
