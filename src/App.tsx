import React, { useEffect, useState, useCallback } from 'react';
import { Sliders, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Track,
  Playlist,
  EQSettings,
  PlayerSettings,
  ThemeOption,
  VisualizerMode
} from './types';
import {
  getAllTracks,
  saveTrack,
  deleteTrack,
  getAllPlaylists,
  savePlaylist,
  deletePlaylist,
  getKV,
  setKV,
  getStorageStats
} from './services/db';
import {
  INITIAL_SAMPLE_TRACKS,
  generateSynthesizedTrackBlob
} from './services/sampleLibrary';
import { audioEngine } from './services/audioEngine';

import { Sidebar, NavView } from './components/Sidebar';
import { PlayerDock } from './components/PlayerDock';
import { FullscreenPlayer } from './components/FullscreenPlayer';
import { SongList } from './components/SongList';
import { AlbumsView } from './components/AlbumsView';
import { PlaylistsView } from './components/PlaylistsView';
import { EqualizerModal } from './components/EqualizerModal';
import { BackupSyncCenter } from './components/BackupSyncCenter';
import { TrackTagEditor } from './components/TrackTagEditor';
import { ImportDropzone } from './components/ImportDropzone';
import { MobileBottomNav } from './components/MobileBottomNav';
import { AiAssistantView } from './components/AiAssistantView';

const DEFAULT_EQ: EQSettings = {
  enabled: true,
  preset: 'Audiophile Neutral',
  bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  preamp: 0,
  bassBoost: 15,
  trebleBoost: 10,
  stereoWidth: 100,
};

