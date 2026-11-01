import type { Track } from "../types";

export interface LyricLine {
  time: number | null;
  text: string;
}
const stamps = /\[(\d{1,4}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g;
export function parseLyrics(text: string): {
  synced: boolean;
  lines: LyricLine[];
} {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const offset =
    Number(source.match(/\[offset:\s*([+-]?\d+)\s*\]/i)?.[1] || 0) / 1000;
  const lines: LyricLine[] = [];
  const plain: LyricLine[] = [];
  for (const row of source.split("\n")) {
    const matches = [...row.matchAll(stamps)];
    const content = row
      .replace(stamps, "")
      .replace(/\[(?:ar|ti|al|by|re|ve|length|offset):[^\]]*\]/gi, "")
      .trim();
    if (matches.length)
      for (const match of matches) {
        const seconds =
          Number(match[1]) * 60 +
          Number(match[2]) +
          Number(`0.${match[3] || "0"}`) +
          offset;
        lines.push({ time: Math.max(0, seconds), text: content });
      }
    else if (content) plain.push({ time: null, text: content });
  }
  // In mixed files, untimed headers are not assigned invented playback times.
  return lines.length
    ? { synced: true, lines: lines.sort((a, b) => a.time! - b.time!) }
    : { synced: false, lines: plain };
}
export function activeLyricIndex(lines: LyricLine[], seconds: number): number {
  let low = 0,
    high = lines.length - 1,
    active = -1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (lines[mid].time !== null && lines[mid].time! <= seconds) {
      active = mid;
      low = mid + 1;
    } else high = mid - 1;
  }
  return active;
}
export async function readLyricsFile(file: File): Promise<string> {
  if (!/\.(lrc|txt)$/i.test(file.name))
    throw new Error("Choose an .lrc or .txt lyrics file");
  if (file.size > 400000)
    throw new Error("Lyrics file is too large (400 KB maximum)");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const encoding =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? "utf-16le"
      : bytes[0] === 0xfe && bytes[1] === 0xff
        ? "utf-16be"
        : "utf-8";
  let text: string;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new Error(
      "Could not decode lyrics. Save the file as UTF-8 or UTF-16 with a BOM.",
    );
  }
  text = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  if (text.length > 100000) throw new Error("Lyrics exceed 100,000 characters");
  if (!parseLyrics(text).lines.length)
    throw new Error("No lyrics found in this file");
  return text;
}
export function lyricsMatchKey(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/\.(lrc|txt|flac|wav|mp3|aac|ogg|oga|m4a|alac)$/i, "")
    .trim()
    .toLocaleLowerCase();
}
export function findLyricsTarget(filename: string, tracks: Track[]): Track {
  const key = lyricsMatchKey(filename);
  const matches = tracks.filter((track) =>
    [
      track.originalFileName,
      track.title,
      `${track.artist} - ${track.title}`,
    ].some((value) => value && lyricsMatchKey(value) === key),
  );
  if (matches.length !== 1)
    throw new Error(
      matches.length
        ? "Multiple matching tracks. Import these lyrics from the intended track’s tag editor."
        : "No matching track. Use the same filename as the audio, or import from its tag editor.",
    );
  return matches[0];
}
export function embeddedLyrics(
  tags?: {
    text?: string;
    syncText?: { text: string; timestamp?: number }[];
    timeStampFormat?: number;
  }[],
): string | undefined {
  if (!tags?.length) return undefined;
  // ID3 SYLT format 2 is milliseconds. MPEG-frame timestamps cannot be treated as ms.
  const synced = tags.find(
    (tag) =>
      tag.timeStampFormat === 2 &&
      tag.syncText?.some((line) => line.timestamp !== undefined),
  );
  if (synced)
    return synced
      .syncText!.map((line) => {
        if (line.timestamp === undefined) return line.text;
        const ms = Math.max(0, Math.round(line.timestamp));
        return `[${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}]${line.text}`;
      })
      .join("\n")
      .slice(0, 100000);
  return (
    tags
      .map(
        (tag) =>
          tag.text || tag.syncText?.map((line) => line.text).join("\n") || "",
      )
      .filter(Boolean)
      .join("\n")
      .slice(0, 100000) || undefined
  );
}
