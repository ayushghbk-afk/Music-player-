# Android App

The Android app is now a **native Kotlin + Jetpack Compose + Media3** application (no WebView/Chrome runtime for the player UI).

See [NATIVE_ANDROID.md](NATIVE_ANDROID.md) for build instructions, CI auto-APK workflow, and scope notes.

## Quick build

```bash
cd android
./gradlew :app:assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

## CI

`.github/workflows/android-build.yml` builds and uploads `aether-native-debug-apk` automatically on pushes/PRs/manual dispatch.
