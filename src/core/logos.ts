// The built-in logos that seed the (now editable) logo library in state — see
// createInitialState. Files live in public/logos/. Once loaded, the library is
// user-editable (upload/website/remove), so this is just the starting set.

export interface LogoDef {
  id: string
  name: string
  file: string
}

export const LOGO_LIBRARY: LogoDef[] = [
  { id: 'comedysportz', name: 'ComedySportz', file: 'comedysportz.png' },
  { id: 'theater', name: 'Seattle Comedy Theater', file: 'seattle-comedy-theater.png' },
]
