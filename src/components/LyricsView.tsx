import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Maximize2, Minimize2, Minus, Plus } from "lucide-react";
import { parseLyrics, activeLyricIndex } from "../services/lyrics";
import { lyricScrollTop } from "../services/lyricsLayout";

export function LyricsView({
  lyrics,
  trackId,
  currentTime,
  onSeek,
  onImport,
  expanded = false,
  onToggleExpand,
}: {
  lyrics?: string;
  trackId?: string;
  currentTime: number;
  onSeek: (time: number) => void;
  onImport?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const parsed = useMemo(() => parseLyrics(lyrics || ""), [lyrics]);
  const active = parsed.synced
    ? activeLyricIndex(parsed.lines, currentTime)
    : -1;
  const container = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(true);
  const [fontSize, setFontSize] = useState(20);
  const resumeTimer = useRef<number | null>(null);
  const clearTimer = useCallback(() => {
    if (resumeTimer.current !== null) {
      window.clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
    }
  }, []);
  const follow = useCallback(() => {
    clearTimer();
    setFollowing(true);
  }, [clearTimer]);
  const pauseFollowing = useCallback(() => {
    if (!parsed.synced) return;
    clearTimer();
    setFollowing(false);
    resumeTimer.current = window.setTimeout(() => {
      resumeTimer.current = null;
      setFollowing(true);
    }, 5000);
  }, [parsed.synced, clearTimer]);
  useLayoutEffect(() => {
    clearTimer();
    setFollowing(true);
    container.current?.scrollTo({ top: 0, behavior: "instant" });
    return clearTimer;
  }, [lyrics, trackId, clearTimer]);
  useLayoutEffect(() => {
    const root = container.current;
    if (!root || active < 0 || !following) return;
    let cancelled = false;
    let lastTarget: number | undefined;
    const center = () => {
      if (cancelled) return;
      const line = root.querySelector<HTMLElement>(
        `[data-lyric-index="${active}"]`,
      );
      if (!line) return;
      const top = lyricScrollTop(
        root.scrollTop,
        root.getBoundingClientRect().top,
        line.getBoundingClientRect().top,
        root.clientHeight,
        line.offsetHeight,
        root.scrollHeight,
      );
      // ResizeObserver's initial notification and RAF can describe the same
      // target. Reissuing smooth scroll interrupts/restarts the browser animation.
      if (lastTarget !== undefined && Math.abs(top - lastTarget) < 1) return;
      lastTarget = top;
      if (Math.abs(top - root.scrollTop) < 1) return;
      root.scrollTo({
        top,
        behavior:
          window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
          Math.abs(top - root.scrollTop) > root.clientHeight * 1.5
            ? "instant"
            : "smooth",
      });
    };
    // Position before paint. A delayed passive reset/RAF can otherwise leave the
    // newly highlighted line offscreen when the browser is busy or throttled.
    center();
    const frame = requestAnimationFrame(center);
    const observer = new ResizeObserver(center);
    observer.observe(root);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [active, following, expanded, fontSize, lyrics, trackId]);
  const activeTime = active >= 0 ? parsed.lines[active].time : null;
  return (
    <div className="lyrics-panel">
      <div className="lyrics-toolbar">
        <small>
          {parsed.synced
            ? "SYNCED · TAP A LINE TO SEEK"
            : "LYRICS · LOCAL ONLY"}
        </small>
        <div className="lyrics-actions">
          {parsed.synced && !following && (
            <button className="lyrics-follow" onClick={follow}>
              Follow lyrics
            </button>
          )}
          <button
            aria-label="Smaller lyrics text"
            disabled={fontSize <= 16}
            onClick={() => setFontSize((size) => Math.max(16, size - 2))}
          >
            <Minus size={15} />
          </button>
          <button
            aria-label="Larger lyrics text"
            disabled={fontSize >= 32}
            onClick={() => setFontSize((size) => Math.min(32, size + 2))}
          >
            <Plus size={15} />
          </button>
          {onToggleExpand && (
            <button
              aria-label={
                expanded ? "Exit fullscreen lyrics" : "Fullscreen lyrics"
              }
              title={expanded ? "Exit fullscreen lyrics" : "Fullscreen lyrics"}
              onClick={onToggleExpand}
            >
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
          {onImport && <button onClick={onImport}>Import / edit</button>}
        </div>
      </div>
      <div
        ref={container}
        className="immersive-lyrics"
        role="region"
        aria-label="Song lyrics"
        tabIndex={0}
        style={{ "--lyrics-font-size": `${fontSize}px` } as React.CSSProperties}
        onWheel={pauseFollowing}
        onTouchStart={pauseFollowing}
        onPointerDown={pauseFollowing}
        onKeyDown={(event) => {
          if (
            [
              "ArrowUp",
              "ArrowDown",
              "PageUp",
              "PageDown",
              "Home",
              "End",
              " ",
            ].includes(event.key)
          )
            pauseFollowing();
        }}
      >
        {parsed.lines.length ? (
          parsed.lines.map((line, index) =>
            parsed.synced ? (
              <button
                key={index}
                data-lyric-index={index}
                className={
                  activeTime !== null && line.time === activeTime
                    ? "active-lyric"
                    : ""
                }
                aria-current={
                  activeTime !== null && line.time === activeTime
                    ? "true"
                    : undefined
                }
                aria-label={`Seek to ${line.time?.toFixed(1)} seconds: ${line.text || "Instrumental"}`}
                dir="auto"
                onClick={() => {
                  onSeek(line.time!);
                  follow();
                }}
              >
                {line.text || "♪"}
              </button>
            ) : (
              <p key={index} data-lyric-index={index} dir="auto">
                {line.text}
              </p>
            ),
          )
        ) : (
          <p className="lyrics-empty">
            No lyrics yet.{" "}
            {onImport
              ? "Import an LRC or text file using “Import / edit”."
              : "Add lyrics in the track’s tag editor."}
          </p>
        )}
      </div>
    </div>
  );
}
