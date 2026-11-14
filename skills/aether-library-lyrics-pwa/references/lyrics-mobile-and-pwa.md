# Synchronized Lyrics, Dedicated Mobile UI & PWA Packaging

## Lyrics parsing & reader geometry (`src/services/lyrics.ts`, `lyricsLayout.ts`, `LyricsView.tsx`)

1. **Decoding (`readLyricsFile`):**
   - `.lrc` or `.txt` up to `400 KB` / `100,000` chars.
   - Detects `FF FE` (`utf-16le`), `FE FF` (`utf-16be`), else `utf-8` with `TextDecoder(encoding, { fatal: true })`.
2. **Parsing (`parseLyrics`):**
   - Supports multiple `[mm:ss.xxx]` stamps per line (chorus repeats), `[offset: +/-ms]`, and simultaneous lines sharing the exact same timestamp (bilingual/translated lines highlight together).
   - Mixed files with timed lines ignore untimed `[ar:...]`, `[ti:...]` metadata tags rather than inventing `0:00` timestamps.
   - Binary search (`activeLyricIndex`) locates the active timestamp in `O(log n)`.
3. **Reader container & scroll behavior:**
   - Must use a bounded flex/grid scroll viewport (`min-height: 0; overflow-y: auto; overflow-anchor: none`) so percentage heights never push transport controls off-screen.
   - Adjustable font size (`16px`–`32px`), `overflow-wrap: anywhere` for long unbroken strings, and keyboard scrollability (`tabIndex={0}`).
   - Center active line within the reader box, **except** when a single line is taller than the viewport—align near top so its start remains readable.
   - User scroll/wheel/touch/arrow keys pause auto-follow for **5,000 ms**; clicking **Follow lyrics** resumes immediately; track change resets follow state.

## Mobile layout (`src/mobile.css`, `MobileBottomNav.tsx`)

- Five primary phone destinations + focus-managed **More** bottom sheet (Hi-Res Vault, Sound Assistant, Backup & Sync, Playback Settings, 5 Themes, and Admin when role === `"admin"`).
- Mini-player dock stays hidden on phone until `currentTrack !== null`.
- Respect `env(safe-area-inset-bottom)` and short landscape viewports (`844x390`).

## GitHub Pages & PWA (`scripts/finalize-pwa.mjs`, `public/sw.js`)

- `npm run build:pages` builds with `AETHER_BASE_PATH=/Music-player-/` and `import.meta.env.VITE_STATIC_HOST === true`.
- When `VITE_STATIC_HOST` is true and no custom companion server URL is configured in Backup & Sync, AI and server-snapshot features display clear setup guidance instead of calling a nonexistent `/Music-player-/api/*` endpoint.
- `finalize-pwa.mjs` hashes base + JS/CSS asset list + SVG artwork + manifest JSON into a 12-char revision injected into `dist/sw.js` and writes `dist/.nojekyll` for GitHub Pages.
