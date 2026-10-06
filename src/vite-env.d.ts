/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Giphy API key (from .env.local — gitignored). Powers the GIF search. */
  readonly VITE_GIPHY_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Electron's <webview> tag (the web page slide). React doesn't know it, so it
// gets the plain element props plus the two attributes the scene sets.
declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        partition?: string
      }
    }
  }
}
