import React, { useState } from "react";
import {
  Minimize2,
  Maximize2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  AudioLines,
  Headphones,
} from "lucide-react";
import { Track, VisualizerMode } from "../types";
import { LyricsView } from "./LyricsView";
import { audioEngine } from "../services/audioEngine";
import { AudioVisualizer } from "./AudioVisualizer";
import { Artwork, displayTitle, timeLabel } from "./Artwork";
import { useExpandedPlayer } from "./useExpandedPlayer";
import { useDialogFocus } from "./useDialogFocus";
interface FullscreenPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: "off" | "all" | "one";
  visualizerMode: VisualizerMode;
  onChangeVisualizerMode: (mode: VisualizerMode) => void;
  onClose: () => void;
  onPlayPause: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onOpenEQ: () => void;
  eqEnabled?: boolean;
  onEditLyrics?: () => void;
}

export function FullscreenPlayer(p: FullscreenPlayerProps) {
  const [tab, setTab] = useState<"visualizer" | "lyrics" | "specs">(
    "visualizer",
  );
  const view = useExpandedPlayer(p.onClose);
  const ref = useDialogFocus(!!p.currentTrack, () =>
    view.expanded ? view.collapse() : view.close(),
  );
  if (!p.currentTrack) return null;
  const track = p.currentTrack;
  const progress = p.duration
    ? Math.min(100, (p.currentTime / p.duration) * 100)
    : 0;
  return (
    <section
      className={`immersive-player ${tab === "lyrics" ? "lyrics-active" : ""} ${view.expanded ? `immersive-expanded expanded-${view.expanded}` : ""}`}
      data-expanded-view={view.expanded || "none"}
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
      ref={ref}
    >
      <div className="immersive-ambient" />
      <header className="immersive-header">
        {view.expanded && (
          <div className="expanded-track-heading">
            <strong>{displayTitle(track)}</strong>
            <span>
              {view.expanded === "lyrics"
                ? "Lyrics reader"
                : audioEngine.isNative()
                  ? "Native RMS meters"
                  : p.visualizerMode === "wave"
                    ? "Oscilloscope"
                    : "Live visualization"}{" "}
              · {track.artist}
            </span>
          </div>
        )}
        <span>
          <AudioLines size={22} /> aether
          <span className="eyebrow">THE LISTENING ROOM</span>
        </span>
        <button
          className="icon-button"
          aria-label="Close now playing"
          onClick={view.close}
        >
          <Minimize2 size={19} />
        </button>
      </header>
      <div className="immersive-content">
        <div className="immersive-cover">
          <Artwork track={track} />
          {track.isHiRes && <span className="album-corner">HI-RES AUDIO</span>}
        </div>
        <div className="immersive-info">
          <div className="eyebrow">
            {p.isPlaying ? "LET THE WORLD WAIT" : "TAKE A MOMENT"}
          </div>
          <h1>{displayTitle(track)}</h1>
          <p>{track.artist}</p>
          <span className="immersive-album">
            {track.album} {track.year ? ` · ${track.year}` : ""}
          </span>
          <div className="immersive-tabs segmented-control">
            {(["visualizer", "lyrics", "specs"] as const).map((t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                className={tab === t ? "selected" : ""}
                onClick={() => setTab(t)}
              >
                {t === "visualizer"
                  ? "Sound in motion"
                  : t === "lyrics"
                    ? "Lyrics"
                    : "Recording details"}
              </button>
            ))}
          </div>
          <div className="immersive-detail">
            {tab === "visualizer" ? (
              <>
                <div className="visualizer-toolbar">
                  <label className="visualizer-select">
                    <span>LIVE ANALYSER</span>
                    <select
                      aria-label="Visualization mode"
                      value={
                        audioEngine.isNative() ? "vu-meter" : p.visualizerMode
                      }
                      onChange={(e) => {
                        const mode = e.target.value as VisualizerMode;
                        p.onChangeVisualizerMode(mode);
                        if (mode === "wave")
                          view.expand("visualizer", ref.current);
                      }}
                    >
                      <option value="bars" disabled={audioEngine.isNative()}>
                        Frequency bars
                      </option>
                      <option value="wave" disabled={audioEngine.isNative()}>
                        Oscilloscope
                      </option>
                      <option value="nebula" disabled={audioEngine.isNative()}>
                        Circular nebula
                      </option>
                      <option value="31-band" disabled={audioEngine.isNative()}>
                        31-band spectrum
                      </option>
                      <option value="vu-meter">Analog VU meter</option>
                    </select>
                  </label>
                  <button
                    className="visualizer-expand"
                    aria-label={
                      view.expanded
                        ? "Exit fullscreen visualization"
                        : p.visualizerMode === "wave"
                          ? "Fullscreen oscilloscope"
                          : "Fullscreen visualization"
                    }
                    onClick={() =>
                      view.expanded
                        ? view.collapse()
                        : view.expand("visualizer", ref.current)
                    }
                  >
                    {view.expanded ? (
                      <Minimize2 size={16} />
                    ) : (
                      <Maximize2 size={16} />
                    )}
                    <span>
                      {view.expanded ? "Back to player" : "Fullscreen"}
                    </span>
                  </button>
                </div>
                {audioEngine.isNative() && (
                  <small>
                    Native PCM stereo RMS · spectrum modes are browser-only.
                  </small>
                )}
                <div className="immersive-canvas">
                  <AudioVisualizer
                    mode={p.visualizerMode}
                    isPlaying={p.isPlaying}
                  />
                </div>
              </>
            ) : tab === "lyrics" ? (
              <LyricsView
                lyrics={track.lyrics}
                trackId={track.id}
                currentTime={p.currentTime}
                onSeek={p.onSeek}
                onImport={
                  p.onEditLyrics
                    ? async () => {
                        await view.collapse();
                        p.onEditLyrics?.();
                      }
                    : undefined
                }
                expanded={view.expanded === "lyrics"}
                onToggleExpand={() =>
                  view.expanded
                    ? view.collapse()
                    : view.expand("lyrics", ref.current)
                }
              />
            ) : (
              <dl className="immersive-specs">
                {[
                  ["Format", track.format],
                  ["Source resolution", track.bitrate],
                  ["Genre", track.genre || "Not specified"],
                  [
                    "File size",
                    track.fileSizeMB
                      ? `${track.fileSizeMB.toFixed(1)} MB`
                      : "Not available",
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </div>
      <footer className="immersive-controls">
        <div className="immersive-timeline">
          <span>{timeLabel(p.currentTime)}</span>
          <input
            type="range"
            aria-label="Now playing position"
            min={0}
            max={p.duration || 1}
            step={0.1}
            value={Math.min(p.currentTime, p.duration || 1)}
            onChange={(e) => p.onSeek(Number(e.target.value))}
            style={{ "--progress": `${progress}%` } as React.CSSProperties}
          />
          <span>{timeLabel(p.duration)}</span>
        </div>
        <div className="immersive-transport">
          <button
            className={`icon-button ${p.isShuffle ? "control-active" : ""}`}
            onClick={p.onToggleShuffle}
            aria-label="Shuffle"
            aria-pressed={p.isShuffle}
          >
            <Shuffle size={19} />
          </button>
          <button
            className="icon-button"
            onClick={p.onPrevTrack}
            aria-label="Previous track"
          >
            <SkipBack size={23} fill="currentColor" />
          </button>
          <button
            className="primary-play"
            aria-label={p.isPlaying ? "Pause" : "Resume playback"}
            onClick={p.onPlayPause}
          >
            {p.isPlaying ? (
              <Pause size={22} fill="currentColor" />
            ) : (
              <Play size={22} fill="currentColor" />
            )}
          </button>
          <button
            className="icon-button"
            onClick={p.onNextTrack}
            aria-label="Next track"
          >
            <SkipForward size={23} fill="currentColor" />
          </button>
          <button
            className={`icon-button ${p.repeatMode !== "off" ? "control-active" : ""}`}
            onClick={p.onToggleRepeat}
            aria-label={`Repeat: ${p.repeatMode}`}
          >
            {p.repeatMode === "one" ? (
              <Repeat1 size={19} />
            ) : (
              <Repeat size={19} />
            )}
          </button>
        </div>
        <div className="immersive-bottom">
          <span>
            <Headphones size={13} /> YOUR MUSIC. YOUR MOMENT.
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Toggle mute"
              onClick={p.onToggleMute}
            >
              {p.isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              aria-label="Now playing volume"
              min={0}
              max={1}
              step={0.01}
              value={p.isMuted ? 0 : p.volume}
              onChange={(e) => p.onVolumeChange(Number(e.target.value))}
            />
            <button
              className={`icon-button ${p.eqEnabled ? "control-active" : ""}`}
              aria-label="Studio equalizer"
              onClick={async () => {
                await view.collapse();
                p.onOpenEQ();
              }}
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>
        </div>
      </footer>
    </section>
  );
}
