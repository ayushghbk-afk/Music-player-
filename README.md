# Aether — Hi-Res Audio Player

Offline-first local music player for Web and Android (`com.aether.audio.player`), with an optional authenticated Turso + private Backblaze B2 cloud library. React 19, TypeScript 5.8, Tailwind 4/Vite 6, Capacitor 8 and Media3 1.5.1. Dependencies are pinned in `package.json` and `package-lock.json`.

## Multi-user cloud library

The existing player now includes real registration/login, rotating sessions, profiles, cloud uploads with progress, private B2 streaming with Range/seek support, owner/admin deletion, and an admin user/role dashboard. Local playback and imports still work without an account. The complete Cloudflare Worker is in `worker/`; see **[CLOUD_PLATFORM.md](CLOUD_PLATFORM.md)** for integration details and **[worker/README.md](worker/README.md)** for deployment, missing-only migrations, legacy password handling, API routes, and secure first-admin promotion. Never put Turso, B2, or JWT secrets in the frontend or GitHub Pages configuration.

## Studio UI

The redesigned interface uses charcoal surfaces, a theme-aware copper accent, bundled landscape cover artwork, and a responsive library/listening-room layout. Album and artist browsing, favorites, the fullscreen player, ten-band EQ, sound assistant, import, backup, playlists, and metadata editing share the visual system. Imported embedded artwork is retained; demo artwork is a presentation layer and does not rewrite saved tags.

Artwork and application assets are precached in production for offline use. Modal focus management, keyboard-operated EQ ranges, visible focus rings, and reduced-motion support are included. Browser smoke checks covered playback, library controls, secondary screens, and viewport widths 390/768/1280/1536; Android device rendering remains unverified.

### Simple and Extreme Studio

Studio now offers two saved views. **Simple** keeps presets, basic tone/width controls, meters and protection. **Extreme** adds the ten-band EQ/response display, A/B and custom presets, single-deck cue/speed/tap-BPM tools, and a bypassable system rack with three frequency/gain/Q parametric bands, high/low cuts, attenuation, polarity and common stereo delay. Switching views never resets DSP; Simple warns when the advanced rack is still active.

These are software stereo tools, not a two-deck DJ mixer or certified speaker-management system. The current browser implementation is tested; updated native Android DSP source/tests still require Gradle/device verification. See [STUDIO_MODES_REPORT.md](STUDIO_MODES_REPORT.md) for ranges, workflow, verification, assumptions and the required one-positive/five-risk reports.

### Dedicated phone layout

The phone UI has five primary tabs and a focus-managed More sheet for hi-res tracks, the assistant, backup/sync, playback preferences and all five appearance themes. Header search opens and focuses library search. The home screen has phone-specific typography and collection shortcuts, and the mini-player only appears once a track is selected. Player, library, import and EQ controls use larger mobile touch targets. Safe-area padding, narrow screens, landscape layouts and Android back dismissal are handled separately from desktop styles in `src/mobile.css`.

Verified in Chromium at widths 320, 360, 390, 430, 768 and 1280, including playback/search, More navigation, themes and EQ. Physical Android and iOS rendering still needs device testing.

## Run the web app

Requires **Node 22.13+** (SQLite uses `node:sqlite`).

```sh
npm ci
cp .env.example .env
npm run dev
```

Open port **3000**, or run `PORT=24678 npm run dev` for the current Arena preview. Vite HMR shares the application listener to avoid a conflict with its default port 24678. The server binds `0.0.0.0` and permits Arena's `.e2b.app` preview hosts. Browser API calls are same-origin; no sandbox-local addresses are used in browser code. Android's import-only loopback server is deliberately device-local.

```sh
npm run lint       # tsc --noEmit
npm test           # 12 tests: schema validation, presentation helpers, real WAV metadata
npm run build      # Vite client + dist/server.cjs
npm start          # production Express server
```

`npm run build:android` clears/rebuilds `dist` as a web-only bundle before Capacitor sync. Run `npm run build` again before using `npm start` after an Android sync.

## GitHub Pages

