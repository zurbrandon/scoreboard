import { describe, expect, it } from 'vitest'
import type { SoundBank } from '../core/state'
import type { SoundTrackInfo } from '../shared/bridge'
import {
  boardFileName,
  boardSignature,
  captureBoard,
  parseBoardFile,
  relinkPads,
  serializeBoard,
  standardBoard,
} from './boards'
import type { SoundSlots } from '../core/state'
import { normSoundBanks } from '../core/state'

const track = (id: string, name: string): SoundTrackInfo => ({ id, name, url: `sbmedia://${id}`, tags: [] })

const bank = (pads: SoundBank['pads']): SoundBank[] => [{ id: 'b1', name: 'Act One', pads }]

describe('relinkPads', () => {
  it('leaves a pad alone when its exact file is here', () => {
    const banks = bank([{ id: 'p1', kind: 'track', trackId: '/mine/a.mp3', trackName: 'a', label: 'A' }])
    const out = relinkPads(banks, [track('/mine/a.mp3', 'a')])
    expect(out[0].pads[0]).toEqual(banks[0].pads[0])
  })

  it('re-points a pad saved on another machine at the local copy', () => {
    // The whole reason boards carry trackName: same song, different root.
    const banks = bank([{ id: 'p1', kind: 'track', trackId: '/theirs/Music/Sting.mp3', trackName: 'Sting', label: 'STING' }])
    const out = relinkPads(banks, [track('/mine/Sounds/Sting.mp3', 'Sting')])
    expect(out[0].pads[0]).toMatchObject({ trackId: '/mine/Sounds/Sting.mp3', label: 'STING' })
  })

  it('refuses to guess when two files share a name', () => {
    // Landing on the wrong song mid-show is worse than showing it as missing.
    const banks = bank([{ id: 'p1', kind: 'track', trackId: '/theirs/Sting.mp3', trackName: 'Sting', label: 'STING' }])
    const out = relinkPads(banks, [track('/mine/live/Sting.mp3', 'Sting'), track('/mine/studio/Sting.mp3', 'Sting')])
    expect(out[0].pads[0].kind === 'track' && out[0].pads[0].trackId).toBe('/theirs/Sting.mp3')
  })

  it('leaves a pad missing when nothing matches, rather than dropping it', () => {
    const banks = bank([{ id: 'p1', kind: 'track', trackId: '/theirs/Gone.mp3', trackName: 'Gone', label: 'Gone' }])
    const out = relinkPads(banks, [track('/mine/Other.mp3', 'Other')])
    // A pad the operator can see and fix beats a pad that silently vanished.
    expect(out[0].pads).toHaveLength(1)
    expect(out[0].pads[0]).toEqual(banks[0].pads[0])
  })

  it('cannot relink a pad saved before boards existed', () => {
    // No trackName to match on; it stays put and shows as missing.
    const banks = bank([{ id: 'p1', kind: 'track', trackId: '/theirs/a.mp3', label: 'A' }])
    const out = relinkPads(banks, [track('/mine/a.mp3', 'a')])
    expect(out[0].pads[0]).toEqual(banks[0].pads[0])
  })

  it('passes tag pads straight through — a tag means the same thing anywhere', () => {
    const banks = bank([{ id: 'p1', kind: 'tag', tag: 'run-in', mode: 'continuous', label: 'Run-in' }])
    expect(relinkPads(banks, [])[0].pads[0]).toEqual(banks[0].pads[0])
  })
})

describe('captureBoard', () => {
  const banks = bank([
    { id: 'p1', kind: 'track', trackId: '/m/a.mp3', trackName: 'a', label: 'A' },
    { id: 'p2', kind: 'tag', tag: 'rap', mode: 'random', label: 'Rap' },
  ])

  it('keeps the content and the order', () => {
    const saved = captureBoard(banks)
    expect(saved[0].name).toBe('Act One')
    expect(saved[0].pads.map((p) => p.label)).toEqual(['A', 'Rap'])
    expect(saved[0].pads[0]).toMatchObject({ kind: 'track', trackId: '/m/a.mp3', trackName: 'a' })
  })

  it('gives everything fresh ids so the preset and the live board stay separate', () => {
    const saved = captureBoard(banks)
    expect(saved[0].id).not.toBe('b1')
    expect(saved[0].pads.map((p) => p.id)).not.toEqual(['p1', 'p2'])
    // Two captures of the same board must not collide either.
    expect(captureBoard(banks)[0].id).not.toBe(saved[0].id)
  })
})

describe('boardSignature', () => {
  const banks = bank([{ id: 'p1', kind: 'track', trackId: '/m/a.mp3', trackName: 'a', label: 'A' }])

  it('ignores the ids that change every time a board is stamped out', () => {
    expect(boardSignature(captureBoard(banks))).toBe(boardSignature(banks))
  })

  it('notices a rename, a new pad, a dropped pad, and a mode change', () => {
    const base = boardSignature(banks)
    expect(boardSignature([{ ...banks[0], name: 'Act Two' }])).not.toBe(base)
    expect(boardSignature([{ ...banks[0], pads: [] }])).not.toBe(base)
    expect(
      boardSignature([
        { ...banks[0], pads: [{ ...banks[0].pads[0], label: 'RENAMED' } as SoundBank['pads'][number]] },
      ]),
    ).not.toBe(base)
    const tag = bank([{ id: 'p1', kind: 'tag', tag: 'x', mode: 'random', label: 'X' }])
    const flipped = bank([{ id: 'p1', kind: 'tag', tag: 'x', mode: 'continuous', label: 'X' }])
    expect(boardSignature(tag)).not.toBe(boardSignature(flipped))
  })

  it('survives the round trip a saved board actually takes', () => {
    // capture → (relink on another machine) → still recognisably the same board.
    const saved = captureBoard(banks)
    const loaded = relinkPads(saved, [track('/elsewhere/a.mp3', 'a')])
    expect(boardSignature(loaded)).toBe(boardSignature(saved))
  })
})


