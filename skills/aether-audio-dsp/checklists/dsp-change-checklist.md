# DSP & Audio Change Checklist

Mark each item pass, fail, or N/A after actual verification.

## Signal integrity & safety
- [ ] Out-of-order async track loads are guarded by `loadGeneration` (no stale track overwrites newer selection).
- [ ] All biquad and Butterworth cut frequencies clamp to `<= 0.45 * sampleRate`.
- [ ] Filter outputs and `headroomDb()` remain finite (`Number.isFinite`) across `8000`–`192000` Hz sample rates.
- [ ] `headroomDb()` probes include any newly added or modified resonant filter frequencies.
- [ ] Parameter updates use smoothing/ramps on Web Audio and crossfaded state-preserving banks on Android.
- [ ] Removing negative `outputTrimDb` via Reset asks for loudness confirmation.
- [ ] `cloneEQ()` deeply clones nested arrays/objects (including `rack.parametric`).

## Cross-platform & schema parity
- [ ] `src/types.ts` and `src/services/backupSchema.ts` validate new fields and provide backward-compatible `.default(...)` migrations.
- [ ] Reject `NaN`, `Infinity`, and out-of-bounds DSP inputs in Zod schemas and native Java guards.
- [ ] Android `AetherDspProcessor.java` / `StudioRack.java` matches Web Audio filter equations if native DSP is affected.
- [ ] Zero WebView `HTMLAudioElement` or `AudioContext` playback occurs on Android.

## UX, accessibility & honesty
- [ ] Simple Studio displays an active-rack warning when `rackActive(eq)` is true.
- [ ] Sliders and toggles have keyboard support, visible `:focus-visible` styles, and `aria-label`s.
- [ ] UI copy and docs do not claim bit-perfect output, LUFS/true-peak limiting, speaker crossovers, room calibration, or two-deck DJ mixing.

## Verification
- [ ] `npm run lint` passes.
- [ ] `npm test` passes (including `dsp.test.ts`, `studio-rack.test.ts`, `audio-engine.test.ts`, `song-theme.test.ts`).
- [ ] Native Gradle / physical-device status is reported honestly (local CI vs. GitHub Actions).
