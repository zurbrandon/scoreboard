import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Single-page app. The view (operator vs projector) is selected at runtime
// via the `?view=` query param — see src/main.tsx. This keeps one build that
// serves both windows, which maps cleanly onto Electron's two BrowserWindows later.
export default defineConfig({
  // Relative asset paths so the production build loads under Electron's file://.
  base: './',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
  },
})
