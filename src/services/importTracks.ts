import { parseBlob } from "music-metadata";
import { Track, AudioFormat } from "../types";
import { saveTrack, getTrackMetadata } from "./db";
import { embeddedLyrics } from "./lyrics";

export async function importAudioFile(
  file: File,
  onProgress?: (stage: string) => void,
): Promise<Track> {
  if (!/\.(flac|wav|mp3|aac|ogg|oga|m4a|alac)$/i.test(file.name))
    throw new Error("Unsupported audio extension");
  if (file.size > 1024 * 1024 * 1024)
    throw new Error("Files above 1 GB are not supported");
  onProgress?.("Reading audio tags");
  const metadata = await parseBlob(file, { duration: true });
  const { common, format } = metadata;
  if (!format.codec && !format.container)
    throw new Error("Could not identify audio data");
  const sampleRate = format.sampleRate || 0;
  const bitDepth = format.bitsPerSample || 0;
  const ext = file.name.split(".").pop()!.toUpperCase();
  const codec = (format.codec || "").toUpperCase();
  const audioFormat: AudioFormat =
    codec.includes("ALAC") || ext === "ALAC"
      ? "ALAC"
      : ext === "M4A"
        ? "AAC"
        : ["OGG", "OGA"].includes(ext)
          ? "OGG"
          : (ext as AudioFormat);
  // Stable content hash makes repeat imports/relinks idempotent.
  onProgress?.("Checking for duplicates");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  const id = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const picture = common.picture?.find(
    (p) =>
      p.data.length <= 1024 * 1024 &&
      /image\/(jpeg|png|webp|gif)/.test(p.format),
  );
  let coverArt: string | undefined;
  if (picture) {
    let binary = "";
    for (const byte of picture.data) binary += String.fromCharCode(byte);
    coverArt = `data:${picture.format};base64,${btoa(binary)}`;
  }
  const track: Track = {
    id,
    title: common.title || file.name.replace(/\.[^.]+$/, ""),
    artist: common.artist || "Unknown artist",
    album: common.album || "Imported audio",
    duration: format.duration || 0,
    format: audioFormat,
    bitrate:
      [
        bitDepth ? `${bitDepth}-bit` : "",
        sampleRate ? `${sampleRate / 1000}kHz` : "",
        format.bitrate ? `${Math.round(format.bitrate / 1000)} kbps` : "",
      ]
        .filter(Boolean)
        .join(" / ") || "Unknown resolution",
    sampleRate,
    bitDepth,
    isHiRes: bitDepth >= 24 && sampleRate >= 96000,
    addedAt: Date.now(),
    playCount: 0,
    fileSizeMB: file.size / 1048576,
    coverArt,
    year: common.year,
    genre: common.genre?.join(", "),
    trackNumber: common.track.no || undefined,
    originalFileName: file.name.slice(0, 500),
    lyrics: embeddedLyrics(common.lyrics),
  };
  const previous = await getTrackMetadata(id);
  const merged = previous
    ? { ...track, ...previous, originalFileName: track.originalFileName }
    : track;
  onProgress?.("Saving audio on this device");
  await saveTrack(merged, file);
  return merged;
}
