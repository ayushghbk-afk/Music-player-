# Gradle Toolchain, Signing & GitHub Actions CI

## Toolchain versions

- **Package ID:** `com.aether.audio.player`
- **Java:** Temurin 21
- **Android SDK:** `minSdk 24`, `compileSdk 36`, `targetSdk 36`, Build-Tools `36.0.0`
- **Capacitor:** `8.6.0` (do **not** run `npm audit fix --force`, which attempts a breaking downgrade to Capacitor 4)
- **Media3:** `1.5.1` (`media3-exoplayer`, `media3-session`, `media3-common`)

## Build scripts & side effects

| Command | What it actually does | Requires Java/SDK? |
|---|---|---|
| `npm run assets:android` | Generates launcher icons, splash PNGs, and PWA icons from `public/aether-mark.svg` via `sharp` | No |
| `npm run build:android` | Runs `assets:android`, `vite build`, `finalize-pwa.mjs`, and `npx cap sync android` | No |
| `npm run android:apk` | Runs `build:android` then `cd android && ./gradlew assembleDebug` | **Yes** |
| `./gradlew testDebugUnitTest assembleDebug lintDebug` | Runs native JUnit DSP tests, builds debug APK, and runs Android Lint | **Yes** |

**Gotcha:** `npm run build:android` wipes and rebuilds `dist/` without `dist/server.cjs`. If you subsequently test `npm start` (production Express companion server), run `npm run build` again first.

## Release signing (`android/app/build.gradle`, `.github/workflows/android-build.yml`)

- Never generate, commit, or log `.jks` / `.keystore` files (ignored in `.gitignore`).
- Signed releases run via GitHub Actions `workflow_dispatch` (`release: true`) using repository secrets:
  - `AETHER_KEYSTORE_BASE64` (decoded to `$RUNNER_TEMP/aether-release.jks` with `chmod 600` and deleted in an `if: always()` step)
  - `AETHER_STORE_PASSWORD`
  - `AETHER_KEY_ALIAS`
  - `AETHER_KEY_PASSWORD`
- Increment `versionCode` in `android/app/build.gradle` before distributing a new signed release.
