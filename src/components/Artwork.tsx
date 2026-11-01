import React from "react";
import { Track } from "../types";
import { assetUrl } from "../services/deployment";

export function artworkFor(track?: Track | null) {
  if (!track) return assetUrl("art/landscape-1.svg");
  if (
    track.coverArt?.startsWith("data:image/") ||
    track.coverArt?.startsWith("/")
  )
    return track.coverArt.startsWith("/") ? assetUrl(track.coverArt) : track.coverArt;
  const sample = track.id.match(/^sample-track-([1-5])$/);
  const index = sample
    ? Number(sample[1])
    : ([...track.album].reduce((a, c) => a + c.charCodeAt(0), 0) % 5) + 1;
  return assetUrl(`art/landscape-${index}.svg`);
}
export function Artwork({
  track,
  className = "",
}: {
  track?: Track | null;
  className?: string;
}) {
  return (
    <img
      className={`artwork ${className}`}
      src={artworkFor(track)}
      alt={track ? `${track.album} artwork` : "Aether landscape artwork"}
      loading="lazy"
    />
  );
}
export const displayTitle = (track: Track) =>
  /^sample-track-[1-5]$/.test(track.id)
    ? track.title.replace(/\s*\([^)]*\)$/, "")
    : track.title;
export function timeLabel(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, "0")}`;
}
