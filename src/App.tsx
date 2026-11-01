import React, { useEffect, useState, useCallback, useRef } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import {
  Settings2,
  ArrowUpFromLine,
  AudioLines,
  ChevronRight,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  Track,
  Playlist,
  EQSettings,
  PlayerSettings,
  ThemeOption,
  VisualizerMode,
} from "./types";
import {
  getAllTracks,
  saveTrack,
  deleteTrack,
  getAllPlaylists,
  savePlaylist,
  deletePlaylist,
  getKV,
  setKV,
  getStorageStats,
} from "./services/db";
import {
  INITIAL_SAMPLE_TRACKS,
  generateSynthesizedTrackBlob,
} from "./services/sampleLibrary";
import { audioEngine } from "./services/audioEngine";

import { Sidebar, NavView } from "./components/Sidebar";
import { useDialogFocus } from "./components/useDialogFocus";
import {
  LibraryExperience,
  ListeningPanel,
} from "./components/LibraryExperience";
import { PlayerDock } from "./components/PlayerDock";
import { FullscreenPlayer } from "./components/FullscreenPlayer";
import { SongList } from "./components/SongList";
import { AlbumsView } from "./components/AlbumsView";
import { PlaylistsView } from "./components/PlaylistsView";
import { EqualizerModal } from "./components/EqualizerModal";
import { BackupSyncCenter } from "./components/BackupSyncCenter";
import { TrackTagEditor } from "./components/TrackTagEditor";
import { ImportDropzone } from "./components/ImportDropzone";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { AiAssistantView } from "./components/AiAssistantView";

const DEFAULT_EQ: EQSettings = {
  enabled: true,
  preset: "Audiophile Neutral",
  bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  preamp: 0,
  bassBoost: 15,
  trebleBoost: 10,
  stereoWidth: 100,
};

const DEFAULT_SETTINGS: PlayerSettings = {
  gapless: true,
  crossfadeSec: 0,
  theme: "obsidian",
  visualizerMode: "bars",
  volume: 0.85,
  playbackRate: 1,
  resampleRate: "native",
  autoPlayNext: true,
};

const revokeTrackAudioUrls = (trackList: Track[]) => {
  trackList.forEach((track) => {
    if (track.audioUrl?.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(track.audioUrl);
      } catch {
        // Best-effort cleanup for older in-memory object URLs.
      }
    }
  });
};

