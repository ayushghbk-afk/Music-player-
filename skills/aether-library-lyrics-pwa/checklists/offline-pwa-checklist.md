# Offline Library, Lyrics, Mobile & PWA Checklist

Mark each item pass, fail, or N/A after actual verification.

## Storage & backup safety
- [ ] `AetherAudioDB` stores (`tracks`, `audioBlobs`, `playlists`, `kv`) preserve existing user data.
- [ ] Ephemeral `audioUrl` values are never persisted into IndexedDB or `.aetherjson` exports.
- [ ] SHA-256 content-hash IDs relink restored metadata without overwriting user-edited tags.
- [ ] `backupSchema` validates new settings/fields with safe defaults and blocks external `http(s)` `coverArt` URLs.

## Lyrics & tag editing
- [ ] UTF-8 and BOM-marked UTF-16LE/BE `.lrc`/`.txt` files decode cleanly; invalid encodings fail with an actionable error.
- [ ] Simultaneous timestamps highlight together; oversized lines do not clip their opening words; manual scrolling pauses follow for 5s.
- [ ] Sidecar matching (`findLyricsTarget`) rejects ambiguous (`>1`) matches instead of guessing.

## Mobile, responsive & accessibility
- [ ] Phone styles live cleanly in `src/mobile.css` without breaking desktop layout in `src/index.css`.
- [ ] No horizontal overflow at `320`, `360`, `390`, `430`, `768`, `1280`, or `1536` px.
- [ ] Modals and sheets manage keyboard focus (`useDialogFocus`), support `Escape`, and have accessible control labels.

## PWA & static hosting
- [ ] Public assets use `assetUrl()` (`BASE_URL`-aware), never hardcoded leading `/` paths.
- [ ] `npm run build` and `npm run build:pages` both succeed.
- [ ] `dist/sw.js` precaches built JS/CSS/artwork and ignores `/api/` routes.
