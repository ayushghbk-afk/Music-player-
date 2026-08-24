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

## Notes

- User music files are imported into the app through the Android file picker and stored locally by the WebView/IndexedDB layer.
- Voice recording requires the Android microphone permission.
- The app can be updated over an existing install without deleting local app data as long as the same package ID/signing key is used.
- For Play Store release builds, create a signed release APK/AAB in Android Studio or add a signing configuration to the Gradle project.
