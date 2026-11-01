# Android build notes

See [README.md](README.md#android-build--apk) for the authoritative setup, signing secrets and current verification limitations.

- App ID: `com.aether.audio.player`
- Capacitor 8, Media3 1.5.1, minSdk 24, compile/target SDK 36, Java 21
- Version code 2 / version name 1.1.0
- Playback: ExoPlayer owned by the main looper, MediaSessionService lifecycle, native queue and strict no-WebView-audio routing
- DSP: `AetherDspProcessor` in the Media3 audio sink; ten peaking filters, two shelves, preamp, stereo width, PCM16 output
- Local files: app-private `filesDir/aether-tracks`, metadata in IndexedDB, token-protected loopback raw-byte import with bounded Base64 fallback chunks
- Cleartext denied globally; network security permits only localhost/127.0.0.1 for the import server. Mixed WebView content is denied, so import may use bridge chunks instead.
- Playback service is non-exported; user audio is excluded from Android backup by `allowBackup=false`.
- Release signing reads environment variables; no key is generated, stored or committed by the app.

Build with `npm run android:apk`. A successful build emits `android/app/build/outputs/apk/debug/app-debug.apk`. This sandbox has no Java toolchain, so **no APK has been generated and native compilation remains unverified**. CI defines debug artifact upload and optional signed/minified release builds; run it in GitHub or use a local Android toolchain.
