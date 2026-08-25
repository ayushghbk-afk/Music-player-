import { Capacitor } from '@capacitor/core';
import { Track, EQSettings, PlayerSettings } from '../types';
import { getTrackBlob } from './db';
import {
  AetherPlayer,
  extensionForTrack,
  importTrackToNativeStore,
  nativeTrackExists,
} from './aetherPlayer';

export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export interface AudioEngineCallbacks {
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onStateChange?: (isPlaying: boolean) => void;
  onError?: (message: string) => void;
}

/**
 * Two engines, strictly separated:
 *
 *  - Android: native playback ONLY. ExoPlayer + MediaSessionService own the
 *    playback state; this class is a thin command/event bridge. There is no
 *    HTMLAudioElement, no WebView MediaSession, no screen WakeLock and no
 *    background-recovery JavaScript on this path. If native playback fails we
 *    surface the error — we never silently fall back to the WebView, because
 *    WebView audio cannot survive in the background and dual state is how
 *    desync bugs are born.
 *
 *  - Browsers: web playback ONLY (HTMLAudioElement + Web Audio graph), with
 *    its own background-interruption recovery.
 */
export class AudioEngine {
  private static instance: AudioEngine;

  // ---- Web-only state (lazily created; null on Android) ----------------
  private audioElement: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private preampGainNode: GainNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private bassFilter: BiquadFilterNode | null = null;
  private trebleFilter: BiquadFilterNode | null = null;
  private masterGainNode: GainNode | null = null;
  private isInitialized = false;
  private wakeLock: any = null;
  private shouldResumeAfterInterruption = false;
  private backgroundAutoPaused = false;
  private currentObjectUrl: string | null = null;
  private backgroundRecoveryTimer: number | null = null;
  private backgroundRecoveryAttempts = 0;

  // ---- Shared state ----------------------------------------------------
  private currentTrack: Track | null = null;
  private onTrackEndedCallback?: () => void;
  private onTimeUpdateCallback?: (currentTime: number, duration: number) => void;
  private onStateChangeCallback?: (isPlaying: boolean) => void;
  private onErrorCallback?: (message: string) => void;

  // ---- Native mirror (display only; ExoPlayer is the source of truth) --
  private nativeListenerAttached = false;
  private nativePosition = 0;
  private nativeDuration = 0;
  private nativePlaying = false;
  private onNativeNext?: () => void;
  private onNativePrevious?: () => void;

