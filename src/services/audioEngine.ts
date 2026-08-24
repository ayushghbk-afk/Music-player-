import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Track, EQSettings, PlayerSettings } from '../types';
import { getTrackBlob } from './db';
import {
  AetherPlayer,
  arrayBufferToBase64Chunks,
  extensionForTrack,
} from './aetherPlayer';

export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export class AudioEngine {
  private static instance: AudioEngine;

  private audioElement: HTMLAudioElement;
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private preampGainNode: GainNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private bassFilter: BiquadFilterNode | null = null;
  private trebleFilter: BiquadFilterNode | null = null;
  private masterGainNode: GainNode | null = null;

  private isInitialized = false;
  private currentTrack: Track | null = null;
  private wakeLock: any = null;
  private shouldResumeAfterInterruption = false;
  private backgroundAutoPaused = false;
  private currentObjectUrl: string | null = null;
  private appLifecycleListenersRegistered = false;
  private nativeAppIsActive = true;
  private backgroundRecoveryTimer: number | null = null;
  private backgroundRecoveryAttempts = 0;
  private onTrackEndedCallback?: () => void;
  private onTimeUpdateCallback?: (currentTime: number, duration: number) => void;
  private onStateChangeCallback?: (isPlaying: boolean) => void;
  private nativeListenerAttached = false;
  private nativePosition = 0;
  private nativeDuration = 0;
  private nativePlaying = false;
  private onNativeNext?: () => void;
  private onNativePrevious?: () => void;

  private constructor() {
    this.audioElement = this.createAudioElement();

    this.setupAudioElementEvents();
    this.setupVisibilityHandlers();
    this.setupNativeAppLifecycle();
    this.setupNativePlayerBridge();
  }

  private usesNativePlayback() {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  private setupNativePlayerBridge() {
    if (this.nativeListenerAttached || !this.usesNativePlayback()) return;
    this.nativeListenerAttached = true;

    AetherPlayer.addListener('playerEvent', (event) => {
      if (typeof event.currentTime === 'number') this.nativePosition = event.currentTime;
      if (typeof event.duration === 'number' && event.duration > 0) this.nativeDuration = event.duration;

      if (event.type === 'state') {
        this.nativePlaying = !!event.isPlaying;
        this.onStateChangeCallback?.(this.nativePlaying);
      } else if (event.type === 'time') {
        this.onTimeUpdateCallback?.(this.nativePosition, this.nativeDuration);
      } else if (event.type === 'ended') {
        this.nativePlaying = false;
        this.onStateChangeCallback?.(false);
        this.onTrackEndedCallback?.();
      } else if (event.type === 'next') {
        this.onNativeNext?.();
      } else if (event.type === 'previous') {
        this.onNativePrevious?.();
      }
    }).catch(() => {});
  }

  private createAudioElement(): HTMLAudioElement {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.autoplay = false;
    audio.controls = false;
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    audio.setAttribute('x-webkit-airplay', 'allow');
    audio.disableRemotePlayback = false;
    (audio as any).preservesPitch = true;
    return audio;
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  // Claim Exclusive Audio Focus on Android / System to silence other app voices & background playback
  public async claimExclusiveAudioFocus() {
    try {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Unmute and ensure volume is set
      if (this.audioElement.muted) {
        this.audioElement.muted = false;
      }

      // Update MediaSession state only when real audio is active.
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = this.audioElement.paused ? 'none' : 'playing';
      }

      // Force OS audio manager to assign exclusive primary focus via micro-silent pulse if audioCtx ready
      if (this.audioCtx && this.audioCtx.state === 'running') {
        try {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          gain.gain.value = 0.0001;
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start();
          osc.stop(this.audioCtx.currentTime + 0.05);
        } catch {}
      }

      // Acquire Screen/System WakeLock if supported
      this.acquireWakeLock();
    } catch (e) {
      console.warn('Audio focus claim exception:', e);
    }
  }

  private async acquireWakeLock() {
    if ('wakeLock' in navigator && !this.wakeLock) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
      } catch {
        // WakeLock unavailable or rejected
      }
    }
  }

  private releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
      } catch {}
      this.wakeLock = null;
    }
  }

  private isBackgrounded() {
    return document.visibilityState === 'hidden' || (Capacitor.isNativePlatform() && !this.nativeAppIsActive);
  }

  private cancelBackgroundPlaybackRecovery() {
    if (this.backgroundRecoveryTimer !== null) {
      window.clearTimeout(this.backgroundRecoveryTimer);
      this.backgroundRecoveryTimer = null;
    }
    this.backgroundRecoveryAttempts = 0;
  }

  private scheduleBackgroundPlaybackRecovery(immediate = false) {
    if (this.usesNativePlayback()) return;
    if (!this.shouldResumeAfterInterruption) return;
    if (!this.isBackgrounded()) {
      this.cancelBackgroundPlaybackRecovery();
      return;
    }

    if (this.backgroundRecoveryTimer !== null) {
      window.clearTimeout(this.backgroundRecoveryTimer);
      this.backgroundRecoveryTimer = null;
    }

    const attemptRecovery = async () => {
      this.backgroundRecoveryTimer = null;

      if (!this.shouldResumeAfterInterruption || !this.isBackgrounded()) {
        this.cancelBackgroundPlaybackRecovery();
        return;
      }

      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume().catch(() => {});
      }

      if (this.audioElement.paused) {
        await this.audioElement.play().catch(() => {});
      }

      if (!this.audioElement.paused) {
        this.backgroundAutoPaused = false;
        this.acquireWakeLock();
        this.syncMediaSessionPosition();
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
      }

      const needsAnotherAttempt =
        this.shouldResumeAfterInterruption &&
        this.isBackgrounded() &&
        (this.audioElement.paused || (this.audioCtx?.state === 'suspended'));

      if (needsAnotherAttempt && this.backgroundRecoveryAttempts < 10) {
        this.backgroundRecoveryAttempts += 1;
        this.backgroundRecoveryTimer = window.setTimeout(() => {
          void attemptRecovery();
        }, 900);
        return;
      }

      this.cancelBackgroundPlaybackRecovery();
    };

    this.backgroundRecoveryAttempts = 0;
    this.backgroundRecoveryTimer = window.setTimeout(() => {
      void attemptRecovery();
    }, immediate ? 120 : 400);
  }

  private setupVisibilityHandlers() {
    const recoverPlayback = () => {
      if (this.isBackgrounded()) {
        if (!this.audioElement.paused) {
          this.shouldResumeAfterInterruption = true;
          this.syncMediaSessionPosition();
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
          this.acquireWakeLock();
          this.scheduleBackgroundPlaybackRecovery();
        }
        return;
      }

      this.resumeAfterBackgroundInterruption();
    };

    document.addEventListener('visibilitychange', recoverPlayback);
    window.addEventListener('pageshow', recoverPlayback);
    document.addEventListener('resume', recoverPlayback as EventListener);
  }

  private setupNativeAppLifecycle() {
    if (this.appLifecycleListenersRegistered || !Capacitor.isNativePlatform()) return;
    this.appLifecycleListenersRegistered = true;

    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      this.nativeAppIsActive = isActive;

      if (isActive) {
        this.resumeAfterBackgroundInterruption();
        return;
      }

      if (!this.audioElement.paused) {
        this.shouldResumeAfterInterruption = true;
        this.syncMediaSessionPosition();
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
        this.acquireWakeLock();
        this.scheduleBackgroundPlaybackRecovery(true);
      }
    }).catch(() => {});

    CapacitorApp.addListener('pause', () => {
      this.nativeAppIsActive = false;
      if (!this.audioElement.paused && this.shouldResumeAfterInterruption) {
        this.scheduleBackgroundPlaybackRecovery(true);
      }
    }).catch(() => {});

    CapacitorApp.addListener('resume', () => {
      this.nativeAppIsActive = true;
      this.resumeAfterBackgroundInterruption();
    }).catch(() => {});
  }

  private async resumeAfterBackgroundInterruption() {
    this.cancelBackgroundPlaybackRecovery();

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume().catch(() => {});
    }

    if ((this.backgroundAutoPaused || this.audioElement.paused) && this.shouldResumeAfterInterruption) {
      this.backgroundAutoPaused = false;
      await this.audioElement.play().catch(() => {});
    }

    if (!this.audioElement.paused) {
      this.claimExclusiveAudioFocus();
      this.syncMediaSessionPosition();
    }
  }

  private syncMediaSessionPosition() {
    if (!('mediaSession' in navigator)) return;
    const dur = this.audioElement.duration || 0;
    const cur = this.audioElement.currentTime || 0;

    if (isFinite(dur) && dur > 0 && isFinite(cur)) {
      try {
        navigator.mediaSession.setPositionState({
          duration: dur,
          playbackRate: this.audioElement.playbackRate || 1,
          position: Math.max(0, Math.min(cur, dur)),
        });
      } catch {
        // Position state is best-effort across Android WebView versions.
      }
    }
  }

  // Initialize Web Audio API nodes on user gesture with full error protection
  public initWebAudio() {
    // If AudioContext was closed by OS or error, re-initialize
    if (this.audioCtx && this.audioCtx.state === 'closed') {
      this.isInitialized = false;
      this.audioCtx = null;
      this.sourceNode = null;
      // Re-create HTMLAudioElement if source node was previously bound
      const oldSrc = this.audioElement.src;
      const oldTime = this.audioElement.currentTime;
      this.audioElement = this.createAudioElement();
      if (oldSrc) this.audioElement.src = oldSrc;
      this.audioElement.currentTime = oldTime;
      this.setupAudioElementEvents();
    }

    if (this.isInitialized) {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.8;

      this.preampGainNode = this.audioCtx.createGain();
      this.masterGainNode = this.audioCtx.createGain();

      // Create 10-band EQ filters
      this.eqFilters = EQ_FREQUENCIES.map((freq, idx) => {
        const filter = this.audioCtx!.createBiquadFilter();
        if (idx === 0) {
          filter.type = 'lowshelf';
        } else if (idx === EQ_FREQUENCIES.length - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
          filter.Q.value = 1.4;
        }
        filter.frequency.value = freq;
        filter.gain.value = 0;
        return filter;
      });

      // Dedicated Bass Boost & Treble Boost filters
      this.bassFilter = this.audioCtx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.value = 100;
      this.bassFilter.gain.value = 0;

      this.trebleFilter = this.audioCtx.createBiquadFilter();
      this.trebleFilter.type = 'highshelf';
      this.trebleFilter.frequency.value = 8000;
      this.trebleFilter.gain.value = 0;

      // Connect source to chain
      this.sourceNode = this.audioCtx.createMediaElementSource(this.audioElement);

      // Connect chain: Source -> Preamp -> EQ filters -> Bass -> Treble -> Analyser -> Master Gain -> Destination
      let lastNode: AudioNode = this.sourceNode;

      lastNode.connect(this.preampGainNode);
      lastNode = this.preampGainNode;

      this.eqFilters.forEach((filter) => {
        lastNode.connect(filter);
        lastNode = filter;
      });

      lastNode.connect(this.bassFilter);
      lastNode = this.bassFilter;

      lastNode.connect(this.trebleFilter);
      lastNode = this.trebleFilter;

      lastNode.connect(this.analyserNode);
      this.analyserNode.connect(this.masterGainNode);
      this.masterGainNode.connect(this.audioCtx.destination);

      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio initialization error:', e);
    }
  }

  private setupAudioElementEvents() {
    this.audioElement.addEventListener('ended', () => {
      this.cancelBackgroundPlaybackRecovery();
      this.shouldResumeAfterInterruption = false;
      this.backgroundAutoPaused = false;
      this.releaseWakeLock();
      this.onStateChangeCallback?.(false);
      this.onTrackEndedCallback?.();
    });

    this.audioElement.addEventListener('loadedmetadata', () => {
      if (this.currentTrack) {
        this.updateMediaSession(this.currentTrack);
      }
      this.syncMediaSessionPosition();
    });

    this.audioElement.addEventListener('timeupdate', () => {
      const cur = this.audioElement.currentTime || 0;
      const dur = this.audioElement.duration || 0;
      this.onTimeUpdateCallback?.(cur, dur);

      this.syncMediaSessionPosition();
    });

    this.audioElement.addEventListener('play', () => {
      this.cancelBackgroundPlaybackRecovery();
      this.shouldResumeAfterInterruption = true;
      this.backgroundAutoPaused = false;
      this.claimExclusiveAudioFocus();
      this.onStateChangeCallback?.(true);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    });

    this.audioElement.addEventListener('pause', () => {
      if (this.isBackgrounded() && this.shouldResumeAfterInterruption) {
        this.backgroundAutoPaused = true;
        this.scheduleBackgroundPlaybackRecovery(true);
      } else {
        this.cancelBackgroundPlaybackRecovery();
        this.releaseWakeLock();
      }

      this.onStateChangeCallback?.(false);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    });

    // Auto-Recovery on Media Loading Errors (prevents background player crashes)
    this.audioElement.addEventListener('error', async () => {
      console.warn('Audio element error encountered:', this.audioElement.error);
      this.onStateChangeCallback?.(false);

      if (this.currentTrack) {
        try {
          const blob = await getTrackBlob(this.currentTrack.id);
          if (blob) {
            const freshUrl = URL.createObjectURL(blob);
            this.setAudioSource(freshUrl);
            this.audioElement.removeAttribute('crossorigin');
            this.audioElement.load();
            await this.audioElement.play();
            return;
          }
        } catch (err) {
          console.error('Failed to reload track blob from IndexedDB:', err);
        }
      }

      // If recovery fails, skip to next track safely
      this.onTrackEndedCallback?.();
    });
  }

  private setAudioSource(src: string) {
    if (this.currentObjectUrl && this.currentObjectUrl !== src) {
      try {
        URL.revokeObjectURL(this.currentObjectUrl);
      } catch {}
    }

    this.currentObjectUrl = src.startsWith('blob:') ? src : null;
    this.audioElement.src = src;
  }

  private async playTrackNatively(track: Track, audioUrl?: string): Promise<boolean> {
    if (!this.usesNativePlayback()) return false;

    const meta = {
      title: track.title,
      artist: track.artist,
      album: track.album || 'Aether',
    };

    const remoteUrl = audioUrl || track.audioUrl;
    if (remoteUrl && (remoteUrl.startsWith('http://') || remoteUrl.startsWith('https://') || remoteUrl.startsWith('file://') || remoteUrl.startsWith('content://'))) {
      await AetherPlayer.playUrl({ url: remoteUrl, ...meta });
      this.nativePlaying = true;
      this.onStateChangeCallback?.(true);
      return true;
    }

    const blob = await getTrackBlob(track.id);
    if (!blob) return false;

    const buffer = await blob.arrayBuffer();
    const chunks = arrayBufferToBase64Chunks(buffer);
    await AetherPlayer.beginCache({
      trackId: track.id,
      extension: extensionForTrack(track.format, blob.type),
    });
    for (const data of chunks) {
      await AetherPlayer.appendCache({ data });
    }
    await AetherPlayer.playCached(meta);
    try {
      window.localStorage.setItem('aether.lastTrackId', track.id);
    } catch {
      // ignore quota
    }
    this.nativePlaying = true;
    this.onStateChangeCallback?.(true);
    return true;
  }

  // Load and play a track with CORS protection and Blob fallback
  public async playTrack(
    track: Track,
    audioUrl?: string,
    callbacks?: {
      onEnded?: () => void;
      onTimeUpdate?: (currentTime: number, duration: number) => void;
      onStateChange?: (isPlaying: boolean) => void;
    }
  ): Promise<void> {
    this.initWebAudio();

    if (callbacks) {
      if (callbacks.onEnded) this.onTrackEndedCallback = callbacks.onEnded;
      if (callbacks.onTimeUpdate) this.onTimeUpdateCallback = callbacks.onTimeUpdate;
      if (callbacks.onStateChange) this.onStateChangeCallback = callbacks.onStateChange;
    }

    this.cancelBackgroundPlaybackRecovery();
    this.currentTrack = track;

    try {
      const usedNative = await this.playTrackNatively(track, audioUrl);
      if (usedNative) {
        this.updateMediaSession(track);
        return;
      }
    } catch (err) {
      console.warn('Native playback unavailable, falling back to WebView audio:', err);
    }

    let urlToPlay = audioUrl || track.audioUrl;

    // Fallback: If no URL or invalid, fetch from IndexedDB
    if (!urlToPlay) {
      try {
        const blob = await getTrackBlob(track.id);
        if (blob) {
          urlToPlay = URL.createObjectURL(blob);
        }
      } catch (err) {
        console.error('Failed to get track blob for ID:', track.id, err);
      }
    }

    if (!urlToPlay) {
      console.warn('No playable URL for track:', track.title);
      this.onTrackEndedCallback?.();
      return;
    }

    // Set CORS attribute ONLY for remote HTTP/HTTPS URLs (prevents blob URL crashes)
    if (urlToPlay.startsWith('http://') || urlToPlay.startsWith('https://')) {
      this.audioElement.crossOrigin = 'anonymous';
    } else {
      this.audioElement.removeAttribute('crossorigin');
    }

    this.setAudioSource(urlToPlay);
    this.audioElement.load();

    try {
      this.shouldResumeAfterInterruption = true;
      await this.claimExclusiveAudioFocus();
      await this.audioElement.play();
      this.updateMediaSession(track);
      this.syncMediaSessionPosition();
    } catch (err) {
      console.error('Playback initiation failed:', err);
      this.onStateChangeCallback?.(false);
    }
  }

  public play() {
    if (this.usesNativePlayback()) {
      AetherPlayer.play().then(() => {
        this.nativePlaying = true;
        this.onStateChangeCallback?.(true);
      }).catch(() => {});
      return;
    }
    this.initWebAudio();
    this.shouldResumeAfterInterruption = true;
    this.claimExclusiveAudioFocus();
    this.audioElement.play().catch((err) => console.error('Play error:', err));
  }

  public pause() {
    if (this.usesNativePlayback()) {
      AetherPlayer.pause().then(() => {
        this.nativePlaying = false;
        this.onStateChangeCallback?.(false);
      }).catch(() => {});
      return;
    }
    this.cancelBackgroundPlaybackRecovery();
    this.shouldResumeAfterInterruption = false;
    this.backgroundAutoPaused = false;
    this.releaseWakeLock();
    this.audioElement.pause();
  }

  public togglePlayPause() {
    if (this.audioElement.paused) {
      this.play();
    } else {
      this.pause();
    }
  }

  public seek(seconds: number) {
    if (this.usesNativePlayback()) {
      this.nativePosition = seconds;
      AetherPlayer.seek({ seconds }).catch(() => {});
      return;
    }
    if (!isNaN(seconds) && isFinite(seconds)) {
      const duration = this.audioElement.duration;
      const clamped = isFinite(duration) && duration > 0
        ? Math.max(0, Math.min(seconds, duration))
        : Math.max(0, seconds);
      this.audioElement.currentTime = clamped;
      this.syncMediaSessionPosition();
    }
  }

  public setVolume(val: number) {
    const clamped = Math.max(0, Math.min(1, val));
    if (this.usesNativePlayback()) {
      AetherPlayer.setVolume({ volume: clamped }).catch(() => {});
    }
    this.audioElement.volume = clamped;
  }

  public setPlaybackRate(rate: number) {
    if (this.usesNativePlayback()) {
      AetherPlayer.setPlaybackRate({ rate }).catch(() => {});
    }
    this.audioElement.playbackRate = rate;
  }

  public getAnalyserData(frequencyArray: Uint8Array, timeDomainArray: Uint8Array) {
    if (this.analyserNode) {
      this.analyserNode.getByteFrequencyData(frequencyArray);
      this.analyserNode.getByteTimeDomainData(timeDomainArray);
    } else {
      frequencyArray.fill(0);
      timeDomainArray.fill(128);
    }
  }

  // Apply Equalizer & Audio FX Settings
  public applyEQ(eq: EQSettings) {
    if (!this.isInitialized || !this.audioCtx || this.audioCtx.state === 'closed') return;

    if (this.preampGainNode) {
      // Linear conversion from dB: 10^(dB/20)
      const preampVal = eq.enabled ? Math.pow(10, eq.preamp / 20) : 1;
      this.preampGainNode.gain.setValueAtTime(preampVal, this.audioCtx.currentTime);
    }

    this.eqFilters.forEach((filter, idx) => {
      const gainVal = eq.enabled && eq.bands[idx] !== undefined ? eq.bands[idx] : 0;
      filter.gain.setValueAtTime(gainVal, this.audioCtx!.currentTime);
    });

    if (this.bassFilter) {
      const bassGain = eq.enabled ? (eq.bassBoost / 100) * 12 : 0;
      this.bassFilter.gain.setValueAtTime(bassGain, this.audioCtx.currentTime);
    }

    if (this.trebleFilter) {
      const trebleGain = eq.enabled ? (eq.trebleBoost / 100) * 12 : 0;
      this.trebleFilter.gain.setValueAtTime(trebleGain, this.audioCtx.currentTime);
    }
  }

  // Media Session API for Lock Screen Controls & Background Notifications
  public updateMediaSession(track: Track) {
    if (!('mediaSession' in navigator)) return;

    const artworkUrl = track.coverArt && (track.coverArt.startsWith('http') || track.coverArt.startsWith('data:image'))
      ? track.coverArt
      : new URL('/pwa-512.png', window.location.href).href;
    const artworkType = artworkUrl.includes('.png') || artworkUrl.startsWith('data:image/png')
      ? 'image/png'
      : 'image/jpeg';

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || 'Aether Audio',
      artwork: [
        { src: artworkUrl, sizes: '96x96', type: artworkType },
        { src: artworkUrl, sizes: '256x256', type: artworkType },
        { src: artworkUrl, sizes: '512x512', type: artworkType },
      ],
    });

    navigator.mediaSession.playbackState = this.usesNativePlayback()
      ? (this.nativePlaying ? 'playing' : 'paused')
      : this.audioElement.paused ? 'paused' : 'playing';
  }

  public registerMediaSessionHandlers(handlers: {
    onPlay?: () => void;
    onPause?: () => void;
    onPrevious?: () => void;
    onNext?: () => void;
    onSeekBackward?: () => void;
    onSeekForward?: () => void;
    onSeekTo?: (details: MediaSessionActionDetails) => void;
  }) {
    if (!('mediaSession' in navigator)) return;

    const actionMap: Partial<Record<MediaSessionAction, (details?: any) => void>> = {
      play: () => {
        this.play();
        handlers.onPlay?.();
      },
      pause: () => {
        this.pause();
        handlers.onPause?.();
      },
      previoustrack: handlers.onPrevious,
      nexttrack: handlers.onNext,
      seekbackward: () => {
        this.seek(this.audioElement.currentTime - 10);
        handlers.onSeekBackward?.();
      },
      seekforward: () => {
        this.seek(this.audioElement.currentTime + 10);
        handlers.onSeekForward?.();
      },
      seekto: (details: MediaSessionActionDetails) => {
        if (details && details.seekTime !== undefined) {
          this.seek(details.seekTime);
          handlers.onSeekTo?.(details);
        }
      },
      stop: () => this.pause(),
    };

    this.onNativeNext = handlers.onNext;
    this.onNativePrevious = handlers.onPrevious;

    Object.entries(actionMap).forEach(([action, handler]) => {
      try {
        if (handler) {
          navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler as any);
        } else {
          navigator.mediaSession.setActionHandler(action as MediaSessionAction, null);
        }
      } catch (e) {
        // Safe catch for unsupported actions in older browsers
      }
    });
  }

  public getCurrentTime(): number {
    return this.usesNativePlayback() ? this.nativePosition : this.audioElement.currentTime || 0;
  }

  public getDuration(): number {
    return this.usesNativePlayback() ? this.nativeDuration : this.audioElement.duration || 0;
  }

  public isPaused(): boolean {
    return this.usesNativePlayback() ? !this.nativePlaying : this.audioElement.paused;
  }
}

export const audioEngine = AudioEngine.getInstance();

