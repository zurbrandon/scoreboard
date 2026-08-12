/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Giphy API key (from .env.local — gitignored). Powers the GIF search. */
  readonly VITE_GIPHY_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