describe('standardBoard', () => {
  const slots: SoundSlots = { runOut: 'run out', runIn: 'run in', captain: 'captains', drumroll: 'drum' }

  it('labels each show cue by what it does, not by its tag', () => {
    const [cues] = standardBoard(slots, [])
    expect(cues.name).toBe('Show cues')
    expect(cues.pads.map((p) => p.label)).toEqual([
      'Team runs out',
      'Team runs in',
      'Captains on the field',
      'Final score drum roll',
    ])
    expect(cues.pads.map((p) => (p.kind === 'tag' ? p.tag : ''))).toEqual([
      'run out',
      'run in',
      'captains',
      'drum',
    ])
  })

  it('puts every other tag in a second tab, without repeating the cue tags', () => {
    const [, library] = standardBoard(slots, ['run in', 'rap', 'musical'])
    expect(library.name).toBe('Library')
    expect(library.pads.map((p) => (p.kind === 'tag' ? p.tag : ''))).toEqual(['rap', 'musical'])
  })

  it('skips slots that have no tag yet', () => {
    const [cues] = standardBoard({ runOut: null, runIn: 'run in', captain: null, drumroll: null }, [])
    // A pad pointing at nothing is worse than no pad.
    expect(cues.pads).toHaveLength(1)
  })

  it('leaves out a tab that would be empty, and returns nothing on a bare install', () => {
    const noSlots: SoundSlots = { runOut: null, runIn: null, captain: null, drumroll: null }
    expect(standardBoard(noSlots, ['rap']).map((b) => b.name)).toEqual(['Library'])
    expect(standardBoard(slots, []).map((b) => b.name)).toEqual(['Show cues'])
    expect(standardBoard(noSlots, [])).toEqual([])
  })

  it('is built from tag pads only, so it means the same thing in any library', () => {
    const pads = standardBoard(slots, ['rap']).flatMap((b) => b.pads)
    expect(pads.every((p) => p.kind === 'tag')).toBe(true)
  })
})

describe('board files', () => {
  const banks = bank([
    { id: 'p1', kind: 'track', trackId: '/mine/Sting.mp3', trackName: 'Sting', label: 'STING' },
    { id: 'p2', kind: 'tag', tag: 'rap', mode: 'continuous', label: 'Rap' },
  ])

  it('round-trips a board through text', () => {
    const parsed = parseBoardFile(serializeBoard('Tuesday night', banks))
    expect(parsed?.name).toBe('Tuesday night')
    expect(parsed?.banks).toEqual(banks)
  })

  it('carries trackName, so the other machine can find the song', () => {
    const parsed = parseBoardFile(serializeBoard('T', banks))!
    const landed = relinkPads(normSoundBanks(parsed.banks), [
      { id: '/theirs/Music/Sting.mp3', name: 'Sting', url: '', tags: [] },
    ])
    expect(landed[0].pads[0]).toMatchObject({ trackId: '/theirs/Music/Sting.mp3', label: 'STING' })
  })

  it('refuses anything that is not a board, without throwing', () => {
    expect(parseBoardFile('not json at all')).toBeNull()
    expect(parseBoardFile('null')).toBeNull()
    expect(parseBoardFile('[]')).toBeNull()
    expect(parseBoardFile('{"kind":"something.else","version":1,"banks":[]}')).toBeNull()
    expect(parseBoardFile('{"kind":"showboard.soundboard","version":1}')).toBeNull() // no banks
    expect(parseBoardFile(JSON.stringify({ kind: 'showboard.soundboard', banks: [] }))).toBeNull()
  })

  it('refuses a file from a newer build but still reads an older one', () => {
    const newer = JSON.stringify({ kind: 'showboard.soundboard', version: 99, name: 'X', banks: [] })
    expect(parseBoardFile(newer)).toBeNull()
    const older = JSON.stringify({ kind: 'showboard.soundboard', version: 0, name: 'X', banks: [] })
    expect(parseBoardFile(older)).not.toBeNull()
  })

  it('names an unnamed board rather than importing a blank one', () => {
    const text = JSON.stringify({ kind: 'showboard.soundboard', version: 1, name: '   ', banks: [] })
    expect(parseBoardFile(text)?.name).toBe('Imported board')
  })

  it('hands junk banks to the normalizer rather than trusting them', () => {
    // parseBoardFile deliberately doesn't validate pads; normSoundBanks does.
    const text = JSON.stringify({
      kind: 'showboard.soundboard',
      version: 1,
      name: 'Sketchy',
      banks: [{ id: 'b1', name: 'A', pads: [{ id: 'p1' }, { nope: true }, { id: 'p2', trackId: '/m/a.mp3' }] }],
    })
    const parsed = parseBoardFile(text)!
    expect(normSoundBanks(parsed.banks)[0].pads.map((p) => p.id)).toEqual(['p2'])
  })

  it('makes a filename that is safe on every platform', () => {
    expect(boardFileName('Tuesday night')).toBe('Tuesday-night.showboard-sound.json')
    expect(boardFileName('Corporate / gig: 2026?')).toBe('Corporate-gig-2026.showboard-sound.json')
    expect(boardFileName('***')).toBe('board.showboard-sound.json')
  })
})
