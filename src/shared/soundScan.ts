// Finding audio files under a folder, recursively. Lives here rather than in the
// Electron main process so it can be tested against a real directory tree — the
// edge cases (nesting, dot-folders, junk files, runaway depth) are exactly the
// kind that only show up on someone's actual music drive.

import { readdirSync } from 'node:fs'
import { join } from 'node:path'

export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']

/** Absolute paths of every audio file under `folder`, depth-capped so a deep or
 *  symlink-looped tree can't wedge the scan. Dot-folders (and dot-files) are
 *  skipped: they're caches and resource forks, never someone's music. Unreadable
 *  subfolders are stepped over rather than failing the whole scan. */
export function findAudioFiles(folder: string, maxDepth = 8, depth = 0): string[] {
  if (depth > maxDepth) return []
  const found: string[] = []
  let entries
  try {
    entries = readdirSync(folder, { withFileTypes: true })
  } catch {
    return [] // unreadable folder: skip it, keep the rest of the scan
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = join(folder, entry.name)
    // isDirectory() is false for symlinks, so a self-referential link is simply
    // never followed — the depth cap is a backstop, not the only guard.
    if (entry.isDirectory()) found.push(...findAudioFiles(full, maxDepth, depth + 1))
    else if (entry.isFile() && isAudioFile(entry.name)) found.push(full)
  }
  return found
}

export function isAudioFile(name: string): boolean {
  const lower = name.toLowerCase()
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/** Display name for a track: the filename without its extension. */
export function trackName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}
