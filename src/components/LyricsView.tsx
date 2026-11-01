import React, { useEffect, useMemo, useRef } from "react";
import { parseLyrics, activeLyricIndex } from "../services/lyrics";

export function LyricsView({
  lyrics,
  currentTime,
  onSeek,
  onImport,
}: {
  lyrics?: string;
  currentTime: number;
  onSeek: (time: number) => void;
  onImport?: () => void;
}) {
  const parsed = useMemo(() => parseLyrics(lyrics || ""), [lyrics]);
  const active = parsed.synced
    ? activeLyricIndex(parsed.lines, currentTime)
    : -1;
  const container = useRef<HTMLDivElement>(null);
  const interactionUntil = useRef(0);
  useEffect(() => {
    if (active < 0 || Date.now() < interactionUntil.current) return;
    const root = container.current,
      element = root?.children[active] as HTMLElement | undefined;
    if (root && element)
      root.scrollTo({
        top: Math.max(
          0,
          element.offsetTop -
            root.offsetTop -
            root.clientHeight / 2 +
            element.clientHeight / 2,
        ),
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [active]);
  return (
    <div className="lyrics-panel">
      <div className="lyrics-toolbar">
        <small>
          {parsed.synced
            ? "SYNCED · TAP A LINE TO SEEK"
            : "LYRICS · LOCAL ONLY"}
        </small>
        {onImport && <button onClick={onImport}>Import / edit</button>}
      </div>
      <div
        ref={container}
        className="immersive-lyrics"
        onWheel={() => {
          interactionUntil.current = Date.now() + 5000;
        }}
        onTouchStart={() => {
          interactionUntil.current = Date.now() + 5000;
        }}
      >
        {parsed.lines.length ? (
          parsed.lines.map((line, index) =>
            parsed.synced ? (
              <button
                key={index}
                className={index === active ? "active-lyric" : ""}
                aria-current={index === active ? "true" : undefined}
                aria-label={`Seek to ${line.time?.toFixed(1)} seconds: ${line.text || "Instrumental"}`}
                onClick={() => onSeek(line.time!)}
              >
                {line.text || "♪"}
              </button>
            ) : (
              <p key={index}>{line.text}</p>
            ),
          )
        ) : (
          <p>
            No lyrics yet. Import an LRC or text file using “Import / edit”.
          </p>
        )}
      </div>
    </div>
  );
}
