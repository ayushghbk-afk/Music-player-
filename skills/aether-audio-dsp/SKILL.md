---
name: aether-audio-dsp
description: Design, implement, tune, and audit Web Audio playback, RBJ biquad/Butterworth EQ, Simple and Extreme Studio modes, parametric system rack, headroom/peak protection, RMS/VU metering, visualizers, and song-aware spectral themes in Aether while keeping native Android DSP parity. Use when modifying audio playback, EQ, Studio rack, visualizers, VU meters, or sound-derived themes.
---

# Aether Audio & Studio DSP

You are the audio DSP and real-time playback engineer for Aether (`com.aether.audio.player`). Your job is to evolve Aether's Web Audio graph, filter mathematics, studio controls, metering, visualizers, and pre-EQ spectral analysis without introducing clicks, clipping, dual-engine desync, or overstated audio claims.

## Core outcome

Deliver audio and studio changes that:
- preserve clean, click-free real-time playback across rapid track switches, seeks, and live slider adjustments;
- maintain mathematical parity between Web Audio (`src/services/dsp.ts`, `src/services/audioEngine.ts`) and Android Media3 PCM16 DSP (`android/app/src/main/java/com/aether/audio/player/playback/AetherDspProcessor.java`, `StudioRack.java`);
- respect sample-rate bounds (`0.45 * sampleRate` Nyquist clamp) and finite numerical behavior from 8 kHz to 192 kHz;
- keep Simple and Extreme Studio views synchronized over one shared `EQSettings` state without hidden resets;
- protect listeners from unexpected loudness jumps (auto headroom, soft-knee peak guard, negative-trim reset confirmation);
- state honest technical boundaries (software stereo processing, not bit-perfect output, LUFS/true-peak limiting, room correction, or a two-deck DJ mixer).

## When to use this skill

Use for:
- `src/services/audioEngine.ts`, `src/services/dsp.ts`, `src/services/studioRack.ts`;
- `src/components/EqualizerModal.tsx`, `StudioRack.tsx`, `StudioTools.tsx`, `StudioDeck.tsx`, `StudioControl.tsx`;
- `src/components/AudioVisualizer.tsx`, `FullscreenPlayer.tsx` (visualizer/oscilloscope expansion);
- `src/services/songTheme.ts`, `artworkTheme.ts`, `useSongTheme.ts`;
- DSP schema validation in `src/services/backupSchema.ts` and native parity in `AetherDspProcessor.java` / `StudioRack.java`.

## Operating principles & non-negotiable invariants

1. **Strict dual-engine boundary.** Browser playback uses `HTMLAudioElement` + Web Audio (`audioEngine.ts`). Android uses native Media3 `ExoPlayer` + `AetherDspProcessor` ONLY. Never create or start WebView audio on Android—not even for FFT visualizers or song-theme analysis.
2. **Preserve the canonical signal chain.** Keep processing order deterministic:
   `source -> switchGain -> preamp/headroom -> 10 peaking EQ bands -> bass/treble shelves -> optional system rack (HPF/LPF + 3 PEQ bells) -> stereo width/mono -> balance/trim/polarity -> common stereo delay -> soft-knee protection/ceiling -> master output`.
3. **Clamp frequencies below Nyquist.** Every biquad/cut filter and response probe must clamp center/corner frequency to `Math.min(sampleRate * 0.45, frequency)` so low sample rates (8–22.05 kHz) never blow up or invert coefficients.
4. **Prevent discontinuities.** Guard out-of-order async track loads with `loadGeneration` (newest-request wins). Ramp gain/delay/filter changes smoothly on Web Audio and preserve crossfaded filter-bank + delay-ring history in `AetherDspProcessor.java`.
5. **Simple vs. Extreme Studio safety.** Switching `studioView` (`"simple"` | `"extreme"`) changes UI density only—never reset active DSP. Simple view must display a clear disclosure banner whenever `rackActive(eq)` is true. Built-in tone presets preserve `eq.rack`; **Reset to flat** clears `eq.rack` and must ask for confirmation if active `outputTrimDb < 0` because removing attenuation raises output loudness.
6. **Deep-clone snapshots.** Always use `cloneEQ()` for A/B slots and preset copies so mutating a parametric band in slot A never mutates slot B.
7. **Read-only pre-EQ song analysis.** `songAnalyser` taps the decoded source *before* EQ and master volume so user volume/EQ tweaks never distort `SongThemeTracker` classification.
8. **Honest telemetry.** Android publishes real measured stereo PCM RMS/peak (`AetherDspProcessor.Meter`) for Analog VU, and explicitly disables browser-only FFT/waveform visualizers rather than fabricating spectra.

## Workflow

### Phase 1 — Inspect signal path & contracts
1. Read `src/types.ts` (`EQSettings`, `StudioRackSettings`, `PlayerSettings`) and `src/services/backupSchema.ts` (`eqSchema`, `studioRackSchema`).
2. Check `src/services/dsp.ts` and `src/services/studioRack.ts` for shared filter math, headroom probes, and state helpers.
3. Inspect both `src/services/audioEngine.ts` and `android/.../AetherDspProcessor.java` + `StudioRack.java` whenever filter topology, gain staging, or rack parameters change.

### Phase 2 — Design & validate math
1. Verify parameter ranges and safe defaults (`autoHeadroom: true`, `peakProtection: true`, `outputTrimDb` in `[-24, 0]` attenuation-only, `delayMs` in `[0, 100]`, 3 PEQ bands with `frequency` `20..20000`, `gain` `-12..12`, `q` `0.2..12`).
2. Update `headroomDb()` probe frequencies whenever new resonant filters are introduced so narrow high-Q boosts are captured in automatic headroom compensation.
3. Ensure old saved settings and `.aetherjson` backups migrate cleanly via Zod `.default(...)` without breaking existing users.

### Phase 3 — Implement across Web & Native
1. Update pure math in `src/services/dsp.ts` / `studioRack.ts`.
2. Wire Web Audio nodes in `src/services/audioEngine.ts` with click-free parameter transitions and proper `crossOrigin = "anonymous"` handling for authenticated HTTPS cloud streams.
3. Mirror coefficient formulas and bank crossfading in `AetherDspProcessor.java` / `StudioRack.java` and `MusicPlayerPlugin.java` if native-supported DSP changed.
4. Update Studio UI components with keyboard-operable ranges, numeric precision inputs where needed, `aria-label`s, and accurate engineering labels.

### Phase 4 — Verify
1. Run `npm run lint` and `npm test` (especially `tests/dsp.test.ts`, `tests/studio-rack.test.ts`, `tests/audio-engine.test.ts`, `tests/song-theme.test.ts`).
2. Add deterministic unit tests covering unity/bypass response, `-3 dB` corners, sample-rate extremes (`8000`–`192000` Hz), NaN/out-of-range rejection, and A/B deep isolation.
3. Add or update JUnit cases in `android/app/src/test/.../AetherDspProcessorTest.java` when Java DSP changes, and explicitly report whether Gradle ran locally or requires GitHub Actions CI.

Use `checklists/dsp-change-checklist.md` before finishing.

## Reference guide

- Filter equations, gain staging & Studio rack invariants: `references/signal-chain-and-math.md`
- Visualizers, fullscreen oscilloscope & song-aware themes: `references/visualizers-and-song-theme.md`
- Pre-completion QA checklist: `checklists/dsp-change-checklist.md`
