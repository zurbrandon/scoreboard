/** What people type is "google.com", not "https://google.com". Without a
 *  scheme the browser reads it as a path on the app's own page, so give a bare
 *  address https:// (and leave anything that already has a scheme alone). */
export function webAddress(raw: string): string {
  const url = raw.trim()
  if (!url || /^[a-z][a-z0-9+.-]*:/i.test(url)) return url
  return `https://${url.replace(/^\/+/, '')}`
}
