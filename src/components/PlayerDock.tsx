import React, { useState } from 'react';
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
  Sliders,
  Maximize2,
  Sparkles,
  Zap,
  Info
} from 'lucide-react';
import { Track } from '../types';

interface PlayerDockProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  gaplessEnabled: boolean;
  onPlayPause: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleGapless: () => void;
  onOpenEQ: () => void;
  onOpenFullscreen: () => void;
  eqEnabled?: boolean;
  accentColor?: string;
}

export const PlayerDock: React.FC<PlayerDockProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isShuffle,
  repeatMode,
  gaplessEnabled,
  onPlayPause,
  onPrevTrack,
  onNextTrack,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onToggleRepeat,
  onToggleGapless,
  onOpenEQ,
  onOpenFullscreen,
  eqEnabled,
}) => {
  const [isHoveringScrubber, setIsHoveringScrubber] = useState(false);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {/* Mobile Sticky Mini Player */}
      <div className="md:hidden fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-30 bg-zinc-950/95 border-t border-white/10 backdrop-blur-2xl px-3 py-2 h-14 flex items-center justify-between shadow-2xl select-none">
        {/* Progress Bar Top Edge */}
        <div
          className="absolute top-0 left-0 right-0 h-1 bg-white/10 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const ratio = clickX / rect.width;
            onSeek(ratio * duration);
          }}
        >
          <div
            className="h-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.8)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Track Info (Click opens Fullscreen Player) */}
        <div
          onClick={onOpenFullscreen}
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer pr-2"
        >
          <div
            className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 shadow-md relative"
            style={{
              background: currentTrack?.coverArt?.startsWith('linear')
                ? currentTrack.coverArt
                : '#18181b',
            }}
          >
            {currentTrack?.coverArt && currentTrack.coverArt.startsWith('http') ? (
              <img src={currentTrack.coverArt} alt={currentTrack.title} className="w-full h-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-semibold text-white truncate">
              {currentTrack ? currentTrack.title : 'No Track Selected'}
            </h4>
            <p className="text-[10px] text-zinc-400 truncate">
              {currentTrack ? currentTrack.artist : 'Select a song to start'}
            </p>
          </div>
        </div>

        {/* Mini Controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onOpenEQ}
            className={`p-1.5 rounded-lg active:scale-90 transition-transform flex items-center gap-1 ${
              eqEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Studio Equalizer"
          >
            <Sliders className={`w-4 h-4 ${eqEnabled ? 'text-emerald-400' : ''}`} />
            {eqEnabled && <span className="text-[9px] font-mono font-bold text-emerald-300">ON</span>}
          </button>
          <button
            onClick={onPlayPause}
            className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center active:scale-90 transition-transform shadow-md"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          <button
            onClick={onNextTrack}
            className="p-1.5 text-zinc-300 hover:text-white active:scale-90 transition-transform"
          >
            <SkipForward className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenFullscreen}
            className="p-1.5 text-indigo-400 hover:text-indigo-300 active:scale-90 transition-transform"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop Player Dock */}
      <footer className="hidden md:flex h-24 bg-black/80 backdrop-blur-2xl border-t border-white/10 px-4 sm:px-6 lg:px-8 items-center justify-between gap-2 sm:gap-4 lg:gap-6 relative select-none z-30">
      {/* Top Scrubber Bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5 cursor-pointer group hover:h-2.5 transition-all duration-150 bg-white/10"
        onMouseEnter={() => setIsHoveringScrubber(true)}
        onMouseLeave={() => setIsHoveringScrubber(false)}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const ratio = clickX / rect.width;
          onSeek(ratio * duration);
        }}
      >
        <div
          className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.7)] relative transition-all"
          style={{ width: `${progressPercent}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform" />
        </div>
      </div>

      {/* Left: Track Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1 max-w-[260px]">
        {currentTrack ? (
          <>
            <div
              onClick={onOpenFullscreen}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden shadow-2xl border border-white/10 relative group cursor-pointer flex-shrink-0"
              style={{
                background: currentTrack.coverArt?.startsWith('linear')
                  ? currentTrack.coverArt
                  : '#18181b',
              }}
            >
              {currentTrack.coverArt && currentTrack.coverArt.startsWith('http') ? (
                <img
                  src={currentTrack.coverArt}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : null}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Maximize2 className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="text-xs font-semibold text-white truncate">{currentTrack.title}</h3>
                {currentTrack.isHiRes && (
                  <span className="text-[8px] sm:text-[9px] font-bold font-mono px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5 flex-shrink-0">
                    <Sparkles className="w-2 h-2" />
                    HI-RES
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 truncate">{currentTrack.artist}</p>
              <p className="text-[9px] font-mono text-zinc-500 truncate hidden sm:block">{currentTrack.bitrate}</p>
            </div>
          </>
        ) : (
          <div className="text-xs text-zinc-500 font-mono truncate">No Track Selected</div>
        )}
      </div>

      {/* Middle: Controls & Scrubbing Display */}
      <div className="flex flex-col items-center gap-1.5 max-w-md min-w-0 flex-1">
        <div className="flex items-center gap-2 sm:gap-4 md:gap-5">
          {/* Shuffle */}
          <button
            onClick={onToggleShuffle}
            className={`p-1.5 rounded-lg transition-colors ${
              isShuffle ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Toggle Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          {/* Previous */}
          <button
            onClick={onPrevTrack}
            className="text-zinc-300 hover:text-indigo-400 transition-all active:scale-95 p-1"
            title="Previous Track"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          {/* Play / Pause */}
          <button
            onClick={onPlayPause}
            className="w-12 h-12 sm:w-14 sm:h-14 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] cursor-pointer flex-shrink-0"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current" /> : <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-0.5" />}
          </button>

          {/* Next */}
          <button
            onClick={onNextTrack}
            className="text-zinc-300 hover:text-indigo-400 transition-all active:scale-95 p-1"
            title="Next Track"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          {/* Repeat */}
          <button
            onClick={onToggleRepeat}
            className={`p-1.5 rounded-lg transition-colors ${
              repeatMode !== 'off' ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={`Repeat Mode: ${repeatMode.toUpperCase()}`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
          </button>
        </div>

        {/* Time display */}
        <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono text-white/40">
          <span>{formatTime(currentTime)}</span>
          <span className="text-white/20">/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Audio FX & Extra Controls */}
      <div className="flex items-center justify-end gap-2 sm:gap-3 min-w-0 flex-1 max-w-[280px]">
        {/* Gapless Playback Toggle */}
        <button
          onClick={onToggleGapless}
          className={`hidden xl:flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-lg border transition-all ${
            gaplessEnabled
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
              : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
          }`}
          title="Sub-millisecond Web Audio Gapless Buffer Engine"
        >
          <Zap className="w-3 h-3" />
          GAPLESS
        </button>

        {/* Equalizer Quick Modal Trigger */}
        <button
          onClick={onOpenEQ}
          className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl transition-all flex items-center gap-1 border ${
            eqEnabled
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.35)] font-bold'
              : 'bg-zinc-900/60 text-zinc-400 border-white/5 hover:text-white hover:bg-white/10'
          }`}
          title="Studio 10-Band Equalizer"
        >
          <Sliders className={`w-3.5 h-3.5 ${eqEnabled ? 'text-emerald-400 animate-pulse' : ''}`} />
          <span className="text-[10px] font-mono font-bold hidden sm:inline">
            EQ {eqEnabled ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Volume Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleMute}
            className="text-zinc-400 hover:text-white transition-colors p-1"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-14 sm:w-20 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-400 hidden lg:block"
          />
        </div>

        {/* Fullscreen Player Button */}
        <button
          onClick={onOpenFullscreen}
          className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Expand Fullscreen Studio View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </footer>
  </>
  );
};
