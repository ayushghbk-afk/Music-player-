# Aether Hi-Res Audio Player Android App

This repository now includes a complete Capacitor Android shell for the React/Vite music player.

## What is included

- Native Android project in `android/`
- App ID: `com.aether.audio.player`
- App name: `Aether Hi-Res Audio Player`
- Android launcher icons and splash assets generated from the Aether Audio brand
- Native Android permissions for audio import, microphone recording, wake lock, and audio settings
- Capacitor App, Splash Screen, and Status Bar plugins
- Android hardware back-button behavior in the React app
- GitHub Actions workflow that builds a debug APK artifact

## Local build requirements

- Node.js 22+
- Java JDK 21
- Android Studio / Android SDK

## Build commands

```bash
npm ci
npm run build:android
npm run android:apk
```

The debug APK will be created at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Open in Android Studio

```bash
npm run android:open
```

## Native playback (Media3)

Android playback is no longer bound to the Capacitor WebView.

- React UI still owns the library, queue, shuffle/repeat, and screens
- `AetherPlayer` Capacitor plugin writes the selected IndexedDB blob into app cache
- `PlaybackManager` + ExoPlayer / Media3 plays that file
- `MusicPlayerService` is a `MediaSessionService` foreground service

That stack is what keeps audio alive when the screen locks, the app is backgrounded, or Bluetooth / notification controls are used. Headphone unplug and audio focus are handled natively.

Web playback is unchanged in the browser.
