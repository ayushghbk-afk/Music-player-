import type { Track } from "../types";

export type SongCharacter =
  | "balanced"
  | "calm"
  | "warm"
  | "deep"
  | "bright"
  | "energetic";
export interface SongFeatures {
  rms: number;
  bass: number;
  treble: number;
  centroid: number;
  flux: number;
}
export const SONG_PALETTES: Record<SongCharacter, string> = {
  balanced: "#b4c3db",
  calm: "#93c9bd",
  warm: "#e4b48e",
  deep: "#aeb1f3",
  bright: "#e6cf91",
  energetic: "#f2a79b",
};

/** Measurements of decoded sound, not a genre/emotion/lyrics recognizer. Previous spectrum stores normalized power. */
export function extractSongFeatures(
  db: Float32Array,
  waveform: Float32Array,
  sampleRate: number,
  previous: Float32Array,
): SongFeatures {
  let total = 0,
    weighted = 0,
    bass = 0,
    treble = 0,
    rms = 0;
  const binHz = sampleRate / (db.length * 2);
  for (const sample of waveform)
    rms += Number.isFinite(sample) ? sample * sample : 0;
  rms = Math.sqrt(rms / Math.max(1, waveform.length));
  for (let i = 1; i < db.length; i++) {
    const frequency = i * binHz;
    if (frequency < 30 || frequency > Math.min(16000, sampleRate / 2)) continue;
    const power = Number.isFinite(db[i])
      ? 10 ** (Math.max(-140, Math.min(20, db[i])) / 10)
      : 0;
    total += power;
    weighted += power * frequency;
    if (frequency < 250) bass += power;
    if (frequency > 3500) treble += power;
  }
  let flux = 0;
  // Quiet/silent frames do not turn a fade-out into an invented energetic onset.
  if (rms < 0.002 || total < 1e-12) {
    previous.fill(0);
    return { rms, bass: 0, treble: 0, centroid: 0, flux: 0 };
  }
  let hasPrevious = false;
  for (let i = 1; i < previous.length; i++)
    if (previous[i] > 0) {
      hasPrevious = true;
      break;
    }
  for (let i = 1; i < db.length; i++) {
    const frequency = i * binHz;
    const normalized =
      frequency >= 30 &&
      frequency <= Math.min(16000, sampleRate / 2) &&
      Number.isFinite(db[i])
        ? 10 ** (Math.max(-140, Math.min(20, db[i])) / 10) / total
        : 0;
    if (hasPrevious) flux += Math.max(0, normalized - (previous[i] || 0));
    previous[i] = normalized;
  }
  return {
    rms,
    bass: bass / total,
    treble: treble / total,
    centroid: weighted / total,
    flux: Math.min(1, flux),
  };
}

/** A transparent provisional fallback, restricted to genre tags rather than guesses from song titles. */
export function metadataCharacter(
  track: Pick<Track, "genre"> | null,
): SongCharacter {
  const genre = (track?.genre || "").toLowerCase();
  if (/metal|punk|dance|techno|house|edm|drum.?and.?bass/.test(genre))
    return "energetic";
  if (/ambient|meditation|chill|sleep|lo.?fi/.test(genre)) return "calm";
  if (/jazz|soul|blues|folk|acoustic/.test(genre)) return "warm";
  if (/dub|trap|hip.?hop|bass/.test(genre)) return "deep";
  if (/pop|disco|funk/.test(genre)) return "bright";
  return "balanced";
}
export function classifySongWindow(frames: SongFeatures[]): SongCharacter {
  if (!frames.length) return "balanced";
  const mean = (key: keyof SongFeatures) =>
    frames.reduce((sum, f) => sum + f[key], 0) / frames.length;
  const rms = mean("rms"),
    bass = mean("bass"),
    treble = mean("treble"),
    centroid = mean("centroid"),
    flux = mean("flux");
  const dynamics =
    Math.sqrt(
      frames.reduce((sum, f) => sum + (f.rms - rms) ** 2, 0) / frames.length,
    ) / Math.max(0.002, rms);
  if (flux > 0.16 || (dynamics > 0.65 && rms > 0.025)) return "energetic";
  if (bass > 0.68 && centroid < 700) return "deep";
  if (treble > 0.38 || centroid > 3500) return "bright";
  if (rms < 0.09 && treble < 0.12 && centroid < 1800) return "calm";
  return "warm";
}

/** ~6 s rolling window at 4 Hz; 2 s confirmation and 8 s dwell prevent flicker. */
export class SongThemeTracker {
  private frames: SongFeatures[] = [];
  private candidate: SongCharacter | null = null;
  private streak = 0;
  private confirmed = false;
  private changedAt = -Infinity;
  constructor(private current: SongCharacter) {}
  push(frame: SongFeatures, now: number): SongCharacter | null {
    if (!Object.values(frame).every(Number.isFinite) || frame.rms < 0.002) {
      this.frames = [];
      this.candidate = null;
      this.streak = 0;
      return null;
    }
    this.frames.push(frame);
    if (this.frames.length > 24) this.frames.shift();
    if (this.frames.length < 12) return null;
    const candidate = classifySongWindow(this.frames);
    this.streak = candidate === this.candidate ? this.streak + 1 : 1;
    this.candidate = candidate;
    if (
      this.streak < 8 ||
      now - this.changedAt < 8000 ||
      (this.confirmed && candidate === this.current)
    )
      return null;
    this.current = candidate;
    this.confirmed = true;
    this.changedAt = now;
    return candidate;
  }
}

export function themeLuminance(rgb: number[]): number {
  return rgb
    .map((n) => {
      const s = n / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
}
export function songAccent(character: SongCharacter, artwork: string): string {
  const palette = SONG_PALETTES[character];
  const safeArtwork = /^#[0-9a-f]{6}$/i.test(artwork) ? artwork : palette;
  let rgb = [1, 3, 5].map(
    (i) =>
      parseInt(palette.slice(i, i + 2), 16) * 0.8 +
      parseInt(safeArtwork.slice(i, i + 2), 16) * 0.2,
  );
  for (let i = 0; i < 32 && themeLuminance(rgb) < 0.42; i++)
    rgb = rgb.map((n) => n + (255 - n) * 0.06);
  return (
    "#" + rgb.map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")
  );
}
