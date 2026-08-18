// Image helpers shared by the slide editor and the settings panels: resolving a
// stored logo `src` to something an <img> can load, and turning an uploaded /
// dropped file into a downscaled data URL. Bundled paths (e.g. 'logos/foo.png')
// resolve against BASE_URL; uploads are data: URLs used as-is.

export function logoImgSrc(src: string): string {
  return src.startsWith('data:') ? src : `${import.meta.env.BASE_URL}${src}`
}

// Read a File/Blob into a data URL.
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => res(fr.result as string)
    fr.onerror = () => rej(fr.error)
    fr.readAsDataURL(blob)
  })
}

// Downscale a data-URL image to a max dimension and re-encode. Logos keep PNG
// (transparency); full-screen image slides use JPEG to keep the data URL small.
export async function downscaleDataUrl(
  dataUrl: string,
  maxDim: number,
  mime: 'image/png' | 'image/jpeg' = 'image/png',
  quality?: number,
): Promise<string> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  if (scale >= 1 && mime === 'image/png') return dataUrl // already small enough
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL(mime, quality)
}

// Uploaded logo → downscaled PNG data URL (transparency preserved).
export async function fileToLogoSrc(file: File, maxDim = 800): Promise<string> {
  return downscaleDataUrl(await blobToDataUrl(file), maxDim)
}

// A dropped file → a downscaled JPEG data URL for a full-screen image slide.
export async function fileToImageSrc(file: File): Promise<string> {
  return downscaleDataUrl(await blobToDataUrl(file), 1600, 'image/jpeg', 0.85)
}

// A URL dragged from a website → a data URL. Electron downloads it in main (no
// CORS); browser-dev tries a fetch and otherwise falls back to the live URL.
export async function urlToImageSrc(url: string): Promise<string> {
  const bridge = window.showboard
  if (bridge) {
    const downloaded = await bridge.downloadImage(url)
    if (downloaded) return downscaleDataUrl(downloaded, 1600, 'image/jpeg', 0.85)
    return url
  }
  try {
    const res = await fetch(url)
    if (!res.ok) return url
    const dataUrl = await blobToDataUrl(await res.blob())
    return downscaleDataUrl(dataUrl, 1600, 'image/jpeg', 0.85)
  } catch {
    return url // fall back to referencing the URL directly
  }
}
