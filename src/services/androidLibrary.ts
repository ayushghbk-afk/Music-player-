import { Capacitor } from "@capacitor/core";
import type { AudioFormat, Track } from "../types";
import { AetherPlayer, type AndroidAudio } from "./aetherPlayer";
import { getDB } from "./db";

export const isAndroidLibrary = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

function formatForAudio(name: string, mime: string): AudioFormat {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "flac" || mime.includes("flac")) return "FLAC";
  if (ext === "wav" || mime.includes("wav")) return "WAV";
  if (ext === "alac" || mime.includes("alac")) return "ALAC";
  if (ext === "mp3" || mime === "audio/mpeg") return "MP3";
  if (["m4a", "aac", "mp4"].includes(ext || "") || /aac|mp4/.test(mime)) return "AAC";
  if (["ogg", "oga", "opus"].includes(ext || "") || /ogg|opus/.test(mime)) return "OGG";
  if (["dsf", "dff"].includes(ext || "")) return "DSD";
  return "OTHER";
}

const clean = (value: string | null, fallback: string) =>
  value && value !== "<unknown>" ? value.slice(0, 500) : fallback;

export function mediaTrack(audio: AndroidAudio, previous?: Track): Track {
  const name = audio.name || "Unknown audio";
  const discovered: Track = {
    id: audio.id,
    sourceUri: audio.uri,
    title: clean(audio.title, name.replace(/\.[^.]+$/, "")),
    artist: clean(audio.artist, "Unknown artist"),
    album: clean(audio.album, "Unknown album"),
    duration: Math.max(0, (audio.duration || 0) / 1000),
    format: formatForAudio(name, audio.mimeType || ""),
    bitrate: "Unknown resolution",
    isHiRes: false,
    addedAt: audio.addedAt > 0 ? audio.addedAt * 1000 : Date.now(),
    playCount: 0,
    originalFileName: name.slice(0, 500),
    fileSizeMB: Math.max(0, audio.size || 0) / 1048576,
  };
  // Keep user-edited tags and play history, while refreshing file properties.
  return previous ? { ...discovered, ...previous, sourceUri: audio.uri,
    duration: discovered.duration, fileSizeMB: discovered.fileSizeMB,
    originalFileName: discovered.originalFileName, format: discovered.format } : discovered;
}

/** Reconcile only a complete, successful scan. Never touch original device files. */
export async function scanAndroidLibrary(
  requestPermission: boolean,
  scan = AetherPlayer.scanAudio,
): Promise<"granted" | "denied"> {
  const result = await scan({ requestPermission });
  if (result.permission !== "granted") return "denied";
  if (!result.tracks || !result.volumes) throw new Error("Incomplete Android media scan");
  await reconcileAndroidLibrary(result.tracks, result.volumes);
  return "granted";
}

export async function reconcileAndroidLibrary(tracks: AndroidAudio[], volumes: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["tracks", "kv"], "readwrite");
  const store = tx.objectStore("tracks");
  const existing = await store.getAll() as Track[];
  const hidden = new Set((await tx.objectStore("kv").get("hiddenMediaTracks") as string[] | undefined) || []);
  const byId = new Map(existing.map(track => [track.id, track]));
  const seen = new Set(tracks.map(track => track.id));
  for (const audio of tracks) {
    if (!hidden.has(audio.id)) await store.put(mediaTrack(audio, byId.get(audio.id)));
  }
  // Do not remove entries on disconnected SD cards; their volume was not scanned.
  for (const track of existing) {
    if (track.sourceUri && volumes.some(volume => track.id.startsWith(`media-${volume}-`)) && !seen.has(track.id)) {
      await store.delete(track.id);
    }
  }
  await tx.done;
}
