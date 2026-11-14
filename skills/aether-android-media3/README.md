# Aether Android & Media3 Native Bridge Skill

Playbook for working on Aether's Capacitor 8 Android wrapper, Media3 `ExoPlayer` / `MediaSessionService`, native PCM16 DSP, `LocalTrackServer` / serialized chunked imports, `MediaStore` discovery, and GitHub Actions APK builds.

## Contents

- `SKILL.md` — non-negotiable Android invariants, JS/Java workflow, and verification boundaries.
- `references/bridge-and-playback-lifecycle.md` — `AetherPlayer` plugin contract, playback sources, `MediaStore` reconciliation, and import serialization.
- `references/build-signing-and-ci.md` — SDK/Java pins, `build:android` vs `android:apk`, release keystore env vars, and CI diagnostics.
- `checklists/android-safety-checklist.md` — thread safety, permission, storage, and build checklist.

## Suggested smoke test

> Use the `aether-android-media3` skill. Audit `src/services/androidLibrary.ts`, `src/services/aetherPlayer.ts`, and `tests/android-library.test.ts` to confirm disconnected SD-card volumes and hidden tracks are preserved during MediaStore rescans, then run `npm test` and `npm run build:android`.
