import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { Track } from "../types";
import { artworkFor } from "../components/Artwork";

/** Quantized, saturation-weighted dominant color, ignoring near-black/white pixels. */
export function artworkAccent(pixels: Uint8ClampedArray): string {
  const buckets = new Map<
    string,
    { r: number; g: number; b: number; weight: number; count: number }
  >();
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b, alpha] = pixels.subarray(i, i + 4),
      max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    if (alpha < 128 || max < 25 || min > 235) continue;
    const key = `${r >> 5},${g >> 5},${b >> 5}`;
    const bucket = buckets.get(key) || {
      r: 0,
      g: 0,
      b: 0,
      weight: 0,
      count: 0,
    };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.count++;
    bucket.weight += 0.25 + (max - min) / 255;
    buckets.set(key, bucket);
  }
  const best = [...buckets.values()].sort((a, b) => b.weight - a.weight)[0];
  if (!best) return "#e5a68c";
  const rgb = [best.r, best.g, best.b].map((n) => n / best.count);
  // Lift artwork colors into a readable pastel accent against dark surfaces.
  const max = Math.max(...rgb),
    lift = Math.max(0, 195 - max);
  return (
    "#" +
    rgb
      .map((n) =>
        Math.round(Math.min(235, n + lift + (255 - n) * 0.16))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
const cache = new Map<string, string>();
export function useArtworkTheme(
  track: Track | null,
  enabled: boolean,
): CSSProperties | undefined {
  const source = artworkFor(track);
  const [accent, setAccent] = useState("#e5a68c");
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const existing = cache.get(source);
    if (existing) {
      setAccent(existing);
      return;
    }
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 32;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0, 32, 32);
        const color = artworkAccent(context.getImageData(0, 0, 32, 32).data);
        if (cache.size >= 32) cache.delete(cache.keys().next().value!);
        cache.set(source, color);
        setAccent(color);
      } catch {
        setAccent("#e5a68c");
      }
    };
    image.onerror = () => {
      if (!cancelled) setAccent("#e5a68c");
    };
    image.src = source;
    return () => {
      cancelled = true;
      image.onload = image.onerror = null;
    };
  }, [source, enabled]);
  if (!enabled) return undefined;
  const rgb = [1, 3, 5]
    .map((index) => parseInt(accent.slice(index, index + 2), 16))
    .join(", ");
  return {
    "--accent": accent,
    "--accent-rgb": rgb,
    "--music-tint": `rgba(${rgb}, 0.12)`,
  } as CSSProperties;
}
