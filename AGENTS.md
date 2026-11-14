# AGENTS.md — Aether Hi-Res Audio Player

Authoritative guide for AI coding agents working in `ayushghbk-afk/Music-player-` (`com.aether.audio.player`).

## Activate the right skill first

Before editing code, read the matching `SKILL.md` in [`skills/`](skills/README.md) (also linked at `.agents/skills/` and `.claude/skills/`):

1. **UI, layout, visual refresh, responsive UX & accessibility** -> [`skills/aether-web-design/SKILL.md`](skills/aether-web-design/SKILL.md)
2. **Audio playback, RBJ/Butterworth EQ, Simple/Extreme Studio, PEQ rack, visualizers, VU & song themes** -> [`skills/aether-audio-dsp/SKILL.md`](skills/aether-audio-dsp/SKILL.md)
3. **Android Capacitor plugin, Media3 `ExoPlayer`, Java PCM16 DSP, `MediaStore` & APK builds** -> [`skills/aether-android-media3/SKILL.md`](skills/aether-android-media3/SKILL.md)
4. **Cloudflare Worker (`worker/`), Turso SQL, Backblaze B2 streaming, auth & Express `server.ts`** -> [`skills/aether-cloud-backend/SKILL.md`](skills/aether-cloud-backend/SKILL.md)
5. **IndexedDB library, SHA-256 imports, `.aetherjson` backups, LRC/SYLT lyrics, phone UI & GitHub Pages PWA** -> [`skills/aether-library-lyrics-pwa/SKILL.md`](skills/aether-library-lyrics-pwa/SKILL.md)
6. **Unit/integration tests, build matrix, live `.e2b.app` preview & honest verification reports** -> [`skills/aether-testing-and-verification/SKILL.md`](skills/aether-testing-and-verification/SKILL.md)

For cross-cutting tasks (e.g., adding a new Studio DSP control with UI + Android parity + backup persistence + tests), combine the relevant skills.

## Architecture snapshot

- **Web client (`src/`):** React 19, TypeScript 5.8, Tailwind CSS 4, Vite 6, IndexedDB (`idb`), `music-metadata`, Zod 4. Desktop styles live in `src/index.css`; dedicated phone navigation/sheet styles live in `src/mobile.css`; cloud styles live in `src/cloud.css`.
- **Companion server (`server.ts`):** Express 4 + `node:sqlite` (requires **Node >= 22.13.0**). Serves Vite HMR in dev (`0.0.0.0`, shared HTTP server so port `24678` never collides), static `dist/` in prod, 7-day `.aetherjson` sync snapshots (`/api/backup/*`), and the optional server-only LLM Sound Assistant (`/api/ai`).
- **Cloud music backend (`worker/`):** Standalone Cloudflare Worker (`worker/tsconfig.json`) connecting Turso HTTP v2 SQL and private Backblaze B2 object storage (AWS SigV4) with scrypt/legacy password verification, rotating `HttpOnly` refresh cookies, in-memory 15m access tokens, HTTP `Range` streaming, and DB-verified owner/admin roles.
- **Native Android (`android/`):** Capacitor 8 + Media3 1.5.1 (`minSdk 24`, `targetSdk 36`, Java 21). `ExoPlayer` + `MediaSessionService` + `AetherDspProcessor` (crossfaded 17-biquad PCM16 sink + stereo RMS meter) + `LocalTrackServer` / `SerialTaskQueue` import bridge + non-destructive `MediaStore` `content://` discovery.

## Non-negotiable repository invariants

- **Never fall back to WebView audio on Android.** Android audio is strictly Media3 `ExoPlayer` on the main looper; surface errors honestly rather than creating split-brain WebView playback.
- **Keep Web and Java DSP aligned.** Any filter/headroom/rack change in `src/services/dsp.ts` / `studioRack.ts` must clamp frequencies to `<= 0.45 * sampleRate` and stay consistent with `AetherDspProcessor.java` / `StudioRack.java`.
- **Protect user data & legacy accounts.** Never delete `MediaStore` source files on disk, never prune disconnected SD-card volumes during rescans, never run destructive SQL migrations in `worker/src/schema.ts`, and never rehash/break existing scrypt/Argon2/bcrypt/PBKDF2 passwords.
- **Zero secrets in frontend or Git.** Never put Turso, B2, `AUTH_SECRET`, `LLM_API_KEY`, or Android keystore secrets into `VITE_*`, `wrangler.toml`, or committed files.
- **Never run `npm audit fix --force`** (it downgrades Capacitor 8 to breaking Capacitor 4).
- **Report verification honestly.** Distinguish `npm run build:android` (web bundle + Capacitor sync) from `npm run android:apk` (actual Gradle APK build requiring Java 21 + Android SDK 36), and never claim unexecuted browser, hardware, or live cloud tests.

## Essential commands

```sh
npm run lint            # Root TypeScript check (excludes worker/)
npm test                # Root node:test suite (tsx --test tests/*.test.ts)
npm run worker:check    # Worker TypeScript check (run npm --prefix worker ci once if needed)
npm run worker:test     # Worker SQL/auth/B2 integration suite
npm run worker:build    # Worker Wrangler dry-run bundle (no deploy/secrets)
npm run build:pages     # Static /Music-player-/ bundle + PWA sw.js + .nojekyll
npm run build:android   # Android assets + Vite build + PWA + npx cap sync android
npm run build           # Production Vite client + PWA + dist/server.cjs (run after build:pages/build:android if using npm start)
```
