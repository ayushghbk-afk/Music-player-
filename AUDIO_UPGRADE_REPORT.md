# Audio, artwork, lyrics and studio upgrade

## Assumptions and implementation

All audio stays local. Android remains **ExoPlayer-only**: there is no WebView-audio fallback or microphone permission. “Powerful studio” means implemented DSP and useful monitoring/presets, not unsupported surround, upsampling, AI mastering, streaming or fabricated measurements.

### 1. Playback stability and Analog VU

**✅ POSITIVE (1)**

1. Newest-request guards prevent delayed file loads from replacing newer selections; short switching ramps, smoothed web parameters and crossfaded native filter banks reduce discontinuities. Analog meters use independent measured channel RMS, including real native PCM telemetry, with resize handling and RMS ballistics.

**❌ NEGATIVE (5)**

1. Physical Android playback, Bluetooth, DACs, focus loss and locked-screen transitions still need device listening tests; CI and headless browsers cannot certify audible fidelity.
2. Very short de-click ramps intentionally add a small transition gap; use native best-effort gapless for continuous albums, not a claim of web gapless/crossfade.
3. Native metering is measured in the processing sink, before hardware volume; decoded PCM can run slightly ahead of what the speaker plays. Verify responsiveness on each device.
4. Native FFT/waveform telemetry is not implemented. Android explicitly offers the functioning RMS VU, instead of displaying fabricated spectra; other visualization modes remain browser-only.
5. Damaged files, unsupported codecs, operating-system interruptions and already-clipped recordings are not repaired by DSP. Re-import/convert such files, keep protection enabled, and retry from the error banner.

### 2. Music-matched appearance

**✅ POSITIVE (1)**

1. Album artwork supplies a readable dominant accent to the app background, controls, listening-room glow and Analog VU. The preference persists; choosing a manual theme disables automatic colors.

**❌ NEGATIVE (5)**

1. Missing covers use the bundled artwork fallback rather than inferred music mood; add embedded artwork for meaningful colors.
2. Palette extraction is asynchronous; the preceding accent can remain briefly while an image decodes. Verify large covers on low-memory phones.
3. Near-black/white artwork falls back to the warm default. Use manual themes if that fallback is unsuitable.
4. The palette is derived from the displayed artwork, not live audio frequencies; it does not claim mood recognition or beat-synced colors.
5. Contrast is lifted for a dark UI but not individually certified for every possible cover. Check accessibility with your actual collection and choose a manual theme if needed.

### 3. Lyrics import and synchronized reading

**✅ POSITIVE (1)**

1. Import .lrc/.txt from a track editor or as matching-name sidecars with audio. UTF-8/UTF-16 BOMs, multiple timestamps, signed offsets and embedded plain/millisecond-SYLT lyrics work; synced lines highlight, scroll and seek, and saves are awaited with visible errors.

**❌ NEGATIVE (5)**

1. Automatic sidecar matching requires a unique original filename, title or “artist - title”; use the intended track’s editor when ambiguous or unmatched.
2. Legacy non-UTF encodings are rejected; resave files as UTF-8 or BOM-marked UTF-16.
3. Word-by-word karaoke, translations, online lyric downloads and MPEG-frame timing conversion are not implemented; import ordinary timestamped LRC instead.
4. Lyrics are capped at 400 KB / 100,000 characters; split unusually large transcripts before import.
5. Manual scrolling suspends automatic following for five seconds; plain text has no timing or seek synchronization. Supply LRC timestamps when sync is required.

### 4. Real studio controls

**✅ POSITIVE (1)**

1. Auto headroom estimates combined filter/preamp/stereo gain; a soft-knee guard plus final post-oversampling sample ceiling bounds overloaded samples. Both engines support mono monitoring and balance, plus measured RMS/peak hold. A/B snapshots, 20 device-local presets, validated EQ JSON import/export and flat reset provide repeatable workflows.

**❌ NEGATIVE (5)**