let seedPromise: Promise<void> | null = null;
async function seedLibrary() {
  if (!seedPromise)
    seedPromise = (async () => {
      if (await getKV("demoSeeded", false)) return;
      const existing = await getAllTracks();
      if (!existing.length) {
        const types = [
          "celestial",
          "quantum",
          "obsidian",
          "solar",
          "jazz",
        ] as const;
        for (let i = 0; i < INITIAL_SAMPLE_TRACKS.length; i++) {
          const blob = await generateSynthesizedTrackBlob(types[i]);
          await saveTrack(
            {
              ...INITIAL_SAMPLE_TRACKS[i],
              fileSizeMB: blob.size / 1048576,
            } as Track,
            blob,
          );
        }
        await savePlaylist({
          id: "demo-vault",
          name: "Studio Masters",
          description: "Synthesized 24-bit / 96kHz demonstrations",
          trackIds: INITIAL_SAMPLE_TRACKS.map((t) => t.id),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      await setKV("demoSeeded", true);
    })().catch((error) => {
      seedPromise = null;
      throw error;
    });
  return seedPromise;
}
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
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [gaplessEnabled, setGaplessEnabled] = useState(true);

  const [currentView, setCurrentView] = useState<NavView>("songs");
  const [theme, setTheme] = useState<ThemeOption>("obsidian");
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>("bars");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [isEQModalOpen, setIsEQModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);

  const [eqSettings, setEqSettings] = useState<EQSettings>(DEFAULT_EQ);
  const [playerSettings, setPlayerSettings] =
    useState<PlayerSettings>(DEFAULT_SETTINGS);
  const [storageUsedMB, setStorageUsedMB] = useState(0);
  const [playbackError, setPlaybackError] = useState("");
  const currentTrackRef = useRef<Track | null>(null);
  currentTrackRef.current = currentTrack;
  const restored = useRef(false);
  const prepared = useRef(false);
  const resumePosition = useRef(0);
  const nextRef = useRef<(automatic?: boolean) => void>(() => {});
  const persistAt = useRef(0);
  const [showPlaybackSettings, setShowPlaybackSettings] = useState(false);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowPlaybackSettings(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const settingsRef = useDialogFocus(showPlaybackSettings, () =>
    setShowPlaybackSettings(false),
  );

  // Native Android shell polish: black system bars, controlled splash, and stable WebView styling.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: "#111214" }).catch(() => {});
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    SplashScreen.hide().catch(() => {});
  }, []);

  // Android hardware back button behavior for a true app feel.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: { remove: () => Promise<void> } | null = null;
    let isActive = true;

    CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      if (editingTrack) {
        setEditingTrack(null);
        return;
      }
      if (isImportModalOpen) {
        setIsImportModalOpen(false);
        return;
      }
      if (isEQModalOpen) {
        setIsEQModalOpen(false);
        return;
      }
      if (isFullscreenOpen) {
        setIsFullscreenOpen(false);
        return;
      }
      if (currentView !== "songs") {
        setCurrentView("songs");
        return;
      }
      if (canGoBack) {
        window.history.back();
        return;
      }
      CapacitorApp.minimizeApp();
    })
      .then((handle) => {
        if (isActive) {
          listenerHandle = handle;
        } else {
          handle.remove();
        }
      })
      .catch(() => {});

    return () => {
      isActive = false;
      listenerHandle?.remove();
    };
  }, [
    currentView,
    editingTrack,
    isEQModalOpen,
    isFullscreenOpen,
    isImportModalOpen,
  ]);

  // Claim exclusive audio focus on app mount to pause/duck background apps & voices
  useEffect(() => {
    const claimFocus = () => {
      audioEngine.claimExclusiveAudioFocus();
    };
    claimFocus();
    window.addEventListener("click", claimFocus, { once: true });
    window.addEventListener("touchstart", claimFocus, { once: true });
    return () => {
      window.removeEventListener("click", claimFocus);
      window.removeEventListener("touchstart", claimFocus);
    };
  }, []);

  // Load or Seed Library
  const loadLibrary = useCallback(async () => {
    await seedLibrary();
    const existingTracks = await getAllTracks();
    if (!restored.current) {
      const last = await getKV<{ id: string; position: number } | null>(
        "lastPlayback",
        null,
      );
      if (last) {
        const track = existingTracks.find((t) => t.id === last.id);
        if (track) {
          setCurrentTrack(track);
          setCurrentTime(last.position);
          resumePosition.current = last.position;
        }
      }
      const nativeState = await audioEngine.syncNativeState();
      if (nativeState?.trackId) {
        const playingTrack = existingTracks.find(
          (t) => t.id === nativeState.trackId,
        );
        if (playingTrack) {
          setCurrentTrack(playingTrack);
          setCurrentTime(nativeState.currentTime);
          setDuration(nativeState.duration);
          setIsPlaying(nativeState.isPlaying);
          prepared.current = true;
          resumePosition.current = 0;
        }
      }
      restored.current = true;
    }

    setTracks((previousTracks) => {
      revokeTrackAudioUrls(previousTracks);
      return existingTracks;
    });

    const loadedPlaylists = await getAllPlaylists();
    setPlaylists(loadedPlaylists);

    const loadedFavs = await getKV<string[]>("favorites", []);
    setFavorites(loadedFavs);

    const loadedEQ = await getKV<EQSettings>("eqSettings", DEFAULT_EQ);
    setEqSettings(loadedEQ);

    const loadedSettings = await getKV<PlayerSettings>(
      "playerSettings",
      DEFAULT_SETTINGS,
    );
    setPlayerSettings(loadedSettings);
    setVolume(loadedSettings.volume);
    setGaplessEnabled(loadedSettings.gapless);
    audioEngine.setPlaybackRate(loadedSettings.playbackRate);
    setTheme(loadedSettings.theme);
    setVisualizerMode(loadedSettings.visualizerMode);

    const stats = await getStorageStats();
    setStorageUsedMB(stats.usedMB);
  }, []);

  useEffect(() => {
    loadLibrary().catch((error) =>
      setPlaybackError("Library initialization failed: " + error.message),
    );
  }, [loadLibrary]);

  useEffect(() => {
    audioEngine.setCallbacks({
      onStateChange: setIsPlaying,
      onError: setPlaybackError,
      onEnded: () => nextRef.current(true),
      onTimeUpdate: (position, duration) => {
        setCurrentTime(position);
        setDuration(duration);
        if (currentTrackRef.current && Date.now() - persistAt.current > 3000) {
          persistAt.current = Date.now();
          void setKV("lastPlayback", {
            id: currentTrackRef.current.id,
            position,
          });
        }
      },
    });
  }, []);

  // Apply EQ settings to audio engine whenever changed
  useEffect(() => {
    audioEngine.applyEQ(eqSettings);
  }, [eqSettings]);

  // Handle Play Track
  const handlePlayTrack = async (track: Track) => {
    setPlaybackError("");
    prepared.current = true;
    setCurrentTrack(track);
    audioEngine.setStartPosition(resumePosition.current);
    resumePosition.current = 0;
    await audioEngine.playTrack(track, track.audioUrl, {
      onTimeUpdate: (cur, dur) => {
        setCurrentTime(cur);
        setDuration(dur);
        if (Date.now() - persistAt.current > 3000) {
          persistAt.current = Date.now();
          void setKV("lastPlayback", {
            id: currentTrackRef.current?.id || track.id,
            position: cur,
          });
        }

        // Auto-update track duration in state & IndexedDB if real duration is loaded and differs
        if (
          !Capacitor.isNativePlatform() &&
          dur > 0 &&
          Math.abs(Math.round(dur) - track.duration) > 1
        ) {
          const updatedDuration = Math.round(dur);
          const updatedTrack = { ...track, duration: updatedDuration };
          setTracks((prev) =>
            prev.map((t) => (t.id === track.id ? updatedTrack : t)),
          );
          saveTrack(updatedTrack);
        }
      },
      onStateChange: (playing) => {
        setIsPlaying(playing);
      },
      onError: (message) => setPlaybackError(message),
      onEnded: () => nextRef.current(true),
    });

    audioEngine.applyEQ(eqSettings);
    audioEngine.setVolume(isMuted ? 0 : volume);
    audioEngine.setPlaybackRate(playerSettings.playbackRate);
  };

  const handlePlayPause = () => {
    if (!currentTrack && tracks.length > 0) {
      handlePlayTrack(tracks[0]);
    } else if (currentTrack && !prepared.current) {
      handlePlayTrack(currentTrack);
    } else {
      audioEngine.togglePlayPause();
    }
  };

  const handleNextTrack = (automatic = false) => {
    if (tracks.length === 0) return;
    if (
      automatic &&
      (!playerSettings.autoPlayNext ||
        (repeatMode === "off" &&
          !isShuffle &&
          currentTrack?.id === tracks[tracks.length - 1]?.id))
    ) {
      setIsPlaying(false);
      return;
    }
    let nextIndex = 0;

    if (automatic && repeatMode === "one" && currentTrack) {
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

  nextRef.current = handleNextTrack;

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

  useEffect(() => {
    audioEngine.onNativeTrackChanged = (id) => {
      const track = tracks.find((t) => t.id === id);
      if (track) {
        setCurrentTrack(track);
        prepared.current = true;
        void setKV("lastPlayback", { id, position: 0 });
      }
    };
    audioEngine
      .configureQueue(
        tracks,
        isShuffle,
        repeatMode,
        playerSettings.autoPlayNext,
      )
      .catch((error) =>
        setPlaybackError("Native queue failed: " + error.message),
      );
    return () => {
      audioEngine.onNativeTrackChanged = undefined;
    };
  }, [tracks, isShuffle, repeatMode, playerSettings.autoPlayNext]);

  // Register Media Session API Listeners for Lock Screen & Background playback
  useEffect(() => {
    audioEngine.registerMediaSessionHandlers({
      onPlay: () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
      onNext: () => handleNextTrack(),
      onPrevious: handlePrevTrack,
    });
  }, [tracks, currentTrack, isShuffle, repeatMode]);

  // Favorite toggle
  const handleToggleFavorite = async (trackId: string) => {
    const updated = favorites.includes(trackId)
      ? favorites.filter((id) => id !== trackId)
      : [...favorites, trackId];
    setFavorites(updated);
    await setKV("favorites", updated);
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
  const handleAddTrackToPlaylist = async (
    trackId: string,
    playlistId?: string,
  ) => {
    let currentPls = playlists;
    if (currentPls.length === 0) {
      const defaultPl: Playlist = {
        id: `playlist-${Date.now()}`,
        name: "My Audiophile Vault",
        description: "Saved custom tracks",
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

  const hiResTracks = tracks.filter((t) => t.isHiRes);
  const viewLabels: Partial<Record<NavView, string>> = {
    songs: "Music library",
    hires: "Hi-res collection",
    albums: "Albums & artists",
    playlists: "Playlists",
    equalizer: "Studio equalizer",
    backup: "Backup & sync",
    "ai-assistant": "Sound assistant",
  };

  return (
    <div className={`aether-app theme-${theme}`}>
      {playbackError && (
        <div
          role="alert"
          className="absolute top-16 left-4 right-4 z-[120] bg-red-950 border border-red-500 p-4 rounded-xl text-sm flex gap-4"
        >
          <span className="flex-1">{playbackError}</span>
          <button onClick={() => setPlaybackError("")}>Dismiss</button>
        </div>
      )}

      {showPlaybackSettings && (
        <section
          ref={settingsRef}
          role="dialog"
          aria-modal="true"
          aria-label="Playback settings"
          className="playback-settings"
        >
          <div className="settings-heading">
            <h2>Make yourself comfortable.</h2>
            <button
              className="icon-button"
              aria-label="Close playback settings"
              onClick={() => setShowPlaybackSettings(false)}
            >
              <X size={16} />
            </button>
          </div>
          <label className="block">
            Speed{" "}
            <select
              className="bg-zinc-800 p-2 rounded"
              value={playerSettings.playbackRate}
              onChange={(e) => {
                const updated = {
                  ...playerSettings,
                  playbackRate: Number(e.target.value),
                };
                setPlayerSettings(updated);
                audioEngine.setPlaybackRate(updated.playbackRate);
                void setKV("playerSettings", updated);
              }}
            >
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((n) => (
                <option key={n} value={n}>
                  {n}×
                </option>
              ))}
            </select>
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={playerSettings.autoPlayNext}
              onChange={(e) => {
                const updated = {
                  ...playerSettings,
                  autoPlayNext: e.target.checked,
                };
                setPlayerSettings(updated);
                void setKV("playerSettings", updated);
              }}
            />
            Autoplay next
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={gaplessEnabled}
              onChange={(e) => {
                const updated = {
                  ...playerSettings,
                  gapless: e.target.checked,
                };
                setGaplessEnabled(updated.gapless);
                setPlayerSettings(updated);
                void setKV("playerSettings", updated);
              }}
            />
            Prefer gapless (native, best effort)
          </label>
          <p className="text-xs text-zinc-400">
            Crossfade and forced 96/192 kHz output are not supported in this
            build. Output rate is chosen by the browser or Android mixer, not
            the source badge. Gapless is best-effort on native only.
          </p>
          <button onClick={() => setShowPlaybackSettings(false)}>Close</button>
        </section>
      )}
      {/* Upper Main Workspace */}
      <div className="app-workspace">
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
            setKV("playerSettings", updated);
          }}
          onTriggerImport={() => setIsImportModalOpen(true)}
        />

        <div className="content-stage">
          <header className="app-header">
            <div className="header-breadcrumb">
              <AudioLines size={20} className="mobile-brand" />
              <span className="desktop-breadcrumb">Your collection</span>
              <ChevronRight size={12} className="desktop-breadcrumb" />
              <strong>{viewLabels[currentView] || "Music library"}</strong>
            </div>
            <div className="header-actions">
              <span className="local-status">
                <ShieldCheck size={13} /> Local & personal
              </span>
              <span className="header-divider" />
              <button
                className="icon-button settings-trigger"
                title="Playback settings"
                aria-label="Playback settings"
                aria-expanded={showPlaybackSettings}
                onClick={() => setShowPlaybackSettings(!showPlaybackSettings)}
              >
                <Settings2 size={18} />
              </button>
              <button
                className="header-import"
                onClick={() => setIsImportModalOpen(true)}
              >
                <ArrowUpFromLine size={14} />
                <span>Import music</span>
              </button>
              <span
                className="profile-avatar"
                title="Your local listening space"
              >
                A
              </span>
            </div>
          </header>
          <div className="content-columns">
            <main className="main-content" key={currentView}>
              {currentView === "songs" && (
                <div className="library-home">
                  <LibraryExperience
                    tracks={tracks}
                    onPlay={handlePlayTrack}
                    onViewAlbums={() => setCurrentView("albums")}
                    onImport={() => setIsImportModalOpen(true)}
                  />
                  <div className="section-heading library-heading">
                    <h2>
                      Your library{" "}
                      <span>Your favorites, always within reach</span>
                    </h2>
                    <span className="collection-count">
                      {tracks.length} tracks in your collection
                    </span>
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

              {currentView === "hires" && (
                <div className="space-y-4">
                  <div className="page-intro">
                    <div>
                      <div className="eyebrow">
                        ALL THE DETAILS. NOTHING LESS.
                      </div>
                      <h1>Hear a little more.</h1>
                      <p>
                        Your high-resolution recordings, together in one place.
                      </p>
                    </div>
                    <span className="quality-pill">HI-RES COLLECTION</span>
                  </div>
                  <div className="hires-note">
                    <AudioLines size={22} />
                    <div>
                      <strong>Closer to the recording.</strong>
                      <p>
                        Explore the resolution of your source files. Device
                        output depends on your browser or Android audio mixer.
                      </p>
                    </div>
                    <span>{hiResTracks.length} masters</span>
                  </div>
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

              {currentView === "albums" && (
                <AlbumsView tracks={tracks} onPlayTrack={handlePlayTrack} />
              )}

              {currentView === "playlists" && (
                <PlaylistsView
                  playlists={playlists}
                  tracks={tracks}
                  onCreatePlaylist={handleCreatePlaylist}
                  onUpdatePlaylist={handleUpdatePlaylist}
                  onDeletePlaylist={handleDeletePlaylist}
                  onPlayPlaylist={(ids) => {
                    const plist = ids
                      .map((id) => tracks.find((t) => t.id === id))
                      .filter(Boolean) as Track[];
                    if (plist.length > 0) handlePlayTrack(plist[0]);
                  }}
                  onPlayTrack={handlePlayTrack}
                />
              )}

              {currentView === "equalizer" && (
                <div className="py-4">
                  <EqualizerModal
                    isOpen={true}
                    embedded
                    eqSettings={eqSettings}
                    onUpdateEQ={(eq) => {
                      setEqSettings(eq);
                      setKV("eqSettings", eq);
                    }}
                    onClose={() => setCurrentView("songs")}
                  />
                </div>
              )}

              {currentView === "ai-assistant" && (
                <div className="assistant-container">
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
                      setKV("eqSettings", updatedEQ);
                    }}
                  />
                </div>
              )}

              {currentView === "backup" && (
                <BackupSyncCenter
                  settings={playerSettings}
                  eqSettings={eqSettings}
                  onRefreshData={loadLibrary}
                />
              )}
            </main>
            {(currentView === "songs" || currentView === "hires") && (
              <ListeningPanel
                tracks={tracks}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                eq={eqSettings}
                onPlay={handlePlayTrack}
                onExpand={() => setIsFullscreenOpen(true)}
                onEQ={() => setIsEQModalOpen(true)}
                onAssistant={() => setCurrentView("ai-assistant")}
              />
            )}
          </div>
        </div>
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
        onNextTrack={() => handleNextTrack()}
        onSeek={(sec) => {
          audioEngine.seek(sec);
          setCurrentTime(sec);
        }}
        onVolumeChange={(val) => {
          setVolume(val);
          setIsMuted(false);
          audioEngine.setVolume(val);
          const updated = { ...playerSettings, volume: val };
          setPlayerSettings(updated);
          void setKV("playerSettings", updated);
        }}
        onToggleMute={() => {
          const nextMute = !isMuted;
          setIsMuted(nextMute);
          audioEngine.setVolume(nextMute ? 0 : volume);
        }}
        onToggleShuffle={() => setIsShuffle(!isShuffle)}
        onToggleRepeat={() => {
          if (repeatMode === "off") setRepeatMode("all");
          else if (repeatMode === "all") setRepeatMode("one");
          else setRepeatMode("off");
        }}
        onToggleGapless={() => {
          const updated = { ...playerSettings, gapless: !gaplessEnabled };
          setGaplessEnabled(updated.gapless);
          setPlayerSettings(updated);
          void setKV("playerSettings", updated);
        }}
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
            setKV("playerSettings", updated);
          }}
          onClose={() => setIsFullscreenOpen(false)}
          onPlayPause={handlePlayPause}
          onPrevTrack={handlePrevTrack}
          onNextTrack={() => handleNextTrack()}
          onSeek={(sec) => {
            audioEngine.seek(sec);
            setCurrentTime(sec);
          }}
          onVolumeChange={(val) => {
            setVolume(val);
            setIsMuted(false);
            audioEngine.setVolume(val);
            const updated = { ...playerSettings, volume: val };
            setPlayerSettings(updated);
            void setKV("playerSettings", updated);
          }}
          onToggleMute={() => {
            const nextMute = !isMuted;
            setIsMuted(nextMute);
            audioEngine.setVolume(nextMute ? 0 : volume);
          }}
          onToggleShuffle={() => setIsShuffle(!isShuffle)}
          onToggleRepeat={() => {
            if (repeatMode === "off") setRepeatMode("all");
            else if (repeatMode === "all") setRepeatMode("one");
            else setRepeatMode("off");
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
          setKV("eqSettings", eq);
        }}
        onClose={() => setIsEQModalOpen(false)}
      />

      {/* Track Tag Editor Modal */}
      {editingTrack && (
        <TrackTagEditor
          key={editingTrack.id}
          track={editingTrack}
          isOpen={!!editingTrack}
          onSaveTrack={handleSaveTrackTags}
          onClose={() => setEditingTrack(null)}
        />
      )}

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