`npm run build:pages` produces a static, project-path-aware site at `/Music-player-/` with scoped offline caching. The Pages workflow deploys from `main`; pull requests build/test without publishing. See [GITHUB_PAGES.md](GITHUB_PAGES.md) for setup, the public URL and companion-server configuration. Local playback and JSON backups need no server; AI and server snapshots do. Cloud music uses the separate Worker and needs no secrets in the Pages build.

## Implemented

- Local import with `music-metadata` ID3/Vorbis/MP4 tags and embedded raster artwork; stable SHA-256 IDs deduplicate repeat imports. Web picker/drop area and Android WebView document picker.
- Optional multi-user cloud catalog with scrypt registration/login, in-memory access tokens and rotating HttpOnly refresh cookies, Turso metadata, private B2 uploads/streaming/deletion, HTTP Range seeking, user ownership, and database-verified admin roles. See the cloud guides above for live deployment requirements.
- Songs/search/sort, resolution-based Hi-Res Vault, albums, playlist CRUD, favorites and library-only tag editing including lyrics and track number.
- Five synthesized 25-second stereo **24-bit/96 kHz PCM WAV** demos generated with `OfflineAudioContext`. These are synthesized demonstrations, not recordings, DSD files, or proof of the device's output resolution.
- Web HTMLAudioElement with preamp, ten EQ bands, bass/treble shelving, stereo matrix, analyser and master gain; native-only ExoPlayer routing on Android with no WebView playback fallback.
- Native MediaSessionService, notification transport, audio focus, noisy-device pause, wake mode, persisted UI resume position and a native queue. Service remains alive when a playing task is removed.
- New native `AetherDspProcessor` with ten biquads, preamp, bass/treble shelves and stereo width in Media3's PCM audio sink. **Android Java is not compiled or device-tested in this environment.** Its DSP output is PCM16, not bit-perfect hi-res output.
- Themes, desktop sidebar, mobile navigation, fullscreen player and five web visualizer styles.
- Validated metadata-only `.aetherjson` export/restore, favorites/ID dedupe, settings/EQ restore and browser storage estimates. Audio must be imported separately on a second device.
- Optional server-side LLM proxy, SQLite snapshot database, expiry and rate limits. No public third-party backup services or hard-coded shared backup IDs.
- PWA manifest/icons and network-first service worker with build-specific precache of all JS/CSS, including lazy metadata parsers.

## Optional AI and companion server

Set `LLM_API_KEY`, `LLM_MODEL`, and optionally `LLM_BASE_URL` **on the server only**. The latter is an OpenAI-compatible base URL ending in `/v1/`. The provider must support JSON-object responses. `/api/ai` returns **503** without configuration; it never fabricates an LLM answer. Requests include limited track/library/EQ context and up to twelve previous messages, never audio bytes. The model's suggested gains are range-validated before returning them.

This sandbox's outbound-network allowlist does not include LLM providers, so an actual provider completion was not verified here.

For Android, enter your deployed HTTPS companion origin in Backup & Sync. Offline playback and file backups need no server. Set `CORS_ORIGINS` to exact permitted origins, including `https://localhost` for Capacitor. No credential reflection or wildcard API CORS. Set `TRUST_PROXY=1` only behind exactly one trusted reverse proxy that sanitizes forwarded client headers; otherwise rate limiting uses socket IPs.

### API

- `GET /api/health`
- `POST /api/ai`: 2000-character messages, 10 requests/minute/IP, 30-second upstream timeout
- `POST /api/backup/save`: schema validation, 5 MB snapshot cap, returns `AE-` plus 32 cryptographically random hex digits and expiry
- `GET /api/backup/load/:code`: metadata snapshot, expires after seven days
- Unknown `/api/*`: JSON 404; parser errors: JSON 400/413

Global JSON body limit: 50 MB. Snapshots live in `DATA_DIR/aether.sqlite` with WAL, indexed expiry, hourly cleanup and a 10,000-snapshot admission limit. Persist this directory on deployment and secure it with filesystem permissions/encrypted storage. **Sync codes are bearer secrets, not accounts or end-to-end encryption.** Single-server SQLite is not a multi-region sync architecture.

