# Aether Offline Library, Lyrics, Mobile & PWA Skill

Playbook for Aether's IndexedDB persistence, SHA-256 track import/deduplication, `.aetherjson` metadata backups, LRC/SYLT synchronized lyrics reader, dedicated phone navigation, and base-path-aware PWA builds.

## Contents

- `SKILL.md` — storage, sanitization, lyrics, mobile, and PWA invariants and workflow.
- `references/storage-import-and-backups.md` — `AetherAudioDB` stores, SHA-256 relinking, memory caps, and Zod backup rules.
- `references/lyrics-mobile-and-pwa.md` — LRC encoding/timestamp rules, reader scroll geometry, mobile safe-area patterns, and `/Music-player-/` Pages service worker.
- `checklists/offline-pwa-checklist.md` — persistence, security, accessibility, mobile, and PWA build checklist.

## Suggested smoke test

> Use the `aether-library-lyrics-pwa` skill. Inspect `src/services/lyrics.ts`, `src/services/backupSchema.ts`, and `scripts/finalize-pwa.mjs`, verify UTF-16 BOM lyrics parsing, `.aetherjson` URL sanitization, and `/Music-player-/` GitHub Pages PWA output, and run `npm test` and `npm run build:pages`.
