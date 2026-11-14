# Android & Media3 Safety Checklist

Mark each item pass, fail, or N/A after actual verification.

## Playback & thread safety
- [ ] Zero WebView `HTMLAudioElement` or Web Audio fallback paths execute when `Capacitor.getPlatform() === "android"`.
- [ ] All `ExoPlayer` calls run on the Android main looper.
- [ ] Audio focus, headphone unplug (`becomingNoisy`), and wake locks remain intact for both local and HTTPS cloud tracks.

## Storage & user data safety
- [ ] `MediaStore` `content://` tracks are never copied or deleted on disk.
- [ ] Removing a discovered track adds its ID to `hiddenMediaTracks` without deleting device files.
- [ ] `reconcileAndroidLibrary` only removes missing entries from volumes present in the current scan (`volumes`).
- [ ] Manual chunked imports go through `SerialTaskQueue` so `beginCache`/`appendCache`/`commitCache` cannot interleave.

## Manifest, resources & compatibility
- [ ] `minSdk 24` compatibility is preserved (API 27+ attributes isolated in `res/values-v27/`).
- [ ] `usesCleartextTraffic="false"`, `allowBackup="false"`, and `MusicPlayerService` `exported="false"` remain enforced.
- [ ] No keystore, password, or secret is committed or logged.

## Verification
- [ ] `npm run lint` and `npm test` (`android-library.test.ts`, `native-import-queue.test.ts`) pass.
- [ ] `npm run build:android` succeeds (and `npm run build` is re-run if `dist/server.cjs` is needed).
- [ ] Local Gradle vs. GitHub Actions CI status is reported accurately without claiming unexecuted device tests.
