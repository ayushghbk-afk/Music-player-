# Aether Native Android App

This branch now includes a **native Android app** (Kotlin + Jetpack Compose + Media3) in `android/`. It does **not** use a WebView/Chrome shell for playback or UI.

## What changed

- **Native UI**: Jetpack Compose Material 3 screens for Songs, Albums, Artists, Playlists, Search, collection details, and Now Playing.
- **Native playback**: Media3 `ExoPlayer` + `MediaSessionService` for background playback, notification controls, audio focus, and noisy-headset handling.
- **Device library**: scans device audio via `MediaStore` (with runtime permission handling).
- **Library features**: favorites, user playlists, search, queue, shuffle/repeat, seek.
- **No WebView runtime dependency**: `MainActivity` is a Compose `ComponentActivity`; Capacitor bridge/plugin classes were removed from the Android app path.

## Build

Requires JDK 21 and Android SDK 36.

```bash
cd android
./gradlew :app:assembleDebug
```

APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## CI / Auto APK

GitHub Actions workflow `.github/workflows/android-build.yml` builds a debug APK on pushes to `main` and `arena/**`, pull requests to `main`, and manual dispatch. The debug APK is uploaded as the `aether-native-debug-apk` artifact.

Signed release builds are available via workflow dispatch with the existing `AETHER_*` signing secrets.

## Scope / notes

This is a native foundation rewrite focused on core local playback. The existing web app source remains in the repository, but the Android APK path is now native. Features from the web/Capacitor app that are not yet ported to native UI include cloud sync, AI assistant, lyrics sync editor, advanced studio rack UI, backup/sync server flows, and web-only visualizations. The playback core uses Media3 ExoPlayer; device-specific codec support and OEM background behavior should be validated on real devices.
