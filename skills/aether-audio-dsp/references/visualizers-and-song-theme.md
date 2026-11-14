# Visualizers, Fullscreen Oscilloscope & Song-Aware Themes

## Visualizer modes & platform honesty

Aether defines five `VisualizerMode` values (`"bars"`, `"wave"`, `"nebula"`, `"vu-meter"`, `"31-band"`):

- **Web browsers:** Full `AnalyserNode` time-domain (`wave` oscilloscope), FFT spectrum (`bars`, `nebula`, `31-band`), and independent stereo L/R channel RMS (`vu-meter` Analog VU).
- **Native Android:** `AetherDspProcessor` publishes real measured stereo PCM16 L/R RMS, peak, and overload flags (`Meter`). Android does **not** bridge native FFT or waveform arrays. Therefore:
  - Analog VU (`vu-meter`) works natively on Android and can expand fullscreen.
  - Spectrum/oscilloscope modes must remain explicitly marked unavailable on Android rather than rendering fake animations or starting WebView audio.

## Fullscreen visualization (`useExpandedPlayer.ts`, `FullscreenPlayer.tsx`)

- Selecting **Oscilloscope** (`"wave"`) in Now Playing automatically expands the visualizer into the player viewport; any active visualizer can also toggle **Fullscreen / Back to player**.
- Attempt the browser Fullscreen API when permitted, but always provide seamless in-viewport expansion fallback when Fullscreen API is denied or blocked by iframe/sandbox permissions.
- Pressing `Escape` exits expanded visualization *before* closing Now Playing.
- Opening Equalizer or Track Tag Editor while expanded must exit player-owned browser fullscreen first so dialogs remain visible and receive keyboard focus.
- Expanding or collapsing visualizations must never recreate the audio element or interrupt playback/seek state.

## Song-aware automatic themes (`src/services/songTheme.ts`, `useSongTheme.ts`)

When `settings.autoTheme` is enabled and `autoThemeSource === "song"` (default):

1. **Tap location:** Read `songAnalyser` at **4 Hz** from decoded browser audio *prior* to EQ and volume. Skip work when `document.hidden` is true.
2. **Extracted features (`extractSongFeatures`):**
   - `rms` from waveform; if `rms < 0.002` or total spectral power `< 1e-12`, zero `previous` spectrum so silence/fade-outs never trigger false onset flux.
   - `bass` ratio (`30..250 Hz`), `treble` ratio (`>3500 Hz`), spectral `centroid`, and normalized positive spectral `flux` across `30..min(16000, sr/2) Hz`.
3. **Classification & anti-flicker (`SongThemeTracker`):**
   - Rolling window of 24 frames (~6 s); requires at least 12 valid frames (~3 s) plus an 8-frame (~2 s) consistent candidate streak (~5 s initial lock) and an **8,000 ms minimum dwell** between changes.
   - Classifies into `"balanced" | "calm" | "warm" | "deep" | "bright" | "energetic"`.
4. **Palette blending (`songAccent`):**
   - Blends 80% character palette + 20% extracted artwork hex, then lifts luminance iteratively until `themeLuminance(rgb) >= 0.42` for dark-UI contrast readability.
5. **Fallbacks:**
   - Before live lock—or on native Android where source FFT is absent—use transparent `metadataCharacter(track)` genre heuristics + artwork palette, and disclose live vs. fallback status in Playback Settings.
   - Selecting a manual theme sets `autoTheme: false`.