1. Headroom is a frequency-response estimate, not ReplayGain, LUFS normalization or proof against intersample overs; keep conservative gain and verify with external mastering tools.
2. The peak guard can audibly color heavily driven peaks. Reduce preamp/boost rather than treating it as a transparent brick-wall/true-peak limiter.
3. A/B comparison is not loudness-matched and snapshots reset when the studio tools remount; use saved presets for durable comparisons.
4. Saved custom presets are local, capped at 20, and not part of the existing library-backup format; export important settings individually before clearing storage.
5. Native output is still PCM16 through Android’s mixer, not bit-perfect USB, forced high-rate output, convolution, multiband compression or spatial processing. Do not infer output fidelity from source-resolution badges.

### 5. Loading, refresh and failure handling

**✅ POSITIVE (1)**

1. Actual engine events distinguish loading/buffering/playing/paused/error. Loading can be cancelled, errors retried, and imports show filename, stage and completed-file counts. Refreshing tags/lyrics no longer reapplies old preferences over active playback.

**❌ NEGATIVE (5)**

1. File counts are not byte progress; metadata parsing, hashing and native storage transfer durations vary. Do not interpret stage text as an ETA.
2. Content hashing still reads an entire audio file into memory (1 GB upper limit); use smaller files on memory-constrained devices.
3. The first-run generated demo collection still takes time and storage; the loading indicator is honest, but generation has not moved to a worker.
4. Browser autoplay policies can require another explicit Play gesture; use Retry/Play after a blocked attempt instead of expecting background autoplay.
5. A hung browser/codec or stalled native service cannot always be cancelled inside the decoder immediately. If progress never resumes, retry/restart and retain the original files before clearing app data.

## Run and build

```sh
npm ci
npm run dev                 # live local app; server binds 0.0.0.0
npm run lint
npm test
npm run build
npm run build:pages
npm run build:android       # web assets + Capacitor sync, NOT Gradle compilation
npm run android:apk         # requires Java 21 + Android SDK
# Native tests and lint, with that toolchain installed:
cd android && ./gradlew testDebugUnitTest assembleDebug lintDebug
```

For an APK, open the **Android builds** workflow on this branch and download **aether-debug-apk** from a successful run. No release signing, store publication, PR merge or Pages deployment is implied. Existing installed APKs do not gain native DSP changes from reloading the website.

## Verification status

- TypeScript lint and **30/30** unit/regression tests pass, including out-of-order playback, cancellation/resume, autoplay retries, serialized native imports, stale events, lyrics/encoding, headroom/defaults and readable artwork accents.
- Production, Pages and Android-client/Capacitor-sync builds are checked locally. Build warnings about the main bundle exceeding 500 kB and four moderate transitive tooling advisories remain; do not use a forced audit upgrade without testing.
- Real Chromium interaction checks passed: audio + matching-sidecar import, tag-editor lyrics save, synced highlight/seek, actual independent L/R RMS, VU response to volume changes, deliberately delayed old-vs-new playback, cancel/resume, A/B recall, real mono/balance changes, headroom-aware response dragging, heavily boosted peak guard at full output volume, invalid-preset rejection, custom-preset storage, artwork/manual theme persistence and no horizontal overflow at 320/360/390/430/768/1280 px. No page exceptions were observed. Headless signal measurements are not a substitute for listening tests.
- **Android CI passed** native processor tests (five), Gradle APK compilation, lint and APK signature verification for commit `a011042`: [run 41333830571](https://github.com/ayushghbk-afk/Music-player-/actions/runs/41333830571). Mono-source upmix/balance coverage (six native tests total), APK compilation, lint and signature verification also passed in [run 41334759605](https://github.com/ayushghbk-afk/Music-player-/actions/runs/41334759605). Check the latest branch workflow for subsequent final refinements.
- Native regression tests cover channel separation, headroom/PCM range, mono/balance, rapid-update continuity and flush-reset metering.
- No physical Android/iOS, Bluetooth, USB DAC, hardware-volume, or locked-screen listening tests were performed. The sandbox has no local Java/Android SDK; Gradle validation runs on GitHub CI.
