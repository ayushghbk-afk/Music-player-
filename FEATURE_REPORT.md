# Aether — feature and upgrade report

Status: web/client/server builds and Capacitor sync pass; native APK compilation is blocked by the missing Java/Android toolchain. This is a substantial implementation, **not a fully verified release**. Each section deliberately contains one genuine strength and exactly five actionable weaknesses/risks, as requested.

## Playback

✅ POSITIVE (1): Local playback has transport, seek, volume/mute, speed, shuffle/repeat, autoplay and saved-position resume; Android routes strictly to ExoPlayer without WebView fallback.

❌ NEGATIVE (5):
1. Browser transitions reload one media element and can gap; implement a scheduled dual-source transition engine.
2. Crossfade is not implemented; add overlapping sources and test transitions at track boundaries.
3. The gapless toggle is persisted but does not change transition strategy; wire it to real queue/transition behavior or remove the toggle.
4. Resume position is periodically saved, so abrupt termination can lose the last few seconds; persist additionally on lifecycle/pause events.
5. Mobile browsers can suspend playback despite recovery attempts; validate background behavior per browser and avoid claiming native reliability on web.

## Library, demos and metadata editing

✅ POSITIVE (1): Real local files persist, five valid 24-bit/96 kHz synthesized WAV demos seed once, and library views support songs, vault, albums, playlists, favorites, search, sort and manual tags.

❌ NEGATIVE (5):
1. Browser quota/eviction can remove music; request persistent storage and surface quota failures prominently.
2. Deleting all tracks does not regenerate demos automatically; add an explicit reinstall-demos action.
3. Tag edits update library metadata only; add a separate, clearly confirmed embedded-tag writer for supported formats.
4. A metadata restore does not contain audio; retain original files and re-import matching content to relink hash IDs.
5. Full-library mutations reload library state; incremental IndexedDB queries and virtualized rows are needed for large collections.

## Web DSP and visualizers

✅ POSITIVE (1): Web Audio provides ten EQ bands, preamp, bass/treble shelves, stereo-width matrix, analyser and master gain, with five visualization modes.

❌ NEGATIVE (5):
1. Forced 96/192 kHz output is absent; implement selectable contexts/processors without implying hardware-rate control.
2. Positive EQ/preamp boosts can clip; add headroom metering and a limiter or automatic negative preamp.
3. The 31-band view groups a small FFT rather than calibrated third-octave filters; increase FFT resolution and implement proper logarithmic aggregation.
4. VU visualization is not a calibrated loudness meter; add RMS/peak ballistics and measured reference levels before labeling it metering-grade.
5. Browser output mixes/resamples independently of source tags; verify with loopback/DAC measurements before claiming bit-perfect output.

## AI assistant experience

✅ POSITIVE (1): Multiple sessions, contextual track/library/EQ messages, a 2000-character cap, error/vibration feedback and validated apply-EQ suggestions are implemented.

❌ NEGATIVE (5):
1. Sessions are memory-only and disappear when the view unmounts; persist them in IndexedDB with delete controls.
2. Provider outages make chat unavailable; add retry/backoff and provider status feedback without fake offline answers.
3. Chat sends limited metadata to an external provider; add a dedicated consent dialog and configurable context redaction.
4. Streaming responses are not implemented; add cancellation and incremental display for slow providers.
5. Vibration is browser/platform dependent; keep visual error messages and add accessible announcements on every target.

## Backup and sync experience

✅ POSITIVE (1): Offline `.aetherjson` export/restore and companion-server snapshots share schema validation, ID dedupe, metadata/settings/EQ preservation and storage reporting.

❌ NEGATIVE (5):
1. Snapshots exclude audio by design; users must retain originals and re-import them on each device.
2. The 5 MB cap can reject artwork-heavy libraries; add optional artwork-free exports or a separate asset archive.
3. Restore uses several transactions, so storage failure can leave a partial merge; make restore atomic or stage and roll back.
4. Browser storage statistics exclude native audio files; expose native TrackStore byte usage through the plugin.
5. Hash-ID dedupe cannot merge two differently encoded copies of one song; add opt-in metadata/fingerprint matching with conflict review.

## UI, PWA and navigation

✅ POSITIVE (1): Desktop sidebar, mobile navigation, fullscreen player, five statically mapped themes and build-specific offline JS/CSS precaching are implemented.

❌ NEGATIVE (5):
1. Headless Chromium smoke checks passed, but Safari/Firefox and physical mobile browsers were not exercised; run cross-browser transport, layout and storage tests.
2. Cached PWA content disappears when the user clears site storage; explain offline prerequisites and offer storage-persistence controls.
3. Hardware Back returns to Songs rather than traversing a view-history stack; implement a real internal navigation history.
4. The small playback-settings popover is not in the Android Back modal stack; include it before navigation/minimize handling.
5. Existing controls still need focus traps, accessible names and keyboard audits; run axe/screen-reader tests before release.

## Android background architecture

✅ POSITIVE (1): A main-looper ExoPlayer, native queue, MediaSessionService, noisy-device handling, focus/wake mode and foreground lifecycle ownership avoid dependence on background JavaScript.

❌ NEGATIVE (5):
1. No native compilation or device run occurred because Java/SDK are absent; execute the Android CI job before distributing any APK.
2. OEM battery restrictions may still stop playback; test task removal and screen-off playback across target manufacturers.
3. Queue edits become fully effective on the next selected track; update the active timeline while preserving current index/position.
4. Native analyser telemetry is absent, so Android visualizers are idle; bridge throttled native spectrum/RMS values.
5. Loopback HTTP can be blocked by mixed-content policy; verify the bounded bridge-chunk fallback with large files on physical devices.

