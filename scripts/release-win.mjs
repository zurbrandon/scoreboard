// Cuts a Windows release and publishes it to GitHub.
//
// Why this exists rather than a bare `electron-builder --win --publish always`:
// electron-builder runs its publish tasks CONCURRENTLY (installer, blockmap,
// manifest), and when the release doesn't exist yet they all race to create it.
// Observed twice in one sitting: once the loser 422'd and latest.yml never
// uploaded — leaving a release the updater can't read — and once both won,
// producing two releases on the same tag whose manifests described a different
// binary than the one attached. Creating the tag and the (empty) release FIRST
// removes the race: every task then finds a release already there and only
// uploads into it.
//
// Also pins the tag to the commit being built. Left to GitHub, a published
// release with no tag gets one created at the default branch head, which is
// usually NOT the code you just built.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// With stdio 'inherit' the output goes straight to the terminal and
// execFileSync returns null, so there's nothing to trim.
const run = (cmd, args, opts = {}) =>
  (execFileSync(cmd, args, { encoding: 'utf-8', stdio: 'pipe', ...opts }) ?? '').trim()

const { version } = JSON.parse(readFileSync('package.json', 'utf-8'))
const tag = `v${version}`

// A release is a public, permanent thing; refuse to cut one from a dirty tree,
// because the tag would then point at something that isn't what shipped.
if (run('git', ['status', '--porcelain'])) {
  console.error('✗ Working tree is dirty. Commit before releasing.')
  process.exit(1)
}

const head = run('git', ['rev-parse', 'HEAD'])

let tagged
try {
  tagged = run('git', ['rev-parse', `${tag}^{commit}`])
} catch {
  tagged = null
}

if (!tagged) {
  console.log(`• tagging ${tag} at ${head.slice(0, 7)}`)
  run('git', ['tag', tag, head])
} else if (tagged !== head) {
  console.error(`✗ ${tag} already exists at ${tagged.slice(0, 7)}, but HEAD is ${head.slice(0, 7)}.`)
  console.error('  Bump the version rather than moving a published tag.')
  process.exit(1)
}

console.log(`• pushing ${tag}`)
run('git', ['push', 'origin', tag], { stdio: 'inherit' })

// Create the release up front so the concurrent uploads have one target.
try {
  run('gh', ['release', 'view', tag, '--json', 'tagName'])
  console.log(`• release ${tag} already exists`)
} catch {
  console.log(`• creating release ${tag}`)
  run('gh', ['release', 'create', tag, '--title', version, '--notes', `Showboard ${version}`], {
    stdio: 'inherit',
  })
}

console.log('• building + publishing')
run('npx', ['electron-builder', '--win', '--publish', 'always'], {
  stdio: 'inherit',
  env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN || run('gh', ['auth', 'token']) },
})

// Trust nothing: the updater is useless without latest.yml, and a release that
// lacks it fails silently at check time rather than at build time.
const assets = JSON.parse(run('gh', ['release', 'view', tag, '--json', 'assets'])).assets.map(
  (a) => a.name,
)
const missing = ['latest.yml'].filter((n) => !assets.includes(n))
if (missing.length) {
  console.error(`✗ release ${tag} is missing ${missing.join(', ')} — the updater cannot read it.`)
  process.exit(1)
}
console.log(`✓ ${tag} published with ${assets.join(', ')}`)
