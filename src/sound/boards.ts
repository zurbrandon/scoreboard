// Boards: a whole soundboard — every tab — treated as one thing you can save,
// load, hand to someone else, or start fresh from.
//
// The hard part isn't storing them, it's that a song pad holds an absolute file
// path. A board that leaves this machine has to survive the trip, which is what
// relinkPads and the export format below are for.

import type { SoundBank, SoundPad, SoundSlots } from '../core/state'
import { SOUND_SLOTS } from '../core/state'
import type { SoundTrackInfo } from '../shared/bridge'
import { newId } from '../shared/ids'
import { makeTagPad } from './pads'


/** Snapshot the live board for saving: same content, fresh ids, so the preset
 *  and the board on screen can't end up sharing a pad id and drifting into each
 *  other. Mirrors the slide templates' capture(). */
export function captureBoard(banks: readonly SoundBank[]): SoundBank[] {
  return banks.map((bank) => ({
    id: newId('bank'),
    name: bank.name,
    pads: bank.pads.map((pad) => ({ ...pad, id: newId('pad') })),
  }))
}

/** Point a saved board's song pads at this machine's copies of those songs.
 *
 *  A track pad holds an absolute path, so a board saved anywhere else resolves
 *  to nothing. Each pad is matched first on its path (the same machine, the
 *  common case) and then on the song's name. A name carried by two different
 *  files is left alone rather than guessed at — landing on the wrong song
 *  mid-show is worse than a pad that says it's missing. Tag pads need none of
 *  this: they name a tag, which means the same thing in any library. */
export function relinkPads(
  banks: readonly SoundBank[],
  library: readonly SoundTrackInfo[],
): SoundBank[] {
  const byId = new Set(library.map((t) => t.id))
  // Names that belong to exactly one file; anything ambiguous never gets in.
  const byName = new Map<string, string>()
  const ambiguous = new Set<string>()
  for (const track of library) {
    if (byName.has(track.name)) ambiguous.add(track.name)
    byName.set(track.name, track.id)
  }
  for (const name of ambiguous) byName.delete(name)

  return banks.map((bank) => ({
    ...bank,
    pads: bank.pads.map((pad) => {
      if (pad.kind !== 'track' || byId.has(pad.trackId)) return pad
      const found = pad.trackName ? byName.get(pad.trackName) : undefined
      return found ? { ...pad, trackId: found } : pad
    }),
  }))
}

/** What the board is, ignoring the ids that change every time it's stamped out.
 *  Comparing this against the saved board's is what lights the "you've changed
 *  this" dot — the same trick the slide templates use. */
export function boardSignature(banks: readonly SoundBank[]): string {
  return banks
    .map((bank) => {
      const pads = bank.pads
        .map((pad) =>
          pad.kind === 'tag'
            ? `tag:${pad.tag}:${pad.mode}:${pad.label}`
            : `track:${pad.trackName ?? pad.trackId}:${pad.label}`,
        )
        .join(',')
      return `${bank.name}[${pads}]`
    })
    .join('||')
}

// --- starting points ---------------------------------------------------------

/** The standard board, built from what this machine actually has rather than
 *  from a canned song list — a list of file paths would resolve to nothing on
 *  anyone else's machine, which is the whole reason this is computed and not a
 *  constant.
 *
 *  Two tabs. "Show cues" is the four moments the app already knows about, each
 *  pointing at whatever tag the operator set for it in Settings, and labelled by
 *  what it does ("Team runs in") rather than by the raw tag. "Library" is every
 *  other tag, so nothing in the library is more than one tap away. Tabs with
 *  nothing in them are left out entirely. */
export function standardBoard(slots: SoundSlots, tags: readonly string[]): SoundBank[] {
  const cues: SoundPad[] = []
  const spokenFor = new Set<string>()
  for (const slot of SOUND_SLOTS) {
    const tag = slots[slot.id]
    if (!tag) continue // not set up yet; a pad pointing at nothing helps no one
    spokenFor.add(tag)
    // The drum roll runs under a reveal that ends, so it plays one and stops;
    // the rest are single moments too. Nothing here wants to keep going.
    cues.push({ ...makeTagPad(tag, 'random'), label: slot.label })
  }
  const rest = tags.filter((t) => !spokenFor.has(t)).map((t) => makeTagPad(t, 'random'))

  const banks: SoundBank[] = []
  if (cues.length > 0) banks.push({ id: newId('bank'), name: 'Show cues', pads: cues })
  if (rest.length > 0) banks.push({ id: newId('bank'), name: 'Library', pads: rest })
  return banks
}

// --- handing a board to someone else -----------------------------------------

/** What a .showboard-sound file holds. Versioned from the start: these get
 *  emailed around and will outlive whatever the pad shape looks like today. */
const FILE_KIND = 'showboard.soundboard'
const FILE_VERSION = 1

export interface BoardFile {
  name: string
  banks: SoundBank[]
}

export function serializeBoard(name: string, banks: readonly SoundBank[]): string {
  return JSON.stringify({ kind: FILE_KIND, version: FILE_VERSION, name, banks }, null, 2)
}

/** Read a board someone sent you. Returns null for anything that isn't one —
 *  the wrong file, a truncated download, a newer version this build can't read.
 *  Never throws: the caller is a click on a menu item, not a place to crash.
 *
 *  Normalizing the banks is left to the caller (normSoundBanks), so a file can't
 *  smuggle in a pad shape the live board would reject. */
export function parseBoardFile(text: string): BoardFile | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const r = parsed as Record<string, unknown>
  if (r.kind !== FILE_KIND) return null
  // Only refuse what's newer than we understand; older stays readable.
  if (typeof r.version !== 'number' || r.version > FILE_VERSION) return null
  if (!Array.isArray(r.banks)) return null
  const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'Imported board'
  return { name, banks: r.banks as SoundBank[] }
}

/** A filename that won't upset any of the three platforms this ships on. */
export function boardFileName(name: string): string {
  const safe = name.replace(/[^\w \-]+/g, '').trim().replace(/\s+/g, '-') || 'board'
  return `${safe}.showboard-sound.json`
}
