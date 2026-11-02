# Studio: Simple and Extreme

## What changed

Open **Studio / Equalizer** in the navigation, or the dock’s **Open equalizer** button. The view selector is shared by the embedded Studio and popup, persists in player preferences and is included in library backups.

- **Simple:** presets, processing bypass, output meters, auto headroom, peak protection, preamp, bass warmth, treble clarity and stereo width.
- **Extreme:** retains those controls and adds the response graph/spectrum, ten-band EQ, A/B and device-local preset tools, a single-deck performance section, and a new system rack.

Changing views changes the interface, not playback or DSP settings. Simple explicitly warns when the Extreme system rack remains active. Built-in tone presets preserve the system rack; **Reset to flat** also clears the rack. If an active rack has negative system trim, resetting it or the whole EQ asks for a second confirmation because removing attenuation can increase loudness.

### Signal chain and boundaries

Local source → track-switch gain → preamp/headroom → ten peaking bands → bass/treble shelves → optional system filters/PEQ → stereo width/mono → balance/trim/polarity → common stereo delay → existing sample guard/ceiling → output volume/hardware path.

The rack starts **bypassed**, with neutral values. It provides:

- Independently bypassable **12 dB/oct Butterworth high-pass (20–1000 Hz) and low-pass (1000–20000 Hz)** filters.
- **Three parametric peaking bands**, each with frequency 20–20000 Hz, gain ±12 dB and Q 0.2–12. Frequency sliders are logarithmic, with editable numeric values for precision. Frequencies clamp to 45% of the actual processing sample rate in both engines.
- **System trim −24 to 0 dB**, left/right polarity inversion and **0–100 ms common stereo delay**. The distance readout assumes 343 m/s; it is not an acoustic measurement.

The browser uses real Web Audio filters, gains and delay nodes. Android has an updated native PCM DSP rack/bridge, using state-preserving delay history and crossfaded banks. No Android WebView audio fallback is added. Overall EQ bypass also bypasses the rack; peak protection remains independently controlled. The response/headroom calculation includes rack filters and probes narrow PEQ centers, but is still an estimate—not a measured room response. The graph excludes delay phase, polarity, balance, mono/width interference and nonlinear peak-guard behavior.

Full rack settings survive EQ import/export and saved presets. A/B snapshots deeply clone parametric bands so one slot cannot mutate the other. User presets remain device-local and outside library backup payloads (the currently selected EQ/rack is included).

## Feature reports

### 1. Two Studio views

**✅ POSITIVE (1)**

1. Simple removes advanced visual clutter while Extreme exposes detailed controls; switching views retains the current audio processing, with an explicit active-rack notice and persisted view preference.

**❌ NEGATIVE (5)**

1. Extreme contains many sections and requires vertical scrolling on phones. Use Simple for quick live adjustments.
2. Hiding advanced controls does not neutralize them. Check the active-rack notice and review Extreme before a session.
3. Built-in tone presets deliberately retain system alignment. Use Reset to flat, with loudness precautions, when a completely neutral setup is needed.
4. Persistence depends on device storage. Export an EQ preset before clearing browser/app data or changing devices.
5. Physical-device touch targets, screen readers and long-session responsiveness still require testing. Use visible focus rings, numeric fields and keyboard scrolling where supported.

### 2. Filter and parametric rack

**✅ POSITIVE (1)**

1. Three adjustable frequency/gain/Q bells and real high/low cuts extend the ten-band EQ, with validated settings, sample-rate-aware coefficients and matching browser/native DSP implementations in source.

**❌ NEGATIVE (5)**

1. The cuts are 12 dB/oct, not adjustable-order Linkwitz–Riley crossovers. Use dedicated speaker-management hardware for driver protection and crossover routing.
2. The graph models filter magnitude; it is not a microphone measurement, calibrated RTA or room correction. Measure the sound system separately.
3. Automatic headroom can offset boosted EQ, changing perceived level. Compare at safe levels and do not mistake compensation for a broken gain control.
4. Switching cut bypass/type or making large sweeps can produce audible transitions; browser and native smoothing differ. Make system changes paused or at low level.
5. Android Java/Media3 changes and new native DSP tests could not be compiled/run locally because Java is absent. Run Gradle tests and a physical-device check before relying on this rack for a live system.