## Android build / APK

Requires **Java 21**, Android SDK **36**, build tools and access to Google's Android/Maven and Gradle repositories.

```sh
npm run build:android
cd android
./gradlew assembleDebug
```

Expected output **after a successful build**:

`android/app/build/outputs/apk/debug/app-debug.apk`

**A debug APK was successfully compiled, linted, and signature-verified in GitHub Actions** ([verified run](https://github.com/ayushghbk-afk/Music-player-/actions/runs/41317759218)). Download the `aether-debug-apk` artifact from that run and extract `app-debug.apk`. The sandbox itself still has no Java/Android SDK, so native compilation runs on GitHub’s provisioned runner, not locally. This is a debug-signed test build, not a production release.

The GitHub Actions workflow pins Ubuntu 22.04, Node 22, Java 21 and SDK 36, runs lint/tests, compiles debug + Android lint, verifies the APK signature, and uploads `aether-debug-apk`. It uses the runner’s installed SDK manager rather than the failing third-party SDK bootstrap. API-27-only navigation attributes live in `values-v27`, preserving minSdk 24.

### Signed release

Workflow Dispatch → `Android builds` → enable `release`. Repository secrets:

- `AETHER_KEYSTORE_BASE64`: base64 of your existing release keystore
- `AETHER_STORE_PASSWORD`
- `AETHER_KEY_ALIAS`
- `AETHER_KEY_PASSWORD`

The keystore is decoded into runner temp storage, removed in an always-run cleanup, and never committed. Release builds use minification/resource shrinking, versionCode **2**, versionName **1.1.0**, and signing configuration that fails without signing environment variables. Increment versionCode for each distributed update. Signing was not verified: no keystore was supplied. Debug builds use the standard debug signing identity, not the release key.

## Verification performed

- `npm ci`: passed; audit currently reports **four moderate transitive CLI-tooling advisories** (glob/minimatch/rimraf/Capacitor CLI). No high/critical advisories remained at verification time. Do not use audit's suggested downgrade to Capacitor 4.
- `npm run lint`: passed.
- `npm test`: schema sanitization/dedupe/invalid-input tests and real 24-bit WAV encoding and parser-resolution tests passed (ten tests total, including presentation and deployment helpers).
- `npm run build` and `npm run build:android`: passed (bundle-size and dependency-comment warnings only).
- Dev preview HTML with Arena Host header: HTTP 200.
- Production API: health, JSON 404, denied foreign CORS, invalid payload, 5 MB cap, save/load including EQ, missing-key AI 503 passed.
- SQLite snapshot survived an actual process restart; expired snapshot returned 404.
- GitHub Actions `./gradlew assembleDebug lintDebug --no-daemon --stacktrace`: passed, followed by successful `apksigner verify`. Local Gradle remains unavailable without Java.
- Headless Chromium smoke checks passed after extracting the optional browser package's runtime libraries: demo seeding, advancing playback clock, search, metadata export/restore, reload persistence/dedupe, desktop/mobile render and no 390 px horizontal page overflow. No page exceptions were observed. This verifies browser behavior, not physical audio quality or Android playback.

## Known limitations / bugs

1. **Crossfade and forced 96/192 kHz output are not implemented.** The playback panel explicitly identifies this. Source resolution is independent of device output rate.
2. Gapless toggle is stored but does not select a separate transition engine. Media3's native queue gives best-effort continuous playback; browser transitions can gap. Do not use this as a measured gapless guarantee.
3. Native analyser data is not bridged; Android visualizers are idle, not measurements of native DSP output.
4. Native PCM16 DSP can clip with aggressive positive gains and can click when rebuilding coefficients; lower preamp until a limiter and smoothed coefficient transitions are implemented.
5. A restored metadata record may have no audio. Re-import the identical source file to relink its hash ID. Browser codec support, including ALAC/AAC, varies.
6. Tag editing changes IndexedDB records, not embedded source-file tags. Import parsing/hash creation can allocate a full-file buffer; the importer rejects files over 1 GB but smaller large files may still exhaust mobile memory.
7. Browser storage can be evicted. Request persistence/back up metadata and retain original audio; browser storage statistics exclude native private audio.
8. Hardware back closes import/tag/EQ/fullscreen and returns to Songs, but is not a full multi-view navigation stack; the small playback settings popover is not yet included.
9. Native queue refresh currently takes effect fully on the next selected track. OEM background policies, Bluetooth devices, task-removal behavior, release shrinking and signing need real-device tests.
10. Model access requires server deployment/configuration; shared-IP rate limits and distributed deployments require a persistent shared limiter and authentication/budget controls.

See the required feature-by-feature strengths/risks report in `FEATURE_REPORT.md`.

## Assumptions and roadmap

Assumed metadata-only backup (never upload user audio), explicit opt-in AI, OpenAI-compatible provider, single-node persistent SQLite deployment, 25-second synthesized demos and library-only tag edits. No API keys, signing secrets or user music are bundled.

Roadmap: LRC synchronization, sleep timer, queue editor, Android Auto, smart playlists, ReplayGain, folder scanning, future IndexedDB migrations, broader tests, accessibility audit, crossfade, resampling and native analyser telemetry.

### Audio stability, artwork colors and studio monitoring

This update guards rapid track changes, smooths DSP changes, adds real stereo RMS Analog VU metering on web **and native Android**, and defaults to safe headroom/peak protection. In **Playback settings**, “Automatic music theme” links the room background and meters to music colors (choose “Artwork colors only” for the original cover-based behavior); choosing a manual theme turns it off.

Import `.lrc` / `.txt` from a track’s tag editor, or import uniquely matching-name sidecars alongside your audio. In Now Playing → Lyrics, timestamped lines follow playback and can be tapped to seek. The studio adds mono/balance, A/B snapshots, measured levels, device-local custom presets and validated EQ JSON import/export. Loading now distinguishes file preparation, buffering and actual playback.

See [AUDIO_UPGRADE_REPORT.md](AUDIO_UPGRADE_REPORT.md) for precise capabilities, limitations, validation and APK instructions. Native spectrum modes are deliberately not simulated; Android uses measured RMS VU. Peak protection is not a transparent true-peak limiter, and A/B is not loudness-matched.

### Song-aware automatic themes

The website can now estimate a song’s **sound character** from actual decoded audio—bass/treble balance, brightness, RMS energy and spectral changes—and gradually select calm, warm, deep, bright or energetic colors. The sound palette blends with album artwork and drives the shared background/accent/VU theme. Analysis is local, read-only and taken before volume/EQ; it does not change playback.

In **Playback settings → Automatic music theme → Theme analysis**, choose **Song sound + artwork** (default) or **Artwork colors only**. The panel identifies live analysis versus provisional genre/artwork fallback. Manual theme selection disables automatic changes. Android currently uses the explicit genre/artwork fallback because native FFT telemetry is unavailable; WebView audio is never started as a workaround.

See [SONG_THEME_REPORT.md](SONG_THEME_REPORT.md) for the algorithm, tests, assumptions and the one-positive/five-risk report. Sound-character labels are heuristics—not reliable emotion detection or lyric understanding. The current test suite contains **48 tests**.

### Fullscreen oscilloscope and readable lyrics

In **Now Playing → Sound in motion**, selecting **Oscilloscope** now expands the waveform into the player viewport. The **Fullscreen / Back to player** button expands or restores any visualization. Browser fullscreen (hiding browser chrome) is attempted when permitted, with a working viewport fallback for embedded previews. Escape exits the expanded view first; the close button closes Now Playing. Playback and seeking remain available without restarting audio.

**Lyrics** now has a properly bounded scroll region, wrapping for long lines, adjustable 16–32px text, a fullscreen reading mode and keyboard scrolling. Active lines center relative to their own reader, simultaneous translated lines highlight together, and oversized lines align at the start. Manual scrolling pauses following for five seconds; **Follow lyrics** resumes immediately. See [PLAYER_READER_REPORT.md](PLAYER_READER_REPORT.md) for verification, risks and native/browser limits.