  private constructor() {
    if (this.usesNativePlayback()) {
      // Android: no web audio machinery at all.
      this.setupNativePlayerBridge();
      return;
    }
    this.setupVisibilityHandlers();
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
      } else if (event.type === 'error') {
        this.nativePlaying = false;
        this.onStateChangeCallback?.(false);
        this.onErrorCallback?.(event.message || 'Native playback error');
      }
    }).catch(() => {});
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  // =====================================================================
  // Android: native-only playback
  // =====================================================================

  /**
   * Native playback is strict: remote/file/content URIs go straight to
   * ExoPlayer; stored tracks play from persistent native storage, importing
   * the blob once if it is not there yet. Any failure is surfaced as an
   * error — never as a silent switch to WebView audio.
   */
  private async playTrackNatively(track: Track, audioUrl?: string): Promise<void> {
    const meta = {
      title: track.title,
      artist: track.artist,
      album: track.album || 'Aether',
    };

    const remoteUrl = audioUrl || track.audioUrl;
    if (
      remoteUrl &&
      (remoteUrl.startsWith('http://') ||
        remoteUrl.startsWith('https://') ||
        remoteUrl.startsWith('file://') ||
        remoteUrl.startsWith('content://'))
    ) {
      await AetherPlayer.playUrl({ url: remoteUrl, ...meta });
      this.nativePlaying = true;
      this.onStateChangeCallback?.(true);
      return;
    }

    if (!(await nativeTrackExists(track.id))) {
      const blob = await getTrackBlob(track.id);
      if (!blob) {
        throw new Error(`No audio data found for "${track.title}"`);
      }
      // One-time import into persistent native storage. Afterwards this
      // track never crosses the JS/native boundary again.
      await importTrackToNativeStore(
        { trackId: track.id, extension: extensionForTrack(track.format, blob.type) },
        blob
      );
    }

    await AetherPlayer.playStored({ trackId: track.id, ...meta });
    // Optimistic: native state events (onIsPlayingChanged) remain the source
    // of truth and will correct this if the deferred command fails.
    this.nativePlaying = true;
    this.onStateChangeCallback?.(true);

    try {
      window.localStorage.setItem('aether.lastTrackId', track.id);
    } catch {
      // ignore quota
    }
  }

  // =====================================================================
  // Web playback helpers
  // =====================================================================

  private ensureAudioElement(): HTMLAudioElement {
    if (this.audioElement) return this.audioElement;
    const audio = this.createAudioElement();
    this.audioElement = audio;
    this.wireAudioElementEvents(audio);
    return audio;
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

  // Claim Exclusive Audio Focus on the web stack (no-op on Android where
  // ExoPlayer requests focus natively with setAudioAttributes).
  public async claimExclusiveAudioFocus() {
    if (this.usesNativePlayback()) return;
    try {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      const audio = this.audioElement;
      if (audio?.muted) {
        audio.muted = false;
      }

      if ('mediaSession' in navigator && audio) {
        navigator.mediaSession.playbackState = audio.paused ? 'none' : 'playing';
      }

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
    return document.visibilityState === 'hidden';
  }

  private cancelBackgroundPlaybackRecovery() {
    if (this.backgroundRecoveryTimer !== null) {
      window.clearTimeout(this.backgroundRecoveryTimer);
      this.backgroundRecoveryTimer = null;
    }
    this.backgroundRecoveryAttempts = 0;
  }

  private scheduleBackgroundPlaybackRecovery(immediate = false) {
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
      const audio = this.audioElement;

      if (!this.shouldResumeAfterInterruption || !this.isBackgrounded()) {
        this.cancelBackgroundPlaybackRecovery();
        return;
      }

      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume().catch(() => {});
      }

      if (audio?.paused) {
        await audio.play().catch(() => {});
      }

      if (audio && !audio.paused) {
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
        (!this.audioElement || this.audioElement.paused || this.audioCtx?.state === 'suspended');

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
        const audio = this.audioElement;
        if (audio && !audio.paused) {
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

  private async resumeAfterBackgroundInterruption() {
    this.cancelBackgroundPlaybackRecovery();

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume().catch(() => {});
    }

    const audio = this.audioElement;
    if (audio && (this.backgroundAutoPaused || audio.paused) && this.shouldResumeAfterInterruption) {
      this.backgroundAutoPaused = false;
      await audio.play().catch(() => {});
    }

    if (audio && !audio.paused) {
      this.claimExclusiveAudioFocus();
      this.syncMediaSessionPosition();
    }
  }

  private syncMediaSessionPosition() {
    if (!('mediaSession' in navigator)) return;
    const audio = this.audioElement;
    if (!audio) return;
    const dur = audio.duration || 0;
    const cur = audio.currentTime || 0;

    if (isFinite(dur) && dur > 0 && isFinite(cur)) {
      try {
        navigator.mediaSession.setPositionState({
          duration: dur,
          playbackRate: audio.playbackRate || 1,
          position: Math.max(0, Math.min(cur, dur)),
        });
      } catch {
        // Position state is best-effort across WebView versions.
      }
    }
  }

  // Initialize Web Audio API nodes on user gesture with full error protection.
  // Android skips this entirely: the audio graph only exists to process
  // HTMLAudioElement output, which is not used for native playback.
  public initWebAudio() {
    if (this.usesNativePlayback()) return;

    const audio = this.ensureAudioElement();

    if (this.audioCtx && this.audioCtx.state === 'closed') {
      this.isInitialized = false;
      this.audioCtx = null;
      this.sourceNode = null;
      const oldSrc = audio.src;
      const oldTime = audio.currentTime;
      this.audioElement = this.createAudioElement();
      if (oldSrc) this.audioElement.src = oldSrc;
      this.audioElement.currentTime = oldTime;
      this.wireAudioElementEvents(this.audioElement);
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

      this.bassFilter = this.audioCtx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.value = 100;
      this.bassFilter.gain.value = 0;

      this.trebleFilter = this.audioCtx.createBiquadFilter();
      this.trebleFilter.type = 'highshelf';
      this.trebleFilter.frequency.value = 8000;
      this.trebleFilter.gain.value = 0;

      this.sourceNode = this.audioCtx.createMediaElementSource(this.audioElement);

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

  private wireAudioElementEvents(audio: HTMLAudioElement) {
    if ((audio as any).__aetherEventsWired) return;
    (audio as any).__aetherEventsWired = true;

    audio.addEventListener('ended', () => {
      this.cancelBackgroundPlaybackRecovery();
      this.shouldResumeAfterInterruption = false;
      this.backgroundAutoPaused = false;
      this.releaseWakeLock();
      this.onStateChangeCallback?.(false);
      this.onTrackEndedCallback?.();
    });

    audio.addEventListener('loadedmetadata', () => {
      if (this.currentTrack) {
        this.updateMediaSession(this.currentTrack);
      }
      this.syncMediaSessionPosition();
    });

    audio.addEventListener('timeupdate', () => {
      const cur = audio.currentTime || 0;
      const dur = audio.duration || 0;
      this.onTimeUpdateCallback?.(cur, dur);
      this.syncMediaSessionPosition();
    });

    audio.addEventListener('play', () => {
      this.cancelBackgroundPlaybackRecovery();
      this.shouldResumeAfterInterruption = true;
      this.backgroundAutoPaused = false;
      this.claimExclusiveAudioFocus();
      this.onStateChangeCallback?.(true);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    });

    audio.addEventListener('pause', () => {
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

    audio.addEventListener('error', async () => {
      console.warn('Audio element error encountered:', audio.error);
      this.onStateChangeCallback?.(false);

      if (this.currentTrack) {
        try {
          const blob = await getTrackBlob(this.currentTrack.id);
          if (blob) {
            const freshUrl = URL.createObjectURL(blob);
            this.setAudioSource(freshUrl);
            audio.removeAttribute('crossorigin');
            audio.load();
            await audio.play();
            return;
          }
        } catch (err) {
          console.error('Failed to reload track blob from IndexedDB:', err);
        }
      }

      this.onTrackEndedCallback?.();
    });
  }

  private setAudioSource(src: string) {
    const audio = this.audioElement;
    if (!audio) return;
    if (this.currentObjectUrl && this.currentObjectUrl !== src) {
      try {
        URL.revokeObjectURL(this.currentObjectUrl);
      } catch {}
    }

    this.currentObjectUrl = src.startsWith('blob:') ? src : null;
    audio.src = src;
  }

  // =====================================================================
  // Public API
  // =====================================================================

  public async playTrack(track: Track, audioUrl?: string, callbacks?: AudioEngineCallbacks): Promise<void> {
    if (callbacks) {
      if (callbacks.onEnded) this.onTrackEndedCallback = callbacks.onEnded;
      if (callbacks.onTimeUpdate) this.onTimeUpdateCallback = callbacks.onTimeUpdate;
      if (callbacks.onStateChange) this.onStateChangeCallback = callbacks.onStateChange;
      if (callbacks.onError) this.onErrorCallback = callbacks.onError;
    }
    this.currentTrack = track;

    if (this.usesNativePlayback()) {
      // Android: native playback ONLY. No WebView fallback exists here — a
      // fallback would reintroduce the exact background-playback failure
      // this architecture exists to prevent.
      try {
        await this.playTrackNatively(track, audioUrl);
      } catch (err) {
        console.error('Native playback failed:', err);
        this.nativePlaying = false;
        this.onStateChangeCallback?.(false);
        const message = err instanceof Error ? err.message : 'Native playback failed';
        this.onErrorCallback?.(message);
      }
      return;
    }

    // ---- Web path ----
    this.initWebAudio();
    this.cancelBackgroundPlaybackRecovery();

    let urlToPlay = audioUrl || track.audioUrl;

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

    const audio = this.ensureAudioElement();

    if (urlToPlay.startsWith('http://') || urlToPlay.startsWith('https://')) {
      audio.crossOrigin = 'anonymous';
    } else {
      audio.removeAttribute('crossorigin');
    }

    this.setAudioSource(urlToPlay);
    audio.load();

    try {
      this.shouldResumeAfterInterruption = true;
      await this.claimExclusiveAudioFocus();
      await audio.play();
      this.updateMediaSession(track);
      this.syncMediaSessionPosition();
    } catch (err) {
      console.error('Playback initiation failed:', err);
      this.onStateChangeCallback?.(false);
    }
  }

  public play() {
    if (this.usesNativePlayback()) {
      AetherPlayer.play().catch((err) => console.error('Native play error:', err));
      return;
    }
    this.initWebAudio();
    this.shouldResumeAfterInterruption = true;
    this.claimExclusiveAudioFocus();
    this.audioElement?.play().catch((err) => console.error('Play error:', err));
  }

  public pause() {
    if (this.usesNativePlayback()) {
      AetherPlayer.pause().catch((err) => console.error('Native pause error:', err));
      return;
    }
    this.cancelBackgroundPlaybackRecovery();
    this.shouldResumeAfterInterruption = false;
    this.backgroundAutoPaused = false;
    this.releaseWakeLock();
    this.audioElement?.pause();
  }

  public togglePlayPause() {
    // Single source of truth: ask the active engine whether it is paused.
    // (Do NOT inspect audioElement here — on Android it does not exist and
    // the old check made "toggle" degenerate into "always play".)
    if (this.isPaused()) {
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
    const audio = this.audioElement;
    if (!audio) return;
    if (!isNaN(seconds) && isFinite(seconds)) {
      const duration = audio.duration;
      const clamped = isFinite(duration) && duration > 0
        ? Math.max(0, Math.min(seconds, duration))
        : Math.max(0, seconds);
      audio.currentTime = clamped;
      this.syncMediaSessionPosition();
    }
  }

  public setVolume(val: number) {
    const clamped = Math.max(0, Math.min(1, val));
    if (this.usesNativePlayback()) {
      AetherPlayer.setVolume({ volume: clamped }).catch(() => {});
      return;
    }
    if (this.audioElement) this.audioElement.volume = clamped;
  }

  public setPlaybackRate(rate: number) {
    if (this.usesNativePlayback()) {
      AetherPlayer.setPlaybackRate({ rate }).catch(() => {});
      return;
    }
    if (this.audioElement) this.audioElement.playbackRate = rate;
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

  // Apply Equalizer & Audio FX Settings (web only; native path has no graph)
  public applyEQ(eq: EQSettings) {
    if (!this.isInitialized || !this.audioCtx || this.audioCtx.state === 'closed') return;

    if (this.preampGainNode) {
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

  // Media Session API is the WEB lock-screen story. On Android the native
  // MediaSession/notification owns metadata; a second WebView MediaSession
  // would fight it, so this is a no-op there.
  public updateMediaSession(track: Track) {
    if (this.usesNativePlayback()) return;
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

    const audio = this.audioElement;
    navigator.mediaSession.playbackState = audio ? (audio.paused ? 'paused' : 'playing') : 'paused';
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
    // Remember the skip handlers either way: on Android they are invoked by
    // native notification/lock-screen events routed through the plugin.
    this.onNativeNext = handlers.onNext;
    this.onNativePrevious = handlers.onPrevious;

    if (this.usesNativePlayback()) {
      // The native MediaSession handles transport controls; do not register
      // a competing WebView MediaSession.
      return;
    }

    if (!('mediaSession' in navigator)) return;

    const audio = () => this.audioElement;

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
        this.seek((audio()?.currentTime || 0) - 10);
        handlers.onSeekBackward?.();
      },
      seekforward: () => {
        this.seek((audio()?.currentTime || 0) + 10);
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
    return this.usesNativePlayback() ? this.nativePosition : this.audioElement?.currentTime || 0;
  }

  public getDuration(): number {
    return this.usesNativePlayback() ? this.nativeDuration : this.audioElement?.duration || 0;
  }

  public isPaused(): boolean {
    return this.usesNativePlayback() ? !this.nativePlaying : this.audioElement?.paused ?? true;
  }
}

export const audioEngine = AudioEngine.getInstance();
