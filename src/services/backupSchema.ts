import { z } from "zod";
import { defaultStudioRack } from "./studioRack";

const text = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) =>
      s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""),
    );
const id = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9._-]+$/);
const number = (min: number, max: number) =>
  z.number().finite().min(min).max(max);
const gradient =
  /^linear-gradient\(\d{1,3}deg, #[a-fA-F0-9]{6} \d{1,3}%, #[a-fA-F0-9]{6} \d{1,3}%, #[a-fA-F0-9]{6} \d{1,3}%\)$/;
const artwork = z
  .string()
  .max(1_400_000)
  .refine(
    (s) =>
      gradient.test(s) ||
      /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s) ||
      /^\/(?!\/)[a-zA-Z0-9/_.-]+$/.test(s),
    "Only embedded raster or local artwork is allowed",
  );
export const studioRackSchema = z.object({
  enabled: z.boolean(),
  highPassHz: number(0, 1000).refine((v) => v === 0 || v >= 20),
  lowPassHz: number(0, 20000).refine((v) => v === 0 || v >= 1000),
  parametric: z
    .array(
      z.object({
        frequency: number(20, 20000),
        gain: number(-12, 12),
        q: number(0.2, 12),
      }),
    )
    .length(3),
  outputTrimDb: number(-24, 0),
  delayMs: number(0, 100),
  invertLeft: z.boolean(),
  invertRight: z.boolean(),
});
export const eqSchema = z.object({
  enabled: z.boolean(),
  preset: text(100),
  bands: z.array(number(-12, 12)).length(10),
  preamp: number(-12, 12),
  bassBoost: number(0, 100),
  trebleBoost: number(0, 100),
  stereoWidth: number(0, 200),
  autoHeadroom: z.boolean().default(true),
  peakProtection: z.boolean().default(true),
  balance: number(-1, 1).default(0),
  mono: z.boolean().default(false),
  rack: studioRackSchema.default(defaultStudioRack),
});
export const settingsSchema = z.object({
  gapless: z.boolean(),
  crossfadeSec: number(0, 12),
  theme: z.enum(["obsidian", "sapphire", "cyberpunk", "studio-gold", "slate"]),
  visualizerMode: z.enum(["bars", "wave", "nebula", "vu-meter", "31-band"]),
  volume: number(0, 1),
  playbackRate: number(0.5, 3),
  resampleRate: z.enum(["native", "96khz", "192khz"]),
  autoPlayNext: z.boolean(),
  autoTheme: z.boolean().default(true),
  autoThemeSource: z.enum(["song", "artwork"]).default("song"),
  studioView: z.enum(["simple", "extreme"]).default("simple"),
});
export const trackSchema = z.object({
  id,
  title: text(500),
  artist: text(500),
  album: text(500),
  duration: number(0, 86400),
  format: z.enum(["FLAC", "WAV", "ALAC", "MP3", "AAC", "OGG", "DSD"]),
  bitrate: text(200),
  isHiRes: z.boolean(),
  coverArt: artwork.optional(),
  addedAt: number(0, 1e15),
  playCount: number(0, 1e12),
  lastPlayed: number(0, 1e15).optional(),
  year: number(0, 9999).optional(),
  genre: text(500).optional(),
  trackNumber: number(0, 99999).optional(),
  lyrics: text(100000).optional(),
  originalFileName: text(500).optional(),
  fileSizeMB: number(0, 1e7).optional(),
  sampleRate: number(0, 768000).optional(),
  bitDepth: number(0, 64).optional(),
});
export const backupSchema = z.object({
  version: z.literal("1.0.0"),
  exportedAt: z.string().datetime(),
  name: text(100).optional(),
  trackMetadata: z.array(trackSchema).max(10000),
  playlists: z
    .array(
      z.object({
        id,
        name: text(100),
        description: text(1000),
        trackIds: z.array(id).max(10000),
        createdAt: number(0, 1e15),
        updatedAt: number(0, 1e15),
        coverArt: artwork.optional(),
        color: text(50).optional(),
      }),
    )
    .max(1000),
  favorites: z.array(id).max(10000),
  settings: settingsSchema,
  eqSettings: eqSchema,
});
export function validateBackup(value: unknown) {
  const parsed = backupSchema.parse(value);
  parsed.trackMetadata = [
    ...new Map(parsed.trackMetadata.map((t) => [t.id, t])).values(),
  ];
  parsed.playlists = [
    ...new Map(
      parsed.playlists.map((p) => [
        p.id,
        { ...p, trackIds: [...new Set(p.trackIds)] },
      ]),
    ).values(),
  ];
  parsed.favorites = [...new Set(parsed.favorites)];
  return parsed;
}
