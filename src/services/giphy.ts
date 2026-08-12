// Giphy search — live GIF lookup for the operator's overlay tool. The key comes
// from .env.local (VITE_GIPHY_KEY), which is gitignored so it never hits the repo.
// Giphy's API is CORS-enabled, so the fetch runs straight from the renderer.

const KEY = import.meta.env.VITE_GIPHY_KEY

export interface Gif {
  id: string
  preview: string // small looping preview for the results grid
  full: string // full-size url shown on the projector
  title: string
}

interface GiphyImage {
  url?: string
}
interface GiphyItem {
  id: string
  title?: string
  images?: Record<string, GiphyImage>
}

function mapResults(items: GiphyItem[]): Gif[] {
  return items
    .map((g) => ({
      id: g.id,
      preview: g.images?.fixed_width?.url ?? g.images?.downsized?.url ?? '',
      full: g.images?.original?.url ?? g.images?.downsized_large?.url ?? '',
      title: g.title ?? '',
    }))
    .filter((g) => g.preview && g.full)
}

export const giphyReady = Boolean(KEY)

// Search when there's a query; trending when it's empty (so the popover isn't
// blank on open). Throws on network/HTTP errors so the caller can show a message.
export async function searchGifs(query: string, signal?: AbortSignal): Promise<Gif[]> {
  if (!KEY) throw new Error('Missing Giphy API key (VITE_GIPHY_KEY)')
  const q = query.trim()
  const base = q
    ? `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(q)}&`
    : 'https://api.giphy.com/v1/gifs/trending?'
  const url = `${base}api_key=${KEY}&limit=24&rating=pg-13`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Giphy request failed (${res.status})`)
  const json = (await res.json()) as { data?: GiphyItem[] }
  return mapResults(json.data ?? [])
}
