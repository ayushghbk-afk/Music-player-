import React, { useState } from 'react';
import {
  Minimize2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Sparkles,
  Sliders,
  Volume2,
  VolumeX,
  FileAudio,
  Radio,
  Zap,
  Layers,
  AlignLeft,
  Activity
} from 'lucide-react';
import { Track, VisualizerMode } from '../types';
import { AudioVisualizer } from './AudioVisualizer';

interface FullscreenPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
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
}

export const FullscreenPlayer: React.FC<FullscreenPlayerProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isShuffle,
  repeatMode,
  visualizerMode,
  onChangeVisualizerMode,
  onClose,
  onPlayPause,
  onPrevTrack,
  onNextTrack,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onToggleRepeat,
  onOpenEQ,
  eqEnabled,
}) => {
  const [activeTab, setActiveTab] = useState<'visualizer' | 'lyrics' | 'specs'>('visualizer');

  if (!currentTrack) return null;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const visualizerModes: { id: VisualizerMode; label: string }[] = [
    { id: 'bars', label: 'Frequency Bars' },
    { id: 'wave', label: 'Oscilloscope' },
    { id: 'nebula', label: 'Circular Nebula' },
    { id: '31-band', label: 'Studio 31-Band' },
    { id: 'vu-meter', label: 'Analog VU Meter' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-3xl flex flex-col justify-between p-4 sm:p-6 overflow-y-auto select-none animate-fadeIn">
      {/* Background Ambient Glow */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none filter blur-3xl scale-125 transition-all duration-1000"
        style={{
          background: currentTrack.coverArt?.startsWith('linear')
            ? currentTrack.coverArt
            : 'radial-gradient(circle, rgba(56,189,248,0.3) 0%, rgba(99,102,241,0.1) 70%, transparent 100%)',
        }}
      />

      {/* Top Bar Navigation */}
      <header className="relative z-10 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div className="hidden xs:block">
            <h2 className="text-xs font-bold text-white tracking-widest uppercase">Studio Master</h2>
            <p className="text-[9px] text-zinc-400 font-mono">Hi-Res Audio Engine</p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-white/10 mx-auto sm:mx-0">
          <button
            onClick={() => setActiveTab('visualizer')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
              activeTab === 'visualizer'
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Visualizer</span>
          </button>
          <button
            onClick={() => setActiveTab('lyrics')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
              activeTab === 'lyrics'
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span>Lyrics</span>
          </button>
          <button
            onClick={() => setActiveTab('specs')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
              activeTab === 'specs'
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FileAudio className="w-3.5 h-3.5" />
            <span>Specs</span>
          </button>
        </div>

        {/* Minimize Action */}
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-transform active:scale-95 flex-shrink-0"
          title="Minimize to Dock"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      </header>

      {/* Main Content Stage */}
      <main className="relative z-10 my-4 md:my-auto flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 max-w-5xl mx-auto w-full">
        {/* Left: Album Artwork with Vinyl Effect */}
        <div className="relative group">
          <div
            className={`w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 rounded-3xl shadow-2xl border border-white/10 overflow-hidden relative transition-transform duration-500 ${
              isPlaying ? 'scale-105 shadow-sky-500/20' : ''
            }`}
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

            {/* Glowing Spec Badge Overlay */}
            {currentTrack.isHiRes && (
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-amber-500/40 text-amber-300 text-[9px] font-mono font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                HI-RES AUDIO
              </div>
            )}
          </div>
        </div>

        {/* Right Stage: Visualizer / Lyrics / Specs */}
        <div className="w-full md:w-1/2 h-72 flex flex-col justify-between bg-zinc-900/40 p-6 rounded-3xl border border-white/5 relative">
          {activeTab === 'visualizer' && (
            <div className="flex flex-col h-full justify-between">
              {/* Visualizer Mode Switcher */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                  Spectrum Analyzer
                </span>
                <div className="flex items-center gap-1">
                  {visualizerModes.map((vm) => (
                    <button
                      key={vm.id}
                      onClick={() => onChangeVisualizerMode(vm.id)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border transition-all ${
                        visualizerMode === vm.id
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                          : 'bg-zinc-800 text-zinc-400 border-transparent hover:text-white'
                      }`}
                    >
                      {vm.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Canvas Component */}
              <div className="h-48 w-full rounded-2xl overflow-hidden bg-black/40 border border-white/5 p-2">
                <AudioVisualizer mode={visualizerMode} isPlaying={isPlaying} />
              </div>
            </div>
          )}

          {activeTab === 'lyrics' && (
            <div className="h-full flex flex-col">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
                Synced Lyrics & Annotations
              </span>
              <div className="flex-1 bg-black/40 rounded-2xl p-4 overflow-y-auto border border-white/5 font-mono text-xs text-zinc-300 space-y-3 leading-relaxed">
                {currentTrack.lyrics ? (
                  currentTrack.lyrics.split('\n').map((line, idx) => (
                    <p key={idx} className={idx === 1 ? 'text-sky-400 font-bold' : 'opacity-70'}>
                      {line}
                    </p>
                  ))
                ) : (
                  <p className="text-zinc-500 italic">No lyrics provided for this track.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'specs' && (
            <div className="h-full flex flex-col justify-between">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
                Audio Stream Specification
              </span>
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                  <span className="text-zinc-500 text-[10px]">FORMAT CODEC</span>
                  <p className="text-white font-bold text-sm">{currentTrack.format}</p>
                </div>
                <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                  <span className="text-zinc-500 text-[10px]">SPECIFICATION</span>
                  <p className="text-sky-400 font-bold text-sm">{currentTrack.bitrate}</p>
                </div>
                <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                  <span className="text-zinc-500 text-[10px]">GENRE</span>
                  <p className="text-zinc-300 font-bold">{currentTrack.genre || 'Audiophile'}</p>
                </div>
                <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                  <span className="text-zinc-500 text-[10px]">FILE SIZE</span>
                  <p className="text-zinc-300 font-bold">{currentTrack.fileSizeMB || 8.5} MB</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Track Controls Stage */}
      <footer className="relative z-10 max-w-3xl mx-auto w-full space-y-4">
        {/* Track Title */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold text-white tracking-wide">{currentTrack.title}</h2>
          <p className="text-sm text-zinc-400">{currentTrack.artist} — {currentTrack.album}</p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div
            className="w-full bg-zinc-800 h-2 rounded-full cursor-pointer overflow-hidden relative"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              onSeek((clickX / rect.width) * duration);
            }}
          >
            <div
              className="bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 h-full rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs font-mono text-zinc-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={onToggleShuffle}
            className={`p-2 rounded-xl transition-colors ${
              isShuffle ? 'text-sky-400 bg-sky-500/10' : 'text-zinc-500 hover:text-white'
            }`}
          >
            <Shuffle className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-6">
            <button
              onClick={onPrevTrack}
              className="text-zinc-300 hover:text-white transition-transform active:scale-95"
            >
              <SkipBack className="w-7 h-7" />
            </button>

            <button
              onClick={onPlayPause}
              className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl shadow-white/20"
            >
              {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
            </button>

            <button
              onClick={onNextTrack}
              className="text-zinc-300 hover:text-white transition-transform active:scale-95"
            >
              <SkipForward className="w-7 h-7" />
            </button>
          </div>

          <button
            onClick={onOpenEQ}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-2 border ${
              eqEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.35)] font-bold'
                : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white hover:bg-white/10'
            }`}
            title="Studio Equalizer"
          >
            <Sliders className={`w-5 h-5 ${eqEnabled ? 'text-emerald-400 animate-pulse' : ''}`} />
            <span className="text-xs font-mono font-bold">
              EQ {eqEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </footer>
    </div>
  );
};
