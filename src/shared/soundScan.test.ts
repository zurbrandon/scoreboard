import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { findAudioFiles, isAudioFile, trackName } from './soundScan'

// A real tree on disk — the point of this test is the filesystem behavior.
const root = mkdtempSync(join(tmpdir(), 'showboard-scan-'))
const touch = (p: string) => writeFileSync(p, '')

mkdirSync(join(root, 'beats/rap'), { recursive: true })
mkdirSync(join(root, '.hidden-cache'), { recursive: true })
mkdirSync(join(root, 'unreadable-name-only'), { recursive: true })
touch(join(root, 'top.mp3'))
touch(join(root, 'notes.txt'))
touch(join(root, 'cover.JPG'))
touch(join(root, 'beats/one.WAV')) // uppercase extension
touch(join(root, 'beats/rap/deep.m4a'))
touch(join(root, '.hidden-cache/ignored.mp3'))
touch(join(root, '.dotfile.mp3'))

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('findAudioFiles', () => {
  const names = () => findAudioFiles(root).map((p) => basename(p)).sort()

  it('recurses into subfolders', () => {
    expect(names()).toContain('deep.m4a')
    expect(names()).toContain('one.WAV')
  })

  it('matches extensions case-insensitively and ignores non-audio files', () => {
    expect(names()).toEqual(['deep.m4a', 'one.WAV', 'top.mp3'])
  })

  it('skips dot-folders and dot-files', () => {
    expect(names()).not.toContain('ignored.mp3')
    expect(names()).not.toContain('.dotfile.mp3')
  })

  it('returns an empty list for a folder that does not exist', () => {
    expect(findAudioFiles(join(root, 'nope'))).toEqual([])
  })

  it('stops at the depth cap instead of descending forever', () => {
    expect(findAudioFiles(root, 0).map((p) => basename(p))).toEqual(['top.mp3'])
    expect(findAudioFiles(root, 1).map((p) => basename(p)).sort()).toEqual(['one.WAV', 'top.mp3'])
  })

  it('does not follow symlinked directories', () => {
    symlinkSync(root, join(root, 'beats/loop'), 'dir')
    expect(() => findAudioFiles(root)).not.toThrow()
    expect(names()).toEqual(['deep.m4a', 'one.WAV', 'top.mp3'])
  })
})

describe('isAudioFile / trackName', () => {
  it('accepts every supported extension in any casing', () => {
    expect(isAudioFile('a.FLAC')).toBe(true)
    expect(isAudioFile('a.ogg')).toBe(true)
    expect(isAudioFile('a.mp4')).toBe(false)
  })

  it('strips only the extension, leaving dots in the name alone', () => {
    expect(trackName('Mr. Blue Sky.mp3')).toBe('Mr. Blue Sky')
  })
})
