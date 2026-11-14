# Bridge Architecture, Playback Lifecycle & Storage

## Three playback source modes on Android

`PlaybackManager.java` plays three distinct URI classes through a single `ExoPlayer` instance:

1. **Discovered device audio (`sourceUri`):** `content://media/...` URIs from `MediaStore`. Played directly in place—never copied into `filesDir`, never deleted from storage.
2. **Imported private files (`playStored`):** Files copied during manual file-picker import into `context.getFilesDir()/aether-tracks/<trackId>.<ext>`.
3. **Authenticated cloud streams (`playUrl` with `cloud: true`):** Short-lived HTTPS `/stream/:id?ticket=...` URLs from the Cloudflare Worker. Enables network wake mode and HTTP `Range` seeking without caching private cloud files permanently on disk.

## Import transfer paths (`src/services/aetherPlayer.ts`)

1. **Loopback raw stream (`LocalTrackServer.java`):**
   - Ephemeral localhost port + per-process random token returned by `getServerInfo()`.
   - Uses `window.CapacitorWebFetch` so `CapacitorHttp` does not intercept and Base64-encode the `Blob` body.
   - Note: `capacitor.config.json` sets `androidScheme: "https"` and `allowMixedContent: false`, so Android WebView may reject `http://127.0.0.1` as mixed content and automatically fall back to chunked bridge writes.
2. **Serialized Base64 chunked fallback (`beginCache` -> `appendCache` -> `commitCache`):**
   - Slices blobs into `48 * 1024` byte segments.
   - Wrapped in `const imports = new SerialTaskQueue()` so rapid track clicks + multi-file imports never interleave `activeWrite` calls in `TrackStore.java`.

## Service & audio-session rules (`MusicPlayerService.java`, `PlaybackManager.java`)

- `MediaSessionService` keeps notification transport controls, lock-screen metadata, and headset buttons active.
- `android:stopWithTask="false"` keeps active music playing when the user swipes the Activity recents card away while playing; paused/idle sessions release cleanly.
- Audio focus (`C.AUDIO_CONTENT_TYPE_MUSIC`, `C.USAGE_MEDIA`) and `setHandleAudioBecomingNoisy(true)` pause automatically when headphones/Bluetooth disconnect.
- Native PCM RMS metering (`AetherDspProcessor.getMeter()`) emits via `playerEvent` without `RECORD_AUDIO` capture of the device microphone.
