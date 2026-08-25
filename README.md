# Aether — Hi-Res Audio Player

A high-resolution offline music player for Android and web, built with React, Capacitor, and native Media3/ExoPlayer playback.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   React UI                       │
│  Components · Views · Hooks · State · Themes     │
└──────────────────────┬──────────────────────────┘
                       │
              Capacitor Bridge
                       │
         ┌─────────────┴─────────────┐
         │                           │
    Android Native              Web Browser
         │                           │
  ┌──────┴──────┐              HTMLAudioElement
  │             │              + Web Audio API
ExoPlayer  MediaSession        (EQ · Visualizer)
  │             │
  └──────┬──────┘
         │
MediaSessionService
(Foreground Service)
         │
    ┌────┼────┐
    ▼    ▼    ▼
 Lock  Notif  BT
Screen  bar  Controls
```

### Native Android Playback

On Android, audio playback is **not** handled by the WebView — and never falls back to it. The native layer is the single source of truth for the entire playback lifecycle:

- **`PlaybackManager`** — Singleton wrapping ExoPlayer with audio focus, wake lock, headset unplug detection, and position persistence. Playback commands are deferred until the foreground service is alive, guaranteeing the ordering *service → media session → setMediaItem → prepare → play*. The player is owned by the main looper; all plugin access is dispatched to main.
- **`MusicPlayerService`** — `MediaSessionService` foreground service that keeps audio alive when the app is backgrounded or the screen is locked. `onTaskRemoved()` keeps the service alive while playback is *actively* playing or buffering, and cleanly stops otherwise.
- **`MusicPlayerPlugin`** — Capacitor plugin bridging React commands (play, pause, seek, volume) to the native player, plus track-store management and a loopback import server
- **`TrackStore`** — Persistent app-private storage (`filesDir/aether-tracks`) for imported audio; a track is imported once and then streamed from disk forever — never through the JS bridge on the playback path
- **`LocalTrackServer`** — Loopback-only HTTP server the WebView streams imported files to (raw bytes, no Base64; falls back to chunked plugin imports if unavailable)
- **`audioEngine.ts`** — Detects Android via `Capacitor.isNativePlatform()` and routes *all* playback commands through the native plugin; native playback state flows back through plugin events. Web `HTMLAudioElement` playback is used in browsers only — on Android a native failure surfaces as an error rather than silently switching engines

### Web Playback

In the browser, playback uses the standard `HTMLAudioElement` with a Web Audio API processing chain:

```
Source → Preamp → 10-Band EQ → Bass → Treble → Analyser → Master Gain → Output
```

## Features

### Playback
- Background playback (foreground service on Android)
- Media notification with transport controls
- Lock-screen controls via MediaSession
- Bluetooth / headset controls
- Headset unplug auto-pause
- Audio focus management
- Resume last position on restart
- Shuffle and repeat (off / all / one)
- Playback speed control
- Gapless playback support

### Library
- Local file import (FLAC, WAV, MP3, AAC, OGG, ALAC)
- Offline storage — IndexedDB in the browser, persistent native storage (`filesDir`) on Android
- Albums view
- Playlists (create, edit, delete)
- Favorites
- Track tag editor
- Search and sort
- Hi-Res vault filter

### Audio
- 10-band parametric equalizer
- Bass boost and treble boost
- Stereo width control
- Preamp gain
- EQ presets
- Real-time audio visualizer (bars, waveform, nebula, VU meter, 31-band)
- Codec and bitrate display

### AI Assistant
- Sound engineering guidance
- EQ preset recommendations
- Audio format comparisons
- Spatial audio tuning tips

### Sync & Backup
- Full library export (.aetherjson)
- Backup restore with deduplication
- Storage usage stats

## Project Structure

```
aether/
├── android/
│   └── app/src/main/
│       ├── java/.../player/
│       │   ├── MainActivity.java
│       │   └── playback/
│       │       ├── MusicPlayerPlugin.java    # Capacitor bridge
│       │       ├── MusicPlayerService.java   # Foreground service
│       │       └── PlaybackManager.java      # ExoPlayer wrapper
│       └── AndroidManifest.xml
├── src/
│   ├── components/
│   │   ├── AiAssistantView.tsx
│   │   ├── AlbumsView.tsx
│   │   ├── AudioVisualizer.tsx
│   │   ├── BackupSyncCenter.tsx
│   │   ├── EqualizerModal.tsx
│   │   ├── FullscreenPlayer.tsx
│   │   ├── ImportDropzone.tsx
│   │   ├── MobileBottomNav.tsx
│   │   ├── PlayerDock.tsx
│   │   ├── PlaylistsView.tsx
│   │   ├── Sidebar.tsx
│   │   ├── SongList.tsx
│   │   └── TrackTagEditor.tsx
│   ├── services/
│   │   ├── aetherPlayer.ts     # Capacitor plugin interface
│   │   ├── audioEngine.ts      # Playback engine (native + web)
│   │   ├── db.ts               # IndexedDB storage
│   │   └── sampleLibrary.ts    # Demo track generator
│   ├── types.ts
│   ├── App.tsx
│   └── main.tsx
├── scripts/
│   └── generate-android-assets.mjs
├── public/
│   ├── manifest.json
│   ├── sw.js
│   └── pwa-*.png
├── capacitor.config.json
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Build

### Requirements

- Node.js 22+
- Java JDK 21
- Android Studio / Android SDK (for APK builds)

### Web Development

```bash
npm ci
npm run dev
```

### Android APK

```bash
npm ci
npm run android:apk
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Open in Android Studio

```bash
npm run android:open
```

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 19, TypeScript, Tailwind CSS 4 |
| Build | Vite 6, esbuild |
| Android Shell | Capacitor 8 |
| Native Playback | Media3 / ExoPlayer 1.5 |
| Background Audio | MediaSessionService (foreground service) |
| Web Audio | Web Audio API (EQ, visualizer) |
| Storage | IndexedDB (via `idb`) |
| Animations | Motion (Framer Motion) |
| Icons | Lucide React |

## License

MIT