const DEFAULT_SETTINGS: PlayerSettings = {
  gapless: true,
  crossfadeSec: 2,
  theme: 'obsidian',
  visualizerMode: 'bars',
  volume: 0.85,
  playbackRate: 1,
  resampleRate: '96khz',
  autoPlayNext: true,
};

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [gaplessEnabled, setGaplessEnabled] = useState(true);

  const [currentView, setCurrentView] = useState<NavView>('songs');
  const [theme, setTheme] = useState<ThemeOption>('obsidian');
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('bars');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [isEQModalOpen, setIsEQModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);

  const [eqSettings, setEqSettings] = useState<EQSettings>(DEFAULT_EQ);
  const [playerSettings, setPlayerSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS);
  const [storageUsedMB, setStorageUsedMB] = useState(0);

  // Claim exclusive audio focus on app mount to pause/duck background apps & voices
  useEffect(() => {
    const claimFocus = () => {
      audioEngine.claimExclusiveAudioFocus();
    };
    claimFocus();
    window.addEventListener('click', claimFocus, { once: true });
    window.addEventListener('touchstart', claimFocus, { once: true });
    return () => {
      window.removeEventListener('click', claimFocus);
      window.removeEventListener('touchstart', claimFocus);
    };
  }, []);

  // Load or Seed Library
  const loadLibrary = useCallback(async () => {
    let existingTracks = await getAllTracks();

    // First time seed demo tracks
    if (existingTracks.length === 0) {
      const types: ('celestial' | 'quantum' | 'obsidian' | 'solar' | 'jazz')[] = [
        'celestial',
        'quantum',
        'obsidian',
        'solar',
        'jazz',
      ];

      for (let i = 0; i < INITIAL_SAMPLE_TRACKS.length; i++) {
        const meta = INITIAL_SAMPLE_TRACKS[i];
        const type = types[i % types.length];
        const audioBlob = await generateSynthesizedTrackBlob(type);
        await saveTrack(meta as Track, audioBlob);
      }

      // Initial Playlist
      const defaultPlaylist: Playlist = {
        id: 'playlist-audiophile-master',
        name: 'Hi-Res Studio Masters',
        description: '24-Bit / 96kHz Lossless Demonstration Playlist',
        trackIds: INITIAL_SAMPLE_TRACKS.map((t) => t.id),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await savePlaylist(defaultPlaylist);

      existingTracks = await getAllTracks();
    }

    setTracks(existingTracks);

    const loadedPlaylists = await getAllPlaylists();
    setPlaylists(loadedPlaylists);

    const loadedFavs = await getKV<string[]>('favorites', []);
    setFavorites(loadedFavs);

    const loadedEQ = await getKV<EQSettings>('eqSettings', DEFAULT_EQ);
    setEqSettings(loadedEQ);

    const loadedSettings = await getKV<PlayerSettings>('playerSettings', DEFAULT_SETTINGS);
    setPlayerSettings(loadedSettings);
    setTheme(loadedSettings.theme);
    setVisualizerMode(loadedSettings.visualizerMode);

    const stats = await getStorageStats();
    setStorageUsedMB(stats.usedMB);
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // Apply EQ settings to audio engine whenever changed
  useEffect(() => {
    audioEngine.applyEQ(eqSettings);
  }, [eqSettings]);

  // Handle Play Track
  const handlePlayTrack = async (track: Track) => {
    setCurrentTrack(track);

    await audioEngine.playTrack(track, track.audioUrl, {
      onTimeUpdate: (cur, dur) => {
        setCurrentTime(cur);
        setDuration(dur);

        // Auto-update track duration in state & IndexedDB if real duration is loaded and differs
        if (dur > 0 && Math.abs(Math.round(dur) - track.duration) > 1) {
          const updatedDuration = Math.round(dur);
          const updatedTrack = { ...track, duration: updatedDuration };
          setTracks((prev) =>
            prev.map((t) => (t.id === track.id ? updatedTrack : t))
          );
          saveTrack(updatedTrack);
        }
      },
      onStateChange: (playing) => {
        setIsPlaying(playing);
      },
      onEnded: () => {
        handleNextTrack();
      },
    });

    audioEngine.applyEQ(eqSettings);
    audioEngine.setVolume(isMuted ? 0 : volume);
  };

  const handlePlayPause = () => {
    if (!currentTrack && tracks.length > 0) {
      handlePlayTrack(tracks[0]);
    } else {
      audioEngine.togglePlayPause();
    }
  };

  const handleNextTrack = () => {
    if (tracks.length === 0) return;
    let nextIndex = 0;

    if (repeatMode === 'one' && currentTrack) {
      handlePlayTrack(currentTrack);
      return;
    }

    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * tracks.length);
    } else if (currentTrack) {
      const currentIndex = tracks.findIndex((t) => t.id === currentTrack.id);
      nextIndex = (currentIndex + 1) % tracks.length;
    }

    handlePlayTrack(tracks[nextIndex]);
  };

  const handlePrevTrack = () => {
    if (tracks.length === 0) return;
    let prevIndex = 0;

    if (isShuffle) {
      prevIndex = Math.floor(Math.random() * tracks.length);
    } else if (currentTrack) {
      const currentIndex = tracks.findIndex((t) => t.id === currentTrack.id);
      prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    }

    handlePlayTrack(tracks[prevIndex]);
  };

  // Register Media Session API Listeners for Lock Screen & Background playback
  useEffect(() => {
    audioEngine.registerMediaSessionHandlers({
      onPlay: () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
      onNext: handleNextTrack,
      onPrevious: handlePrevTrack,
    });
  }, [tracks, currentTrack, isShuffle, repeatMode]);

  // Favorite toggle
  const handleToggleFavorite = async (trackId: string) => {
    const updated = favorites.includes(trackId)
      ? favorites.filter((id) => id !== trackId)
      : [...favorites, trackId];
    setFavorites(updated);
    await setKV('favorites', updated);
  };

  // Delete Track
  const handleDeleteTrack = async (trackId: string) => {
    await deleteTrack(trackId);
    if (currentTrack?.id === trackId) {
      audioEngine.pause();
      setCurrentTrack(null);
    }
    loadLibrary();
  };

  // Save Edit Tags
  const handleSaveTrackTags = async (updated: Track) => {
    await saveTrack(updated);
    if (currentTrack?.id === updated.id) {
      setCurrentTrack(updated);
    }
    loadLibrary();
  };

  // Playlist creation
  const handleCreatePlaylist = async (name: string, description: string) => {
    const newPl: Playlist = {
      id: `playlist-${Date.now()}`,
      name,
      description,
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await savePlaylist(newPl);
    loadLibrary();
  };

  // Delete Playlist
  const handleDeletePlaylist = async (id: string) => {
    await deletePlaylist(id);
    loadLibrary();
  };

  // Add/Update track to playlist
  const handleAddTrackToPlaylist = async (trackId: string, playlistId?: string) => {
    let currentPls = playlists;
    if (currentPls.length === 0) {
      const defaultPl: Playlist = {
        id: `playlist-${Date.now()}`,
        name: 'My Audiophile Vault',
        description: 'Saved custom tracks',
        trackIds: [trackId],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await savePlaylist(defaultPl);
      loadLibrary();
      return;
    }

    const targetPl = playlistId
      ? currentPls.find((p) => p.id === playlistId) || currentPls[0]
      : currentPls[0];

    if (targetPl && !targetPl.trackIds.includes(trackId)) {
      const updatedPl = {
        ...targetPl,
        trackIds: [...targetPl.trackIds, trackId],
        updatedAt: Date.now(),
      };
      await savePlaylist(updatedPl);
      loadLibrary();
    }
  };

  // Direct Playlist Object Update
  const handleUpdatePlaylist = async (updatedPlaylist: Playlist) => {
    await savePlaylist(updatedPlaylist);
    loadLibrary();
  };

  // Theme styling mapping
  const themeClasses: Record<ThemeOption, string> = {
    obsidian: 'bg-zinc-950 text-zinc-100',
    sapphire: 'bg-slate-950 text-slate-100',
    cyberpunk: 'bg-black text-pink-50',
    'studio-gold': 'bg-zinc-950 text-amber-50',
    slate: 'bg-slate-900 text-slate-100',
  };

  const hiResTracks = tracks.filter((t) => t.isHiRes);

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden font-sans bg-[#050505] text-white relative select-none ${themeClasses[theme]}`}>
      {/* Immersive Ambient Glow Background Elements */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none z-0">
        <div className="w-[600px] h-[600px] bg-indigo-600 rounded-full blur-[140px] -translate-y-20 -translate-x-20"></div>
        <div className="w-[500px] h-[500px] bg-purple-700 rounded-full blur-[120px] translate-x-40 translate-y-20"></div>
      </div>

      {/* Top Bar Header */}
      <header className="min-h-14 pt-[env(safe-area-inset-top,0px)] flex items-center justify-between px-3 sm:px-6 bg-black/40 border-b border-white/5 backdrop-blur-md z-20 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors hidden md:flex items-center justify-center flex-shrink-0"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <div className="text-xs sm:text-sm font-bold tracking-tighter flex items-center gap-2 flex-shrink-0">
            <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.8)]"></div>
            <span className="truncate">AETHER AUDIO</span>
          </div>

          <nav className="hidden lg:flex gap-4 xl:gap-6 text-xs font-medium text-white/50 min-w-0">
            <span
              onClick={() => setCurrentView('songs')}
              className={`cursor-pointer transition-colors ${currentView === 'songs' ? 'text-white' : 'hover:text-white'}`}
            >
              LIBRARY
            </span>
            <span
              onClick={() => setCurrentView('hires')}
              className={`cursor-pointer transition-colors ${currentView === 'hires' ? 'text-white' : 'hover:text-white'}`}
            >
              HI-RES VAULT
            </span>
            <span
              onClick={() => setCurrentView('equalizer')}
              className={`cursor-pointer transition-colors ${currentView === 'equalizer' ? 'text-white' : 'hover:text-white'}`}
            >
              STUDIO EQ
            </span>
          </nav>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          <button
            onClick={() => setIsEQModalOpen(true)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all border ${
              eqSettings.enabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.35)]'
                : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white hover:bg-white/10'
            }`}
            title="Studio Equalizer DSP"
          >
            <Sliders className={`w-3.5 h-3.5 ${eqSettings.enabled ? 'text-emerald-400' : ''}`} />
            <span>EQ {eqSettings.enabled ? 'ON' : 'OFF'}</span>
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="md:hidden px-2.5 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-[11px] font-medium flex items-center gap-1 border border-indigo-500/30 shadow-sm"
          >
            + Import
          </button>
          <div className="hidden xl:flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-mono tracking-wider text-white/70">SYNCED · LOCAL INDEX</span>
          </div>
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white shadow-md shadow-indigo-500/20 flex-shrink-0">
            HI-RES
          </div>
        </div>
      </header>

      {/* Upper Main Workspace */}
      <div className="flex flex-1 min-h-0 overflow-hidden z-10 relative">
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentView={currentView}
          onSelectView={setCurrentView}
          hiResCount={hiResTracks.length}
          totalTrackCount={tracks.length}
          playlistCount={playlists.length}
          storageUsedMB={storageUsedMB}
          theme={theme}
          eqEnabled={eqSettings.enabled}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onSelectTheme={(t) => {
            setTheme(t);
            const updated = { ...playerSettings, theme: t };
            setPlayerSettings(updated);
            setKV('playerSettings', updated);
          }}
          onTriggerImport={() => setIsImportModalOpen(true)}
        />

        {/* Right Content Scrollable Stage */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 pb-[calc(9rem+env(safe-area-inset-bottom,0px))] md:pb-6">
          {currentView === 'songs' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">All Tracks</h2>
                <p className="text-xs text-zinc-400">Your complete offline music vault & audio masters</p>
              </div>
              <SongList
                tracks={tracks}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                favorites={favorites}
                onPlayTrack={handlePlayTrack}
                onToggleFavorite={handleToggleFavorite}
                onEditTrackTags={setEditingTrack}
                onDeleteTrack={handleDeleteTrack}
                onAddToPlaylist={handleAddTrackToPlaylist}
              />
            </div>
          )}

          {currentView === 'hires' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-wide">24-Bit Studio Masters</h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  LOSSLESS VAULT
                </span>
              </div>
              <p className="text-xs text-zinc-400">High-resolution FLAC, WAV, and DSD recordings</p>
              <SongList
                tracks={hiResTracks}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                favorites={favorites}
                hiResOnlyFilter={true}
                onPlayTrack={handlePlayTrack}
                onToggleFavorite={handleToggleFavorite}
                onEditTrackTags={setEditingTrack}
                onDeleteTrack={handleDeleteTrack}
                onAddToPlaylist={handleAddTrackToPlaylist}
              />
            </div>
          )}

          {currentView === 'albums' && (
            <AlbumsView tracks={tracks} onPlayTrack={handlePlayTrack} />
          )}

          {currentView === 'playlists' && (
            <PlaylistsView
              playlists={playlists}
              tracks={tracks}
              onCreatePlaylist={handleCreatePlaylist}
              onUpdatePlaylist={handleUpdatePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onPlayPlaylist={(ids) => {
                const plist = ids.map((id) => tracks.find((t) => t.id === id)).filter(Boolean) as Track[];
                if (plist.length > 0) handlePlayTrack(plist[0]);
              }}
              onPlayTrack={handlePlayTrack}
            />
          )}

          {currentView === 'equalizer' && (
            <div className="py-4">
              <EqualizerModal
                isOpen={true}
                eqSettings={eqSettings}
                onUpdateEQ={(eq) => {
                  setEqSettings(eq);
                  setKV('eqSettings', eq);
                }}
                onClose={() => setCurrentView('songs')}
              />
            </div>
          )}

          {currentView === 'ai-assistant' && (
            <div className="h-[calc(100vh-160px)] md:h-[calc(100vh-140px)] min-h-[420px] md:min-h-[500px]">
              <AiAssistantView
                tracks={tracks}
                eqSettings={eqSettings}
                currentTrack={currentTrack}
                onApplyEQPreset={(presetName, bands) => {
                  const updatedEQ: EQSettings = {
                    ...eqSettings,
                    enabled: true,
                    preset: presetName,
                    bands,
                  };
                  setEqSettings(updatedEQ);
                  audioEngine.applyEQ(updatedEQ);
                  setKV('eqSettings', updatedEQ);
                }}
              />
            </div>
          )}

          {currentView === 'backup' && (
            <BackupSyncCenter
              settings={playerSettings}
              eqSettings={eqSettings}
              onRefreshData={loadLibrary}
            />
          )}
        </main>
      </div>

      {/* Bottom Sticky Player Dock */}
      <PlayerDock
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isMuted={isMuted}
        isShuffle={isShuffle}
        repeatMode={repeatMode}
        gaplessEnabled={gaplessEnabled}
        onPlayPause={handlePlayPause}
        onPrevTrack={handlePrevTrack}
        onNextTrack={handleNextTrack}
        onSeek={(sec) => {
          audioEngine.seek(sec);
          setCurrentTime(sec);
        }}
        onVolumeChange={(val) => {
          setVolume(val);
          setIsMuted(false);
          audioEngine.setVolume(val);
        }}
        onToggleMute={() => {
          const nextMute = !isMuted;
          setIsMuted(nextMute);
          audioEngine.setVolume(nextMute ? 0 : volume);
        }}
        onToggleShuffle={() => setIsShuffle(!isShuffle)}
        onToggleRepeat={() => {
          if (repeatMode === 'off') setRepeatMode('all');
          else if (repeatMode === 'all') setRepeatMode('one');
          else setRepeatMode('off');
        }}
        onToggleGapless={() => setGaplessEnabled(!gaplessEnabled)}
        onOpenEQ={() => setIsEQModalOpen(true)}
        onOpenFullscreen={() => setIsFullscreenOpen(true)}
        eqEnabled={eqSettings.enabled}
      />

      {/* Fullscreen Expandable Studio Player Modal */}
      {isFullscreenOpen && (
        <FullscreenPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          isMuted={isMuted}
          isShuffle={isShuffle}
          repeatMode={repeatMode}
          visualizerMode={visualizerMode}
          onChangeVisualizerMode={(mode) => {
            setVisualizerMode(mode);
            const updated = { ...playerSettings, visualizerMode: mode };
            setPlayerSettings(updated);
            setKV('playerSettings', updated);
          }}
          onClose={() => setIsFullscreenOpen(false)}
          onPlayPause={handlePlayPause}
          onPrevTrack={handlePrevTrack}
          onNextTrack={handleNextTrack}
          onSeek={(sec) => {
            audioEngine.seek(sec);
            setCurrentTime(sec);
          }}
          onVolumeChange={(val) => {
            setVolume(val);
            audioEngine.setVolume(val);
          }}
          onToggleMute={() => {
            const nextMute = !isMuted;
            setIsMuted(nextMute);
            audioEngine.setVolume(nextMute ? 0 : volume);
          }}
          onToggleShuffle={() => setIsShuffle(!isShuffle)}
          onToggleRepeat={() => {
            if (repeatMode === 'off') setRepeatMode('all');
            else if (repeatMode === 'all') setRepeatMode('one');
            else setRepeatMode('off');
          }}
          onOpenEQ={() => setIsEQModalOpen(true)}
          eqEnabled={eqSettings.enabled}
        />
      )}

      {/* Equalizer Modal Popup */}
      <EqualizerModal
        isOpen={isEQModalOpen}
        eqSettings={eqSettings}
        onUpdateEQ={(eq) => {
          setEqSettings(eq);
          setKV('eqSettings', eq);
        }}
        onClose={() => setIsEQModalOpen(false)}
      />

      {/* Track Tag Editor Modal */}
      <TrackTagEditor
        track={editingTrack}
        isOpen={!!editingTrack}
        onSaveTrack={handleSaveTrackTags}
        onClose={() => setEditingTrack(null)}
      />

      {/* Import Local Files Modal Dropzone */}
      <ImportDropzone
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={loadLibrary}
      />

      {/* Mobile Sticky Bottom Navigation Bar */}
      <MobileBottomNav
        currentView={currentView}
        onSelectView={setCurrentView}
        onTriggerImport={() => setIsImportModalOpen(true)}
        hiResCount={hiResTracks.length}
        totalTrackCount={tracks.length}
        eqEnabled={eqSettings.enabled}
      />
    </div>
  );
}
