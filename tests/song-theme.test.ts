import test from "node:test";
import assert from "node:assert/strict";
import {
  extractSongFeatures,
  classifySongWindow,
  metadataCharacter,
  songAccent,
  themeLuminance,
  SONG_PALETTES,
  SongThemeTracker,
  type SongFeatures,
  type SongCharacter,
} from "../src/services/songTheme";
import { settingsSchema } from "../src/services/backupSchema";
const frame = (patch: Partial<SongFeatures> = {}): SongFeatures => ({
  rms: 0.12,
  bass: 0.3,
  treble: 0.08,
  centroid: 1000,
  flux: 0.01,
  ...patch,
});
function spectrum(frequency: number, gain = 0) {
  const bins = new Float32Array(1024).fill(-Infinity);
  bins[Math.round(frequency / (48000 / 2048))] = -12 + gain;
  return bins;
}
const wave = new Float32Array(2048).fill(0.1);
test("decoded spectral features distinguish bass and bright sound without filename guesses", () => {
  const low = extractSongFeatures(
    spectrum(120),
    wave,
    48000,
    new Float32Array(1024),
  );
  const high = extractSongFeatures(
    spectrum(8000),
    wave,
    48000,
    new Float32Array(1024),
  );
  assert.ok(low.bass > 0.99 && low.centroid < 150);
  assert.ok(high.treble > 0.99 && high.centroid > 7900);
  assert.equal(classifySongWindow(Array(24).fill(low)), "deep");
  assert.equal(classifySongWindow(Array(24).fill(high)), "bright");
});
test("normalized spectral flux ignores uniform gain changes but detects spectral changes", () => {
  const previous = new Float32Array(1024);
  assert.equal(
    extractSongFeatures(spectrum(120), wave, 48000, previous).flux,
    0,
  );
  assert.ok(
    extractSongFeatures(spectrum(120, 6), wave, 48000, previous).flux < 1e-6,
  );
  assert.ok(
    extractSongFeatures(spectrum(8000), wave, 48000, previous).flux > 0.99,
  );
});
test("silence and nonfinite FFT values cannot fabricate activity", () => {
  const previous = new Float32Array(1024).fill(1);
  const features = extractSongFeatures(
    new Float32Array(1024).fill(NaN),
    new Float32Array(2048),
    48000,
    previous,
  );
  assert.deepEqual(features, {
    rms: 0,
    bass: 0,
    treble: 0,
    centroid: 0,
    flux: 0,
  });
  assert.ok(previous.every((n) => n === 0));
});
test("rolling sound-character classifier covers calm, warm and energetic textures", () => {
  assert.equal(classifySongWindow([frame({ rms: 0.04 })]), "calm");
  assert.equal(classifySongWindow([frame()]), "warm");
  assert.equal(classifySongWindow([frame({ flux: 0.3 })]), "energetic");
  assert.equal(
    classifySongWindow(
      Array.from({ length: 24 }, (_, i) => frame({ rms: i % 2 ? 0.35 : 0.01 })),
    ),
    "energetic",
  );
  assert.equal(classifySongWindow([]), "balanced");
});
test("theme tracker requires warmup, confirmation and eight-second dwell", () => {
  const tracker = new SongThemeTracker("balanced");
  const deep = frame({ bass: 0.9, centroid: 150 }),
    bright = frame({ treble: 0.8, centroid: 6000 });
  const changes: { time: number; character: SongCharacter }[] = [];
  for (let i = 0; i < 19; i++) {
    const character = tracker.push(deep, i * 250);
    if (character) changes.push({ time: i * 250, character });
  }
  assert.deepEqual(changes, [{ time: 4500, character: "deep" }]);
  for (let i = 19; i < 90; i++) {
    const character = tracker.push(bright, i * 250);
    if (character) changes.push({ time: i * 250, character });
  }
  assert.equal(changes.length, 2);
  assert.equal(changes[1].character, "bright");
  assert.ok(changes[1].time - changes[0].time >= 8000);
});
test("silence resets partial evidence and cannot change the current theme", () => {
  const tracker = new SongThemeTracker("calm");
  const bright = frame({ treble: 0.8, centroid: 6000 });
  for (let i = 0; i < 15; i++)
    assert.equal(tracker.push(bright, i * 250), null);
  assert.equal(tracker.push(frame({ rms: 0 }), 4000), null);
  for (let i = 0; i < 18; i++)
    assert.equal(tracker.push(bright, 4250 + i * 250), null);
  assert.equal(tracker.push(bright, 8750), "bright");
});
test("genre fallback is provisional and does not interpret song titles or lyrics", () => {
  assert.equal(metadataCharacter({ genre: "Ambient / Chill" }), "calm");
  assert.equal(metadataCharacter({ genre: "Jazz" }), "warm");
  assert.equal(metadataCharacter({ genre: "Metal" }), "energetic");
  assert.equal(metadataCharacter({ genre: "Hip-Hop" }), "deep");
  assert.equal(metadataCharacter({ genre: "Pop" }), "bright");
  assert.equal(metadataCharacter(null), "balanced");
  assert.equal(metadataCharacter({ genre: "" }), "balanced");
});
test("all sound palettes blend with artwork while preserving readable luminance", () => {
  for (const character of Object.keys(SONG_PALETTES) as SongCharacter[])
    for (const artwork of [
      "#0000ff",
      "#ff0000",
      "#000000",
      "#ffffff",
      "invalid",
    ]) {
      const accent = songAccent(character, artwork);
      assert.match(accent, /^#[0-9a-f]{6}$/);
      const rgb = [1, 3, 5].map((i) => parseInt(accent.slice(i, i + 2), 16));
      assert.ok(themeLuminance(rgb) > 0.415);
    }
  assert.notEqual(
    songAccent("deep", "#cccccc"),
    songAccent("bright", "#cccccc"),
  );
});
test("old preferences default to sound analysis and reject invalid theme sources", () => {
  const settings = {
    gapless: true,
    crossfadeSec: 0,
    theme: "obsidian",
    visualizerMode: "bars",
    volume: 0.85,
    playbackRate: 1,
    resampleRate: "native",
    autoPlayNext: true,
  };
  assert.equal(settingsSchema.parse(settings).autoThemeSource, "song");
  assert.equal(
    settingsSchema.safeParse({ ...settings, autoThemeSource: "remote-ai" })
      .success,
    false,
  );
});
