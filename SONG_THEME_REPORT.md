# Song-aware automatic website theme

## What changed

The existing artwork-only automatic theme now has a **Song sound + artwork** mode, enabled by default when automatic music themes are enabled. The algorithm reads the current browser decoder through a read-only Web Audio tap **before EQ and output volume**. It does not open another audio player, upload audio or modify the playback signal.

At four samples per second it measures:

- RMS energy;
- bass power below 250 Hz;
- treble power above 3.5 kHz;
- spectral centroid (brightness);
- normalized positive spectral flux (changes in spectral shape).

A bounded 24-frame window and RMS variation estimate classify sound character as **calm, warm, deep, bright or energetic**. **Balanced** is the neutral fallback. These are transparent heuristics, **not emotional/lyrical understanding, BPM detection or a trained genre model**.

A new character needs roughly five seconds of valid playback to establish itself, including two seconds of consistent candidates. An eight-second minimum dwell prevents subsequent rapid switching. Silence does not invent a new mood. Pausing retains the last analyzed colors; a different track clears the old analysis. Hidden tabs skip analysis work.

Each character supplies a readable palette, blended 80% with 20% displayed-artwork color. Accents, the website background and Analog VU share those colors. Typed CSS color transitions smooth the main accent and background tint; reduced-motion users get no transition.

## Controls and compatibility

**Playback settings → Automatic music theme → Theme analysis**:

- **Song sound + artwork:** sound-character analysis with provisional genre/artwork colors while listening.
- **Artwork colors only:** preserves the previous behavior.

The settings panel identifies live sound analysis versus provisional genre/artwork fallback. Selecting a manual theme disables automatic changes. Preferences and backups include the source setting; old settings/backups default safely to song mode.

**Android remains native-only.** Its bridge does not supply a source FFT, so song mode explicitly uses genre/artwork fallback on Android. It does not start WebView audio or pretend native RMS is a spectrum.

## Required feature report

### ✅ POSITIVE (1)

1. The website changes its palette from real decoded sound features rather than song-title guesses. The bounded, read-only local analysis is independent of volume/EQ and includes stable transitions, source attribution and manual/artwork overrides.

### ❌ NEGATIVE (5)

1. Sound-character labels are heuristic, not reliable emotion or semantic recognition. Use artwork/manual mode when a classification does not fit a particular recording.
2. Native Android lacks FFT telemetry and therefore uses the clearly identified metadata/artwork fallback. A future native feature-analysis bridge is required for equivalent audio-derived palettes there.
3. Analysis needs several seconds of audible source data and enforces an eight-second dwell; very short clips and fast track skipping may never leave the fallback. This is intentional to prevent flicker.
4. Very quiet, unusual, stereo phase-cancelled or highly dynamic material can produce uncertain features, and missing/unrecognized genre tags give a neutral fallback. Keep the artwork/manual override available.
5. Smooth custom-property interpolation depends on browser support; older browsers can change colors without interpolation. Some accent-RGB decorative details also switch directly. Use reduced-motion/manual settings if any visual change is distracting; physical-device accessibility and performance still need testing.

## Validation

- **39/39 tests passed**, including nine new tests for spectral features, gain-invariant spectral flux, silence/nonfinite input, character classification, confirmation/dwell, silence reset, fallback metadata, readable palettes and persisted-setting migration/validation.
- Real Chromium checks passed using generated stereo PCM WAVs with identical artwork: 120 Hz → deep; 8 kHz → bright; distinct palettes; raw analysis unchanged when output volume was zero; no old-track result leaked into the next selection.
- Browser checks also passed for artwork-only selection, automatic-mode toggle, manual theme override, preference persistence and no horizontal overflow at 320/390/768/1280 px. No page exceptions were observed.
- TypeScript lint, production, Pages and Android client/sync builds are checked separately. `build:android` is not a Gradle APK build; no new physical-device or native Gradle result is implied for this update.

## Run, APK and assumptions

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
npm run build:pages
npm run build:android   # web client and Capacitor sync only
npm run android:apk     # actual APK build; requires Java 21 + Android SDK
```

Assumptions: “theme of a song” means estimated **audible sound character**, not knowledge of its meaning. Audio stays local. Automatic music themes remain opt-out. For an APK, build with the command above or download `aether-debug-apk` from a successful Android workflow for this branch after it has been pushed. Retain original audio and back up metadata before replacing an installed debug build if its signing key differs.

Known limits: native FFT unavailable; first-run/short/silent tracks use fallback; labels are approximate; visual interpolation varies by browser. No website deployment or pull-request merge is part of this change.
