// Bundles the Electron main and preload scripts (TypeScript) to CommonJS in
// dist-electron/. Kept explicit and tiny — no framework magic.

import { build } from 'esbuild'

const common = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: true,
  // Electron provides its own runtime; never bundle it.
  external: ['electron'],
  logLevel: 'info',
}

await Promise.all([
  build({ ...common, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.cjs' }),
  build({ ...common, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs' }),
])
