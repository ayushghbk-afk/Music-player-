import React from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  Maximize2,
  AudioLines,
} from "lucide-react";
import { Track } from "../types";
import { Artwork, displayTitle, timeLabel } from "./Artwork";
interface PlayerDockProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: "off" | "all" | "one";
  gaplessEnabled: boolean;
  onPlayPause: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onSeek: (s: number) => void;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleGapless: () => void;
  onOpenEQ: () => void;
  onOpenFullscreen: () => void;
  eqEnabled?: boolean;
  accentColor?: string;
}
export function PlayerDock(p: PlayerDockProps) {
  const progress = p.duration
    ? Math.min(100, (p.currentTime / p.duration) * 100)
    : 0;
  return (
    <footer
      className={`player-dock ${p.currentTrack ? "has-track" : "is-idle"}`}
    >
      <button
        className="dock-track"
        onClick={p.onOpenFullscreen}
        disabled={!p.currentTrack}
        aria-label="Open now playing"
      >
        <Artwork track={p.currentTrack} />
        <div>
          <strong>
            {p.currentTrack
              ? displayTitle(p.currentTrack)
              : "Your next favorite awaits"}
          </strong>
          <small>
            {p.currentTrack?.artist || "Choose a track. Settle in."}
          </small>
        </div>
        {p.currentTrack?.isHiRes && (
          <span className="dock-quality">HI-RES</span>
        )}
      </button>
      <div className="dock-center">
        <div className="transport-controls">
          <button
            className={`icon-button optional-control ${p.isShuffle ? "control-active" : ""}`}
            aria-label="Shuffle"
            aria-pressed={p.isShuffle}
            onClick={p.onToggleShuffle}
          >
            <Shuffle size={16} />
          </button>
          <button
            className="icon-button previous-track"
            aria-label="Previous track"
            onClick={p.onPrevTrack}
          >
            <SkipBack size={19} fill="currentColor" />
          </button>
          <button
            className="primary-play"
            aria-label={p.isPlaying ? "Pause playback" : "Play"}
            onClick={p.onPlayPause}
          >
            {p.isPlaying ? (
              <Pause size={19} fill="currentColor" />
            ) : (
              <Play size={19} fill="currentColor" />
            )}
          </button>
          <button
            className="icon-button"
            aria-label="Next track"
            onClick={p.onNextTrack}
          >
            <SkipForward size={19} fill="currentColor" />
          </button>
          <button
            className={`icon-button optional-control ${p.repeatMode !== "off" ? "control-active" : ""}`}
            aria-label={`Repeat: ${p.repeatMode}`}
            onClick={p.onToggleRepeat}
          >
            {p.repeatMode === "one" ? (
              <Repeat1 size={16} />
            ) : (
              <Repeat size={16} />
            )}
          </button>
        </div>
        <div className="dock-timeline">
          <span>{timeLabel(p.currentTime)}</span>
          <input
            aria-label="Playback position"
            type="range"
            min={0}
            max={p.duration || 1}
            step={0.1}
            value={Math.min(p.currentTime, p.duration || 1)}
            onChange={(e) => p.onSeek(Number(e.target.value))}
            style={{ "--progress": `${progress}%` } as React.CSSProperties}
          />
          <span>{timeLabel(p.duration)}</span>
        </div>
      </div>
      <div className="dock-utilities">
        <button
          className="icon-button"
          aria-label={p.isMuted ? "Unmute" : "Mute"}
          onClick={p.onToggleMute}
        >
          {p.isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>
        <input
          aria-label="Volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={p.isMuted ? 0 : p.volume}
          onChange={(e) => p.onVolumeChange(Number(e.target.value))}
          style={
            {
              "--progress": `${(p.isMuted ? 0 : p.volume) * 100}%`,
            } as React.CSSProperties
          }
        />
        <span className="utility-separator" />
        <button
          className={`icon-button ${p.eqEnabled ? "control-active" : ""}`}
          onClick={p.onOpenEQ}
          aria-label="Open equalizer"
        >
          <SlidersHorizontal size={17} />
        </button>
        <button
          className="icon-button"
          onClick={p.onOpenFullscreen}
          disabled={!p.currentTrack}
          aria-label="Expand player"
        >
          <Maximize2 size={16} />
        </button>
        <span className="output-label">
          <AudioLines size={12} /> {p.currentTrack?.storage === "cloud" ? "CLOUD AUDIO" : "LOCAL AUDIO"}
        </span>
      </div>
    </footer>
  );
}
