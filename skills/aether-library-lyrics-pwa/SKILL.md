---
name: aether-library-lyrics-pwa
description: Maintain and extend Aether's offline IndexedDB library, SHA-256 audio import/deduplication, metadata/artwork parsing, LRC/SYLT synchronized lyrics reader, `.aetherjson` backup validation, dedicated mobile UI, and base-path-aware GitHub Pages PWA service worker. Use when working on local library storage, imports, playlists, tag editing, lyrics, backups, mobile layout, or PWA/Pages builds.
---

# Aether Offline Library, Lyrics, Mobile & PWA

You are the client-storage, media-library, and offline PWA engineer for Aether. Your job is to keep Aether fast, resilient, accessible, and genuinely offline-first across desktop browsers, mobile phones, GitHub Pages (`/Music-player-/`), and Capacitor Android.

## Core outcome

Deliver library, lyrics, mobile, and PWA changes that:
- preserve existing `AetherAudioDB` IndexedDB records, playlists, favorites, and user-edited tags without data loss;
- keep SHA-256 content-hash track IDs deterministic so re-importing an audio file relinks restored `.aetherjson` metadata seamlessly;
- sanitize untrusted tag strings, lyrics encodings, and backup JSON (blocking arbitrary remote `http(s)` URLs in backup payloads);
- maintain a bounded, accessible, wrap-safe synchronized lyrics reader with manual-scroll pause and fullscreen reading;
- keep mobile (`src/mobile.css`) and desktop (`src/index.css`) layouts cleanly separated with proper safe areas, focus traps, and touch targets;
- ensure production and GitHub Pages (`npm run build:pages`) builds precache all lazy chunks and bundled artwork under the configured base path.

## When to use this skill

Use for:
- `src/services/db.ts`, `importTracks.ts`, `sampleLibrary.ts`, `backupSchema.ts`, `deployment.ts`;
- `src/services/lyrics.ts`, `lyricsLayout.ts`, `src/components/LyricsView.tsx`, `TrackTagEditor.tsx`;
- `src/components/LibraryExperience.tsx`, `SongList.tsx`, `AlbumsView.tsx`, `PlaylistsView.tsx`, `ImportDropzone.tsx`, `BackupSyncCenter.tsx`;
- `src/components/MobileBottomNav.tsx`, `Sidebar.tsx`, `PlayerDock.tsx`, `useDialogFocus.ts`, `src/mobile.css`, `src/index.css`;
- `public/manifest.json`, `public/sw.js`, `scripts/finalize-pwa.mjs`, `vite.config.ts`, `.github/workflows/pages.yml`.

## Operating principles & non-negotiable invariants

1. **Deterministic SHA-256 track IDs & relinking (`importTracks.ts`, `db.ts`).**
   - Local file imports compute `SHA-256` over the audio bytes as `track.id`.
   - If `tracks` already holds a metadata record for that `id` (e.g., from a restored `.aetherjson` backup or prior edit), merge so user-edited tags/play counts survive while attaching the newly imported audio blob.
   - Strip ephemeral `audioUrl` (`blob:` / ticket URLs) before persisting to IndexedDB `tracks`.
   - Never claim tag editing modifies the user's original file on disk—tag edits update IndexedDB records only.
2. **Strict backup & artwork sanitization (`backupSchema.ts`).**
   - `.aetherjson` backups are **metadata-only** (`trackMetadata`, `playlists`, `favorites`, `settings`, `eqSettings`); never serialize raw audio blobs into JSON backups.
   - `artwork` in `backupSchema` permits **only** controlled CSS `linear-gradient(...)`, `data:image/(png|jpeg|webp|gif);base64,...` (`<= 1.4 MB`), or root-relative `/...` asset paths—never arbitrary external `http://` or `https://` tracking/exfiltration URLs.
   - Deduplicate `trackMetadata`, `playlists`, `playlist.trackIds`, and `favorites` inside `validateBackup()`.
3. **Hi-Res & synthesized demo honesty (`importTracks.ts`, `sampleLibrary.ts`).**
   - `isHiRes` requires `bitDepth >= 24 && sampleRate >= 96000`.
   - The 5 bundled 25-second 24-bit/96 kHz WAV tracks in `sampleLibrary.ts` are synthesized `OfflineAudioContext` demos with presentation-layer landscape SVG covers—never describe them as studio recordings, DSD, or proof of hardware DAC sample rate.
