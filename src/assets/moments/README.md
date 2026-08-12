# Moment assets (Run out / Run in)

Drop GIFs (or PNG/WebP/JPG) here and they join the random pool for the matching
quick-trigger button on the operator's bottom row:

- `goodbye/` → shown when a team RUNS OUT of the room
- `welcome-back/` → shown when a team RUNS BACK IN

They're bundled at build time (via `import.meta.glob`), mixed in with the
built-in animated text cards, and one is picked at random each press. Filenames
don't matter. Animated GIFs play automatically. Aim for landscape / full-screen
friendly art.
