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

Build with `npm run android:apk` on a machine with Java 21/SDK 36. A successful build emits `android/app/build/outputs/apk/debug/app-debug.apk`.

**Verified in GitHub Actions:** [run 41317759218](https://github.com/ayushghbk-afk/Music-player-/actions/runs/41317759218) successfully compiled `assembleDebug`, passed `lintDebug`, verified the debug APK with `apksigner`, and uploaded `aether-debug-apk`. Download/extract that artifact to get `app-debug.apk`. The runner is pinned to Ubuntu 22.04 and uses its preinstalled SDK manager; API-27 theme attributes are version-qualified so minSdk 24 stays supported.

The sandbox still has no native SDK. Physical-device playback, OEM background policies and signed/minified production release behavior remain unverified. The downloadable build uses a debug signing identity, not a release key.
