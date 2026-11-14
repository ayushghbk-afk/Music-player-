# Signal Chain, Filter Math & Studio Rack Invariants

## Canonical signal chain

Both browser Web Audio (`src/services/audioEngine.ts`) and Android Media3 PCM16 (`AetherDspProcessor.java`) model the same logical stereo signal chain:

1. **Decoded stereo source** (`MediaElementAudioSourceNode` on Web; Media3 PCM16 sink on Android).
   - *Web only:* `songAnalyser` taps immediately at the source before any EQ or gain node.
2. **Track-switch de-click gain** (`switchGain` on Web; crossfaded `Bank` transition on Android).
3. **Preamp & automatic headroom** (`preamp - headroomDb(eq, sampleRate)` when `autoHeadroom !== false`).
4. **10-band graphic peaking EQ** at `[31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]` Hz (`Q = 1.4`, gain `-12..+12 dB`).
5. **Bass & treble shelves**:
   - Low shelf at `100 Hz`, gain `bassBoost * 0.12` dB (`0..+12 dB`).
   - High shelf at `8000 Hz`, gain `trebleBoost * 0.12` dB (`0..+12 dB`).
6. **Bypassable System Rack** (`eq.enabled && eq.rack?.enabled`):
   - **High-pass cut**: `0` = bypass, else `20..1000 Hz`, 12 dB/oct Butterworth (`Q = 1/sqrt(2)`).
   - **Low-pass cut**: `0` = bypass, else `1000..20000 Hz`, 12 dB/oct Butterworth (`Q = 1/sqrt(2)`).
   - **3 parametric peaking bands**: `frequency` `20..20000 Hz`, `gain` `-12..+12 dB`, `q` `0.2..12`.
7. **Stereo matrix**: Mid/Side `stereoWidth` (`0..200%`, `100%` = unity) and `mono` folddown.
8. **Channel alignment**: stereo `balance` (`-1..+1`), `outputTrimDb` (`-24..0 dB`, attenuation-only), independent `invertLeft` / `invertRight` polarity (`-1` multiplier).
9. **Common stereo delay**: `delayMs` (`0..100 ms`; distance display uses `343 m/s` theoretical acoustic speed).
10. **Soft-knee sample guard & ceiling**: waveshaper/sample bound (`peakProtection !== false`) before master output volume.

## Filter coefficient rules (`src/services/dsp.ts`)

- **Nyquist clamp:** Always compute angular frequency with `Math.min(sampleRate * 0.45, frequency)`. Never pass unclamped 16 kHz or 20 kHz centers at 8 kHz / 16 kHz / 22.05 kHz sample rates.
- **Headroom estimation (`headroomDb`):**
  - Probes 257 log-spaced frequencies from `10 Hz` to `Math.min(22000, sampleRate * 0.49)`, **plus** all 10 `EQ_FREQUENCIES` and all 3 `rack.parametric` center frequencies so narrow `Q = 12` boosts cannot slip between log grid points.
  - Adds preamp (`eq.preamp`), stereo width worst-case sum (`20 * log10(max(1, width))` when not mono), and a `+1 dB` safety margin, clamped to `>= 0 dB`.
- **Bypass semantics:**
  - `eq.enabled === false` bypasses the 10-band EQ, shelves, preamp/headroom, and the Studio rack, while `peakProtection` remains independently governed.
  - `eq.rack.enabled === false` neutralizes HPF, LPF, 3 PEQ bells, `outputTrimDb`, `delayMs`, and polarity inversions without clearing their stored knob positions.

## Loudness & UX safety rules

- `outputTrimDb` is strictly `[-24, 0]` dB—never allow positive system trim.
- When `rackTrim(eq) < 0`, **Reset rack** and **Reset to flat** must require explicit user confirmation before removing attenuation.
- Single-deck tools (`StudioDeck.tsx`: playback speed `0.5x..3x`, temporary track-bound cue point, manual `tapTempo` with `<200 ms` debounce and `>2200 ms` silence reset) act on the single local/cloud player—never label them as beat-grid sync or two-deck DJ mixing.
