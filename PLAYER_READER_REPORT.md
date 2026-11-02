# Fullscreen visualization and lyrics-reader fixes

## Behavior

Selecting **Oscilloscope** in Now Playing expands it automatically. Any visualization also has a **Fullscreen** button; **Back to player** and Escape restore the compact layout. The player fills the viewport and retains playback/seek controls. Where permitted, the browser Fullscreen API also hides browser chrome. If the API is missing or denied (including embedded previews), viewport expansion still works. Only fullscreen owned by this player is exited. Opening the equalizer or lyrics editor waits for that exit so the separate dialog remains visible and keyboard-focused.

The lyrics tab now has a bounded reading box rather than a child whose percentage height overflows an unsized parent. A dedicated fullscreen reader is available. Phone lyrics hide the decorative cover to prioritize text. The toolbar remains outside the scroll region; playback controls remain below it.

Reading controls provide 16–32px text, keyboard scrolling, natural-direction text, long-line wrapping, active-line centering and a **Follow lyrics** action. Scrolling/touch/scroll keys pause following; it resumes after five seconds even if the active timestamp has not changed. Large seeks jump immediately instead of slowly chasing a distant line. Positioning runs before paint, duplicate resize/animation-frame targets are ignored, and browser scroll anchoring is disabled in this independently scrolled reader. Same-time translations highlight together. A line taller than its viewport starts near the top so its beginning is not hidden. Track changes reset reading/follow state.

## Feature reports

### Fullscreen visualization

**✅ POSITIVE (1)**

1. The actual visualization canvas fills the available viewport, resizes with orientation, and keeps the existing audio source and transport controls; denied browser fullscreen does not break expansion.

**❌ NEGATIVE (5)**

1. Native Android still has no waveform/FFT telemetry; its oscilloscope option remains disabled. Native RMS VU can be expanded instead—no invented waveform or WebView audio fallback is introduced.
2. Browser/embedding policies can prohibit hiding browser chrome. Use the viewport fallback or open the website directly when true browser fullscreen is required.
3. Playback controls intentionally reserve some screen space. This is a full-window instrument view, not an edge-to-edge canvas with hidden controls.
4. Quiet sources produce a small/flat trace at the existing amplitude scale. Increase the actual listening signal only if appropriate; display auto-gain and calibrated scope controls are not added.
5. Physical Android/iOS, hardware Back and browser-specific fullscreen behavior still need device checks. Use the visible Back to player / close controls if OS gestures behave differently.

### Lyrics reading box

**✅ POSITIVE (1)**

1. A bounded, keyboard-accessible reader correctly centers synced lines inside its own viewport, wraps long text, preserves controls, supports text size/fullscreen reading and lets the user pause/resume following.

**❌ NEGATIVE (5)**

1. Plain text still has no timestamps; import LRC for sync and tap-to-seek.
2. Following resumes five seconds after manual interaction; use plain-text reading or continue interacting if a long passage needs more time. A permanent manual-follow toggle is not added.
3. Font size is retained only while this reader is mounted, not as a saved preference. Reapply it after closing/reopening Now Playing.
4. Glyph coverage depends on installed fonts; fallback font names are provided, but additional language fonts are not bundled. Verify your device’s script support if text appears as boxes.
5. Very short landscape viewports have less reading space. Use fullscreen lyrics or rotate to portrait for longer passages; no automatic rotation or orientation lock is applied.

## Assumptions, run and APK

“Fullscreen” means filling the player viewport while preserving controls, with optional browser-chrome hiding. “Lyrics reading box” refers to the Now Playing lyrics tab. All changes retain local-only playback and the earlier song-aware themes.

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
npm run build:pages
npm run build:android  # client assets + Capacitor sync, not native Gradle compilation
npm run android:apk    # actual APK; needs Java 21 and Android SDK
```

No new release APK, physical-device result, PR merge or website deployment is implied. Keep original audio and back up metadata before reinstalling a differently signed debug APK.

## Verification

- 42 tests, including reader geometry/clamping/oversized-line handling, keyboard-region/text controls, expansion labels and simultaneous-timestamp highlighting.
- Chromium checks: selecting Oscilloscope expands automatically; canvas fills the available screen; audio source and playing state are unchanged; Escape exits expansion without closing Now Playing; fullscreen lyrics, font controls and word wrapping work.
- Reader geometry, independent scrolling, active-line centering, explicit Follow lyrics and automatic five-second resume tested, including a 600-character unbroken line.
- Layout checks cover touch widths 320×568, 390×844, 430×932, landscape 844×390 and desktop 1280×900: no horizontal overflow, reader stays above controls and dialogs do not overflow vertically in reading mode.
- Missing/denied Fullscreen API paths tested. Real-browser Fullscreen API entry/exit and transitions to the equalizer/lyrics editor (including keyboard focus) passed in Chromium; no physical-device result is implied.
- TypeScript lint and production/Pages/Android client-sync builds are run separately; Android client sync must not be reported as an actual Gradle APK build.
