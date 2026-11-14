# Aether Audio & Studio DSP Skill

Domain playbook for Aether's Web Audio engine, RBJ biquad/Butterworth DSP math, Simple/Extreme Studio modes, 3-band parametric system rack, RMS/VU metering, visualizers, and song-aware spectral themes.

## Contents

- `SKILL.md` — activation rules, non-negotiable audio invariants, and implementation workflow.
- `references/signal-chain-and-math.md` — exact node order, RBJ formulas, Nyquist clamping, headroom calculation, and Web/Android parity rules.
- `references/visualizers-and-song-theme.md` — visualizer telemetry rules, fullscreen oscilloscope behavior, and 4 Hz pre-EQ spectral theme heuristics.
- `checklists/dsp-change-checklist.md` — audio safety, schema migration, accessibility, and verification checklist.

## Suggested smoke test

> Use the `aether-audio-dsp` skill. Inspect `src/services/dsp.ts`, `src/services/studioRack.ts`, and `tests/studio-rack.test.ts`, verify filter headroom behavior for narrow high-Q parametric boosts across 8 kHz to 192 kHz sample rates, and run the test suite.