## Upgrade 1 — real LLM proxy

✅ POSITIVE (1): `/api/ai` performs an actual server-side OpenAI-compatible call with environment-only secrets, input/output validation, a timeout and IP rate limiting; missing configuration returns 503.

❌ NEGATIVE (5):
1. The sandbox cannot reach provider hosts and no key was configured; verify a real completion on the deployment host.
2. JSON-object responses are provider-specific; use a compatible model or add an adapter for other APIs.
3. In-process rate-limit state resets on restart and is not shared; use Redis/database limits for multiple instances.
4. Shared-IP users can exhaust one another's quota; add authenticated per-user quotas and spending budgets.
5. Malformed model output returns an error rather than repairing itself; add one bounded schema-repair retry and log redacted diagnostics.

## Upgrade 2 — persistent snapshot database

✅ POSITIVE (1): SQLite snapshots survive restart, expire after seven days and use 128-bit random bearer codes, prepared statements, payload limits and scheduled cleanup; restart and expiry behavior were tested.

❌ NEGATIVE (5):
1. SQLite supports this single-node deployment, not distributed replicas; use a shared database before scaling horizontally.
2. Snapshot data is not end-to-end encrypted; deploy encrypted storage or add client-side encryption for sensitive libraries.
3. Possession of a code grants read access; add account-bound access or revoke/delete endpoints where stronger privacy is needed.
4. The database has an admission-count cap rather than a disk-byte quota; monitor disk usage and enforce per-client byte limits.
5. Expired rows can remain until cleanup even though reads reject them; tighten retention intervals or add audited deletion if policy requires immediate removal.

## Upgrade 3 — real tag parsing

✅ POSITIVE (1): `music-metadata` reads ID3/Vorbis/MP4 metadata and cover art locally, and codec/sample-rate/bit-depth fields determine honest Hi-Res badges for imports.

❌ NEGATIVE (5):
1. SHA-256 hashing currently reads the entire file into memory; use incremental worker hashing for large audio.
2. Parsing executes on the UI thread and can stall import feedback; move tag parsing to a bounded worker pool.
3. Artwork above 1 MB is omitted; downsample large covers instead of dropping them.
4. Unusual/malformed containers may fail parsing even if a decoder could play them; add a clearly labeled unknown-tags fallback after validation.
5. Parser success does not guarantee browser codec support; detect decoder compatibility and surface unsupported-format guidance.

## Upgrade 4 — native DSP

✅ POSITIVE (1): `AetherDspProcessor` applies ten biquads, shelves, preamp and stereo width directly inside Media3's audio sink, so effects do not depend on WebView audio.

❌ NEGATIVE (5):
1. The processor has not been compiled or device-tested here; verify API compatibility and audio behavior in CI/on hardware.
2. Processing uses PCM16 output, not a transparent 24-bit/float path; add float/high-resolution processor support for audiophile output.
3. Coefficient changes reset filter state and can click; cross-ramp old/new filter outputs or smooth coefficients.
4. Hard output clamping can distort boosted tracks; add a limiter and clipping indicators.
5. No measured frequency-response/latency tests exist; add impulse, sine-sweep, stereo and bypass regression tests before quality claims.

## Upgrade 5 — signed/minified releases and CI

✅ POSITIVE (1): CI provisions Node/Java/SDK, runs lint/tests, uploads debug APKs and supports secret-injected release signing/minification with versionCode 2 and temporary-keystore cleanup.

❌ NEGATIVE (5):
1. The workflow was written but not run this session; run it and inspect compilation/lint results before release.
2. Release secrets were not provided, so no signed release exists; configure the four documented repository secrets.
3. Shrinking can break reflective plugin entry points despite keep rules; smoke-test a minified release, not just debug.
4. VersionCode is static; increment it for each distributed update or derive it from a monotonic release sequence.
5. Four moderate transitive CLI-tooling audit advisories remain; upgrade patched Capacitor tooling when available rather than downgrading to Capacitor 4.

## Assumptions

Metadata-only backup, explicit opt-in network AI, an OpenAI-compatible provider, one persistent SQLite server, 25-second synthesized demos and library-only manual tag edits. Keys/signing credentials are never bundled.

## How to run

`npm ci && npm run dev` opens port 3000. Verification: `npm run lint`, `npm test`, `npm run build`, `npm run build:android`.

## How to get the APK

With Java 21 and Android SDK 36: `npm run android:apk`. Expected output after success: `android/app/build/outputs/apk/debug/app-debug.apk`. Alternatively run the GitHub workflow and download `aether-debug-apk`. **There is no APK from this sandbox: Gradle stopped before compilation because Java is missing.**

## Known bugs

Crossfade/forced resampling absent; gapless toggle does not change transition strategy; native visualizers idle; native DSP clicks/clipping possible; browser eviction and metadata-only restore can leave absent audio; large-file hash allocations can exhaust mobile memory; modal Back handling and accessibility are incomplete. Android compilation, real-device playback, minified signing and a real LLM completion remain unverified.

Roadmap: LRC, sleep timer, queue editor, Android Auto, smart playlists, ReplayGain, folder scanning, future IndexedDB migrations, broader tests and accessibility.
