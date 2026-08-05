// The logos available in the Logo scene. Pure data (ids/names/filenames) that
// both the operator picker and the projector read. Files live in public/logos/.
// Later we can make this user-editable (upload); for now it's the built-ins.

export interface LogoDef {
  id: string
  name: string
  file: string
}

export const LOGO_LIBRARY: LogoDef[] = [
  { id: 'comedysportz', name: 'ComedySportz', file: 'comedysportz.png' },
  { id: 'theater', name: 'Seattle Comedy Theater', file: 'seattle-comedy-theater.png' },
]

export function findLogo(id: string): LogoDef | undefined {
  return LOGO_LIBRARY.find((logo) => logo.id === id)
}