4. **Synchronized lyrics integrity (`lyrics.ts`, `lyricsLayout.ts`, `LyricsView.tsx`).**
   - Decode `.lrc` / `.txt` (`<= 400 KB`, `<= 100,000` chars) with fatal `TextDecoder` (`utf-8`, BOM `utf-16le`, BOM `utf-16be`); reject legacy non-UTF encodings with a clear message instead of mojibake.
   - Parse `[mm:ss.xx]` timestamps and `[offset: +/-ms]`; highlight simultaneous same-timestamp lines (e.g., lyric + translation) together; extract embedded ID3 `SYLT` only when `timeStampFormat === 2` (milliseconds—never treat MPEG frame counts as ms).
   - Automatic sidecar matching (`findLyricsTarget`) must require **exact unique match** (`matches.length === 1`) against `originalFileName`, `title`, or `artist - title`; surface a clear disambiguation message on `0` or `>1` matches.
   - Keep the lyrics scroll container strictly bounded above transport controls, wrap long unbroken lines, align oversized lines near the top so beginnings are never clipped, pause auto-follow for **5 seconds** on manual user scroll/key input, and offer an immediate **Follow lyrics** button.
5. **Dedicated mobile layout & dialog accessibility (`src/mobile.css`, `useDialogFocus.ts`).**
   - Phone layout uses 5 primary bottom tabs + a focus-managed **More** sheet; hide the mini-player until a track is actually loaded.
   - Keep mobile overrides in `src/mobile.css` so desktop listening-room styles in `src/index.css` do not regress.
   - Every modal/sheet (`EqualizerModal`, `TrackTagEditor`, `ImportDropzone`, `AuthDialog`, `AccountDialog`, More sheet) must trap/manage focus (`useDialogFocus`), support `Escape`, and restore focus to its trigger.
6. **Base-path-aware PWA & GitHub Pages (`deployment.ts`, `scripts/finalize-pwa.mjs`, `public/sw.js`).**
   - Always resolve bundled public assets (`art/landscape-*.svg`, icons) via `assetUrl()` (`import.meta.env.BASE_URL`), never hardcoded root `"/art/..."`, so `/Music-player-/` on GitHub Pages works identically to `/` on Express/Capacitor.
   - `finalize-pwa.mjs` injects a content-hashed cache revision, rewrites `manifest.json` `id`/`scope`/`start_url` to `base`, precaches all built `dist/assets/*.{js,css}` (including lazy `music-metadata` parsers) + `dist/art/*.svg`, and writes `dist/.nojekyll` in `--pages` mode.
   - `public/sw.js` must never intercept `/api/` calls or paths outside its project scope.

## Workflow

### Phase 1 — Inspect data & UI flow
1. Check `src/types.ts`, `src/services/db.ts`, and `src/services/backupSchema.ts` before changing any persisted field.
2. If adding a new setting or metadata property, add backward-compatible defaults in `backupSchema.ts` and verify restore/export round-tripping.

### Phase 2 — Implement & protect UX states
1. Handle loading, empty library, search-no-results, storage-quota/import error, and static-host (`VITE_STATIC_HOST`) states explicitly.
2. Check responsive behavior across `320`, `360`, `390`, `430`, `768`, `1280`, and `1536` px widths with zero horizontal overflow.

### Phase 3 — Verify
1. Run `npm run lint` and `npm test` (`backup.test.ts`, `lyrics.test.ts`, `lyrics-reader.test.ts`, `mobile-navigation.test.ts`, `presentation.test.ts`, `deployment.test.ts`, `wav.test.ts`).
2. Run both `npm run build` and `npm run build:pages` and verify `dist/manifest.json`, `dist/sw.js`, and `dist/.nojekyll` when touching asset paths or PWA scripts.

Use `checklists/offline-pwa-checklist.md` before finishing.

## Reference guide

- IndexedDB schema, SHA-256 imports & `.aetherjson` validation: `references/storage-import-and-backups.md`
- LRC/SYLT lyrics reader, mobile sheet UX & GitHub Pages PWA: `references/lyrics-mobile-and-pwa.md`
- Pre-completion QA checklist: `checklists/offline-pwa-checklist.md`
