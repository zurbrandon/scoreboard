// Bundles the Electron main and preload scripts (TypeScript) to CommonJS in
// dist-electron/. Kept explicit and tiny — no framework magic.

import { build } from 'esbuild'

const common = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: true,
  // Electron provides its own runtime; never bundle it. electron-updater is
  // external too — it resolves its providers through dynamic requires, which a
  // bundler can only get wrong, and electron-builder already ships the real
  // package inside the asar as a production dependency.
  external: ['electron', 'electron-updater'],
  logLevel: 'info',
}

await Promise.all([
  build({ ...common, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.cjs' }),
  build({ ...common, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs' }),
])