### 3. Output alignment and monitoring

**✅ POSITIVE (1)**

1. Real attenuation, channel polarity and common stereo delay provide practical single-stereo-output alignment controls without adding gain above unity; reset confirmation helps avoid accidentally removing attenuation.

**❌ NEGATIVE (5)**

1. Delay is common to stereo, not per-channel or multi-zone routing. Use external DSP for independent subwoofer/fill/zone timing.
2. Delay changes can cause pitch/transient effects and transport tails, especially in the browser. Set alignment before playback and verify synchronization by listening/measurement.
3. Polarity inversion is not a variable phase rotator and can cause cancellation when channels sum. Check mono compatibility and speaker wiring at low level.
4. RMS/sample-peak meters and the soft guard are not LUFS, true-peak or certified loudspeaker protection. Use appropriate hardware limiters and safe SPL practices.
5. The software delay excludes OS, Bluetooth, DAC and speaker latency; its distance conversion is only theoretical. Measure end-to-end arrival time for actual alignment.

### 4. Single-deck performance tools

**✅ POSITIVE (1)**

1. Playback speed, a track-bound cue jump that preserves playing/paused state, and manual tap-BPM estimation act on the existing local playback engine rather than simulated DJ controls.

**❌ NEGATIVE (5)**

1. There is one deck, with no crossfader or independent headphone cue output. Use a dedicated DJ mixer/application for two-deck performance.
2. Tap BPM is a manual interval estimate, not beat detection, a beat grid or sync. Tap consistently and confirm by ear.
3. Cue is temporary and resets when changing tracks or unmounting the Extreme section (including a view change or closing the Studio popup). It is not a saved hot-cue bank.
4. Speed is engine time stretching, not a pitch-bend wheel or key transposer; large changes can reduce quality and codec/device behavior differs. Test the intended range before use.
5. Browser/native seeks are not guaranteed sample-accurate or zero-latency, especially with system delay or compressed files. Rehearse cue timing; this is not a beat-quantized launch system.

## Verification

- TypeScript check and **48/48 Node tests passed**, including six new tests for migration/validation, cut-filter response, PEQ bandwidth/headroom, deep snapshots, tap tempo and accessible rack controls.
- Production/server, GitHub Pages, and Android client/Capacitor-sync builds passed.
- Chromium real playback at a 220 Hz stereo test tone: baseline RMS ≈0.19486; −12 dB trim ≈0.04975; 1 kHz high-pass ≈0.00978; −12 dB bell at 220 Hz ≈0.04882. These are browser fixture observations, not calibrated listening measurements.
- Browser checks passed for A/B rack isolation, delay-node target/polarity gains, speed/reset, paused cue jumping, tap BPM, preset saving, active-rack disclosure and persisted settings across fresh pages in the same browser profile.
- Both modes fit 320×568, 390×844, 844×390 and 1280×900 with no horizontal page/dialog overflow. Desktop screenshots of both views were inspected.
- Four native JUnit cases were added for trim/polarity/bypass, impulse delay/history flush, actual filtering and invalid-value rejection. **Not run locally.** `npm run android:apk` reached Gradle but failed because `JAVA_HOME`/`java` is unavailable. No new APK is delivered and no native-build success is claimed.
- The supplied headless Chromium occasionally stalled after same-tab reload. Persistence was verified using fresh pages with the same IndexedDB profile; this does not establish physical-browser reload/device behavior.

## Assumptions, running and APK

“Professional DJ and sound system” is interpreted as deeper **single-deck, stereo-output** control, not two decks, external audio-interface channel routing, automatic room correction or a certified hardware processor. All playback remains local-only. Previous song-aware themes, fullscreen visualization and lyrics changes are retained.

```sh
npm ci
npm run dev                   # port 3000; current Arena preview uses 24678
npm run lint
npm test
npm run build
npm run build:pages
npm run build:android         # web assets + native project sync only
npm run android:apk           # needs Java 21 and Android SDK
cd android && ./gradlew testDebugUnitTest
```

With that toolchain installed, the debug APK is normally `android/app/build/outputs/apk/debug/app-debug.apk`. Protect original audio and export metadata/settings before reinstalling a differently signed APK. No push, PR merge or deployment was performed for this request.
