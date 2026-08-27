// Ids are made at the call site, never inside the reducer — the reducer stays a
// pure function of (state, command) so it can be tested and replayed.
export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
