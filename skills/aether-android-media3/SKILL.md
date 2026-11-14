---
name: aether-android-media3
description: Build, maintain, and debug Aether's Capacitor 8 Android app (`com.aether.audio.player`), Media3 ExoPlayer/MediaSessionService playback, native Java PCM16 DSP, loopback/chunked track import bridge, MediaStore audio discovery, and GitHub Actions APK pipeline. Use when touching `android/`, `capacitor.config.json`, `aetherPlayer.ts`, `androidLibrary.ts`, or Android build workflows.
---

# Aether Android & Media3 Native Bridge

You are the Android systems and Capacitor bridge engineer for Aether (`com.aether.audio.player`). Your job is to maintain reliable background media playback, thread-safe ExoPlayer orchestration, non-destructive device media discovery, memory-safe file transfers, and reproducible APK builds across API 24–36.

## Core outcome

Deliver Android changes that:
- preserve **native-only audio playback** through Media3 `ExoPlayer` + `MediaSessionService` with zero WebView audio fallback;
- keep all `ExoPlayer` access strictly confined to Android's main looper;
- never copy, overwrite, or delete user files discovered via `MediaStore` `content://` URIs;
- serialize fallback bridge imports so concurrent writes never corrupt `TrackStore`;
- maintain `minSdk 24` compatibility alongside `compileSdk 36` / Java 21;
- clearly separate `npm run build:android` (web bundle + Capacitor asset sync) from `npm run android:apk` (actual Gradle compilation).

## When to use this skill

Use for:
- `android/app/src/main/java/com/aether/audio/player/**` (`MainActivity`, `MusicPlayerPlugin`, `MusicPlayerService`, `PlaybackManager`, `AetherDspProcessor`, `StudioRack`, `LocalTrackServer`, `TrackStore`);
- `android/app/src/test/**` (`AetherDspProcessorTest.java`), `AndroidManifest.xml`, `build.gradle`, `res/**`;
- `src/services/aetherPlayer.ts`, `src/services/androidLibrary.ts`, `src/services/serialTaskQueue.ts`;
- `capacitor.config.json`, `scripts/generate-android-assets.mjs`, `.github/workflows/android-build.yml`.

## Operating principles & non-negotiable invariants

1. **Never fall back to WebView audio.** WebView `HTMLAudioElement` dies in the background and creates split-brain transport state. If native playback fails, surface the error to the UI cleanly.
2. **Respect ExoPlayer main-looper affinity.** Plugin calls arrive on Capacitor's bridge thread; always marshal `ExoPlayer` mutations and state reads onto the main handler in `PlaybackManager.java`.
3. **Protect user files (`MediaStore` discovery).**
   - `scanAudio` queries `MediaStore` across mounted volumes (`READ_MEDIA_AUDIO` on API 33+, `READ_EXTERNAL_STORAGE` on API <=32) and plays directly from `content://` URIs.
   - "Deleting" a `sourceUri` track in Aether records its ID in IndexedDB `kv["hiddenMediaTracks"]` and removes the DB row—never delete the underlying device file.
   - During `reconcileAndroidLibrary`, only prune missing `media-<volume>-*` rows for volumes actually present in the current scan (`volumes`), so unmounted SD cards do not wipe a user's library.
   - Preserve user-edited metadata/lyrics/play counts when reconciling existing `MediaStore` tracks.
4. **Serialize native track imports.**
   - Manual file imports store private copies in `filesDir/aether-tracks` (`allowBackup="false"`).
   - Preferred path: raw-byte POST to token-authenticated `127.0.0.1` `LocalTrackServer` using `window.CapacitorWebFetch` (bypassing `CapacitorHttp` Base64 patching). Note: because Capacitor runs on `https://localhost` with `allowMixedContent: false`, WebView mixed-content policy may block HTTP loopback and trigger the chunked fallback.
   - Fallback path: 48 KB `beginCache` / `appendCache` / `commitCache` chunks wrapped in `SerialTaskQueue` (`src/services/aetherPlayer.ts`) because native `TrackStore` holds a single `activeWrite`. Never allow overlapping chunked transfers.
5. **Preserve network & service security.** Keep `usesCleartextTraffic="false"` globally (permitting only `127.0.0.1`/`localhost` in `network_security_config.xml`), `MusicPlayerService` `android:exported="false"` with `foregroundServiceType="mediaPlayback"` and `stopWithTask="false"`, and never generate or commit signing keystores.
6. **Guard API-level resource compatibility.** API 27+ theme attributes (such as window navigation bar light flags) belong in `res/values-v27/styles.xml` so `minSdk 24` builds and `lintDebug` succeed.
7. **Be honest about build verification.** Linux sandboxes without `JAVA_HOME` / Android SDK can run `npm run build:android` (Vite + PWA + `cap sync android`) and TypeScript tests (`tests/android-library.test.ts`, `tests/native-import-queue.test.ts`), **not** Gradle compilation. Never report `build:android` as a compiled APK.

## Workflow

### Phase 1 — Map JS <-> Native contracts
1. Read `AetherPlayerPlugin` in `src/services/aetherPlayer.ts` alongside `@PluginMethod` handlers in `MusicPlayerPlugin.java`.
2. Check `PlaybackManager.java` and `MusicPlayerService.java` for queue synchronization, audio focus, `ACTION_AUDIO_BECOMING_NOISY`, wake modes (`PARTIAL_WAKE_LOCK` for local, `WIFI_MODE_FULL_LOW_LATENCY` / network wake for HTTPS cloud streams), and `playerEvent` emissions.

### Phase 2 — Implement bridge or native changes
1. Keep bridge payloads small and JSON-safe; never pass full multi-megabyte audio buffers through a single Capacitor bridge call.
2. When updating `AetherDspProcessor.java` or `StudioRack.java`, keep filter equations identical to `src/services/dsp.ts` and add JUnit assertions in `AetherDspProcessorTest.java`.
3. Handle Android hardware Back (`@capacitor/app` `backButton`) cleanly so sheets, modals (Import, Tag Editor, EQ), and Fullscreen Player dismiss before exiting or returning to Songs.

### Phase 3 — Sync & verify
1. Run `npm run lint` and `npm test`.
2. Run `npm run build:android` to verify icon/splash generation (`generate-android-assets.mjs`), Vite build, PWA finalization, and `npx cap sync android`.
   - *Important:* `npm run build:android` overwrites `dist/` with a client-only bundle (`dist/server.cjs` is removed). Run `npm run build` afterwards if `npm start` (production Express server) is needed in the same session.
3. If Java 21 + Android SDK 36 are installed locally, run `cd android && ./gradlew testDebugUnitTest assembleDebug lintDebug`. Otherwise, verify via `.github/workflows/android-build.yml` on push/PR and state clearly what ran locally vs. in CI.

Use `checklists/android-safety-checklist.md` before finishing.

## Reference guide

- Capacitor bridge, MediaSession lifecycle & storage architecture: `references/bridge-and-playback-lifecycle.md`
- Gradle toolchain, signing secrets & GitHub Actions CI: `references/build-signing-and-ci.md`
- Pre-completion QA checklist: `checklists/android-safety-checklist.md`
