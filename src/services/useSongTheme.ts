import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { Track } from "../types";
import { useArtworkTheme } from "./artworkTheme";
import { audioEngine } from "./audioEngine";
import {
  metadataCharacter,
  songAccent,
  SongThemeTracker,
  type SongCharacter,
} from "./songTheme";

interface Analysis {
  trackId: string;
  character: SongCharacter;
  source: "audio" | "metadata";
}
export function useSongTheme(
  track: Track | null,
  enabled: boolean,
  mode: "song" | "artwork",
  isPlaying: boolean,
) {
  const artworkStyle = useArtworkTheme(track, enabled);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const fallback = metadataCharacter(track);
  const current = analysis?.trackId === track?.id ? analysis : null;
  useEffect(() => {
    if (!enabled || mode !== "song" || !track) return;
    // Clear a previous track's character immediately, even while the decoder loads.
    setAnalysis((previous) =>
      previous?.trackId === track.id && previous.source === "audio"
        ? previous
        : { trackId: track.id, character: fallback, source: "metadata" },
    );
    if (!isPlaying || audioEngine.isNative()) return;
    const tracker = new SongThemeTracker(current?.character || fallback);
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const features = audioEngine.readSongFeatures(track.id);
      if (!features) return;
      const character = tracker.push(features, performance.now());
      if (character)
        setAnalysis({ trackId: track.id, character, source: "audio" });
    }, 250);
    return () => clearInterval(timer);
    // The active tracker owns its history. Palette decoding and its own results
    // must not restart the rolling window or create overlapping intervals.
  }, [track?.id, enabled, mode, isPlaying, fallback]);
  const character = current?.character || fallback;
  const source = !enabled
    ? "off"
    : mode === "artwork" || !track
      ? "artwork"
      : current?.source || "metadata";
  if (!enabled || mode === "artwork" || !track)
    return { style: artworkStyle, character, source };
  const artwork =
    (artworkStyle as Record<string, string> | undefined)?.["--accent"] ||
    "#e5a68c";
  const accent = songAccent(character, artwork);
  const rgb = [1, 3, 5]
    .map((i) => parseInt(accent.slice(i, i + 2), 16))
    .join(", ");
  return {
    style: {
      ...artworkStyle,
      "--accent": accent,
      "--accent-rgb": rgb,
      "--music-tint": `rgba(${rgb}, 0.15)`,
    } as CSSProperties,
    character,
    source,
  };
}
