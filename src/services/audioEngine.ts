import { assetUrl } from "./deployment";
import { Capacitor } from "@capacitor/core";
import { Track, EQSettings, PlayerSettings } from "../types";
import { getTrackBlob } from "./db";
import {
  AetherPlayer,
  extensionForTrack,
  importTrackToNativeStore,
  nativeTrackExists,
} from "./aetherPlayer";

import { EQ_FREQUENCIES, headroomDb } from "./dsp";
export { EQ_FREQUENCIES } from "./dsp";
export type PlaybackStatus =
  | "idle"
  | "loading"
  | "buffering"
  | "playing"
  | "paused"
  | "error";
export interface MeterLevels {
  left: number;
  right: number;
  peak: number;
  overloaded: boolean;
  source: "web" | "native" | "unavailable";
}

export interface AudioEngineCallbacks {
  onStatusChange?: (status: PlaybackStatus) => void;
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
  private outputVolume = 0.85;
  private lastEQ: EQSettings | null = null;
  private widthGains: GainNode[] = [];
  private startPosition = 0;
  private loadGeneration = 0;
  private loadedTrackId: string | null = null;
  private playbackRate = 1;
  private status: PlaybackStatus = "idle";
  private onStatusChange?: (status: PlaybackStatus) => void;
  private stereoAnalysers: AnalyserNode[] = [];
  private guardAnalysers: AnalyserNode[] = [];
  private protectionEnabled: boolean | undefined;
  private protectionCurve: Float32Array | null = null;
  private meterSamples = new Float32Array(1024);
  private frequencySamples = new Uint8Array(1024);
  private protection: WaveShaperNode | null = null;
  private outputCeiling: WaveShaperNode | null = null;
  private ceilingCurve: Float32Array | null = null;
  private balanceGains: GainNode[] = [];
  private switchGain: GainNode | null = null;
  private nativeMeter: MeterLevels = {
    left: 0,
    right: 0,
    peak: 0,
    overloaded: false,
    source: "native",
  };
  private nativeMeterAt = 0;
  private nativeTracks = new Map<string, Track>();
  public isNative() {
    return this.usesNativePlayback();
  }
  public getDspSampleRate() {
    return this.audioCtx?.sampleRate || this.currentTrack?.sampleRate || 48000;
  }
  public getStatus() {
    return this.status;
  }
  private setStatus(status: PlaybackStatus) {
    this.status = status;
    this.onStatusChange?.(status);
  }
  private fail(message: string) {
    this.shouldResumeAfterInterruption = false;
    this.setStatus("error");
    this.audioElement?.pause();
    this.onStateChangeCallback?.(false);
    this.onErrorCallback?.(message);
  }
  public setStartPosition(seconds: number) {
    this.startPosition = Math.max(0, seconds);
  }
  public setCallbacks(callbacks: AudioEngineCallbacks) {
    this.onStatusChange = callbacks.onStatusChange;
    this.onStatusChange?.(this.status);
    this.onTrackEndedCallback = callbacks.onEnded;
    this.onTimeUpdateCallback = callbacks.onTimeUpdate;
    this.onStateChangeCallback = callbacks.onStateChange;
    this.onErrorCallback = callbacks.onError;
  }
  private wakeLock: any = null;
  private shouldResumeAfterInterruption = false;
  private backgroundAutoPaused = false;
  private currentObjectUrl: string | null = null;
  private backgroundRecoveryTimer: number | null = null;
  private backgroundRecoveryAttempts = 0;

  // ---- Shared state ----------------------------------------------------
  private currentTrack: Track | null = null;
  private onTrackEndedCallback?: () => void;
  private onTimeUpdateCallback?: (
    currentTime: number,
    duration: number,
  ) => void;
  private onStateChangeCallback?: (isPlaying: boolean) => void;
  private onErrorCallback?: (message: string) => void;

  // ---- Native mirror (display only; ExoPlayer is the source of truth) --
  public onNativeTrackChanged?: (id: string) => void;
  public async syncNativeState() {
    if (!this.usesNativePlayback()) return null;
    const state = await AetherPlayer.getState();
    this.nativePlaying = state.isPlaying;
    this.nativePosition = state.currentTime;
    this.nativeDuration = state.duration;
    this.loadedTrackId = state.trackId || null;
    this.setStatus(state.isPlaying ? "playing" : "paused");
    return state;
  }
  public async configureQueue(
    tracks: Track[],
    shuffle: boolean,
    repeat: "off" | "all" | "one",
    autoplay: boolean,
  ) {
    if (!this.usesNativePlayback()) return;
    this.nativeTracks = new Map(tracks.map((track) => [track.id, track]));
    await AetherPlayer.setQueue({
      tracks: tracks.map(({ id, title, artist, album }) => ({
        id,
        title,
        artist,
        album,
      })),
      shuffle,
      repeat,
      autoplay,
    });
  }
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
    return (
      Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
    );
  }

  private setupNativePlayerBridge() {
    if (this.nativeListenerAttached || !this.usesNativePlayback()) return;
    this.nativeListenerAttached = true;

    AetherPlayer.addListener("playerEvent", (event) => {
      // Ignore telemetry from the old decoder while a newer track is being prepared.
      if (
        event.trackId &&
        this.status === "loading" &&
        this.currentTrack &&
        event.trackId !== this.currentTrack.id
      )
        return;
      if (event.meter) {
        this.nativeMeter = { ...event.meter, source: "native" };
        this.nativeMeterAt = performance.now();
      }
      if (event.type === "buffering") this.setStatus("buffering");
      if (event.type === "ready" && this.status !== "error")
        this.setStatus(event.isPlaying ? "playing" : "paused");
      if (typeof event.currentTime === "number")
        this.nativePosition = event.currentTime;
      if (typeof event.duration === "number" && event.duration > 0)
        this.nativeDuration = event.duration;

      if (event.type === "track" && event.trackId) {
        this.loadedTrackId = event.trackId;
        this.currentTrack =
          this.nativeTracks.get(event.trackId) || this.currentTrack;
        this.onNativeTrackChanged?.(event.trackId);
      } else if (event.type === "state") {
        this.nativePlaying = !!event.isPlaying;
        if (this.nativePlaying) this.setStatus("playing");
        else if (
          this.status !== "loading" &&
          this.status !== "buffering" &&
          this.status !== "error"
        )
          this.setStatus("paused");
        this.onStateChangeCallback?.(this.nativePlaying);
      } else if (event.type === "time") {
        this.onTimeUpdateCallback?.(this.nativePosition, this.nativeDuration);
      } else if (event.type === "ended") {
        this.nativePlaying = false;
        this.onStateChangeCallback?.(false);
        // Native queue and repeat are owned by ExoPlayer, even with no WebView.
      } else if (event.type === "next") {
        this.onNativeNext?.();
      } else if (event.type === "previous") {
        this.onNativePrevious?.();
      } else if (event.type === "error") {
        this.nativePlaying = false;
        this.fail(event.message || "Native playback error");
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
  private async playTrackNatively(
    track: Track,
    generation: number,
    position: number,
    audioUrl?: string,
  ): Promise<void> {
    const meta = {
      title: track.title,
      artist: track.artist,
      album: track.album || "Aether",
      startPosition: position,
    };

    const remoteUrl = audioUrl || track.audioUrl;
    if (
      remoteUrl &&
      (remoteUrl.startsWith("file://") || remoteUrl.startsWith("content://"))
    ) {
      if (generation !== this.loadGeneration) return;
      await AetherPlayer.playUrl({ url: remoteUrl, ...meta });
      return;
    }

    const exists = await nativeTrackExists(track.id);
    if (generation !== this.loadGeneration) return;
    if (!exists) {
      const blob = await getTrackBlob(track.id);
      if (generation !== this.loadGeneration) return;
      if (!blob) {
        throw new Error(`No audio data found for "${track.title}"`);
      }
      // One-time import into persistent native storage. Afterwards this
      // track never crosses the JS/native boundary again.
      await importTrackToNativeStore(
        {
          trackId: track.id,
          extension: extensionForTrack(track.format, blob.type),
        },
        blob,
      );
    }

    if (generation !== this.loadGeneration) return;
    await AetherPlayer.playStored({ trackId: track.id, ...meta });
    if (generation !== this.loadGeneration) return;
    this.loadedTrackId = track.id;
    // Only native isPlaying/READY events may report actual playback.

    try {
      window.localStorage.setItem("aether.lastTrackId", track.id);
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
    audio.preload = "metadata";
    audio.autoplay = false;
    audio.controls = false;
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
    audio.setAttribute("x-webkit-airplay", "allow");
    audio.disableRemotePlayback = false;
    (audio as any).preservesPitch = true;
    return audio;
  }

  // Claim Exclusive Audio Focus on the web stack (no-op on Android where
  // ExoPlayer requests focus natively with setAudioAttributes).
  public async claimExclusiveAudioFocus() {
    if (this.usesNativePlayback()) return;
    try {
      if (this.audioCtx && this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      const audio = this.audioElement;
      if (audio?.muted) {
        audio.muted = false;
      }

      if ("mediaSession" in navigator && audio) {
        navigator.mediaSession.playbackState = audio.paused
          ? "none"
          : "playing";
      }

      if (audio && !audio.paused) this.acquireWakeLock();
    } catch (e) {
      console.warn("Audio focus claim exception:", e);
    }
  }

  private async acquireWakeLock() {
    if ("wakeLock" in navigator && !this.wakeLock) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request("screen");
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
    return document.visibilityState === "hidden";
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

      if (this.audioCtx && this.audioCtx.state === "suspended") {
        await this.audioCtx.resume().catch(() => {});
      }

      if (audio?.paused) {
        await audio.play().catch(() => {});
      }

      if (audio && !audio.paused) {
        this.backgroundAutoPaused = false;
        this.acquireWakeLock();
        this.syncMediaSessionPosition();
        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "playing";
        }
      }

      const needsAnotherAttempt =
        this.shouldResumeAfterInterruption &&
        this.isBackgrounded() &&
        (!this.audioElement ||
          this.audioElement.paused ||
          this.audioCtx?.state === "suspended");

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
    this.backgroundRecoveryTimer = window.setTimeout(
      () => {
        void attemptRecovery();
      },
      immediate ? 120 : 400,
    );
  }

  private setupVisibilityHandlers() {
    const recoverPlayback = () => {
      if (this.isBackgrounded()) {
        const audio = this.audioElement;
        if (audio && !audio.paused) {
          this.shouldResumeAfterInterruption = true;
          this.syncMediaSessionPosition();
          if ("mediaSession" in navigator) {
            navigator.mediaSession.playbackState = "playing";
          }
          this.acquireWakeLock();
          this.scheduleBackgroundPlaybackRecovery();
        }
        return;
      }

      this.resumeAfterBackgroundInterruption();
    };

    document.addEventListener("visibilitychange", recoverPlayback);
    window.addEventListener("pageshow", recoverPlayback);
    document.addEventListener("resume", recoverPlayback as EventListener);
  }

  private async resumeAfterBackgroundInterruption() {
    this.cancelBackgroundPlaybackRecovery();

    if (this.audioCtx && this.audioCtx.state === "suspended") {
      await this.audioCtx.resume().catch(() => {});
    }

    const audio = this.audioElement;
    if (
      audio &&
      (this.backgroundAutoPaused || audio.paused) &&
      this.shouldResumeAfterInterruption
    ) {
      this.backgroundAutoPaused = false;
      await audio.play().catch(() => {});
    }

    if (audio && !audio.paused) {
      this.claimExclusiveAudioFocus();
      this.syncMediaSessionPosition();
    }
  }

  private syncMediaSessionPosition() {
    if (!("mediaSession" in navigator)) return;
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

    if (this.audioCtx && this.audioCtx.state === "closed") {
      this.isInitialized = false;
      this.audioCtx = null;
      this.sourceNode = null;
      audio.pause();
      const oldSrc = audio.src;
      const oldTime = audio.currentTime;
      this.audioElement = this.createAudioElement();
      if (oldSrc) this.audioElement.src = oldSrc;
      this.audioElement.currentTime = oldTime;
      this.wireAudioElementEvents(this.audioElement);
    }

    if (this.isInitialized) {
      if (this.audioCtx && this.audioCtx.state === "suspended") {
        this.audioCtx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtxClass =
        window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 2048;
      this.analyserNode.smoothingTimeConstant = 0.8;

      this.preampGainNode = this.audioCtx.createGain();
      this.masterGainNode = this.audioCtx.createGain();
      this.masterGainNode.gain.value = this.outputVolume;

      this.eqFilters = EQ_FREQUENCIES.map((freq) => {
        const filter = this.audioCtx!.createBiquadFilter();
        filter.type = "peaking";
        filter.Q.value = 1.4;
        filter.frequency.value = Math.min(
          freq,
          this.audioCtx!.sampleRate * 0.45,
        );
        filter.gain.value = 0;
        return filter;
      });

      this.bassFilter = this.audioCtx.createBiquadFilter();
      this.bassFilter.type = "lowshelf";
      this.bassFilter.frequency.value = Math.min(
        100,
        this.audioCtx.sampleRate * 0.45,
      );
      this.bassFilter.gain.value = 0;

      this.trebleFilter = this.audioCtx.createBiquadFilter();
      this.trebleFilter.type = "highshelf";
      this.trebleFilter.frequency.value = Math.min(
        8000,
        this.audioCtx.sampleRate * 0.45,
      );
      this.trebleFilter.gain.value = 0;

      this.sourceNode = this.audioCtx.createMediaElementSource(
        this.audioElement,
      );
      this.sourceNode.channelCount = 2;
      this.sourceNode.channelCountMode = "explicit"; // Upmix mono before stereo splitting.
      this.switchGain = this.audioCtx.createGain();
      this.switchGain.channelCount = 2;
      this.switchGain.channelCountMode = "explicit";
      this.switchGain.channelInterpretation = "speakers";

      this.sourceNode.connect(this.switchGain);
      let lastNode: AudioNode = this.switchGain;
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

      const splitter = this.audioCtx.createChannelSplitter(2);
      splitter.channelCount = 2;
      splitter.channelCountMode = "explicit";
      const merger = this.audioCtx.createChannelMerger(2);
      lastNode.connect(splitter);
      this.widthGains = [0, 1, 2, 3].map(() => this.audioCtx!.createGain());
      // Lout = L*(1+w)/2 + R*(1-w)/2, symmetric for Rout.
      for (let input = 0; input < 2; input++)
        for (let output = 0; output < 2; output++) {
          const gain = this.widthGains[input * 2 + output];
          gain.gain.value = input === output ? 1 : 0;
          splitter.connect(gain, input);
          gain.connect(merger, 0, output);
        }
      const balanceSplitter = this.audioCtx.createChannelSplitter(2);
      const balanceMerger = this.audioCtx.createChannelMerger(2);
      merger.connect(balanceSplitter);
      this.balanceGains = [0, 1].map((channel) => {
        const gain = this.audioCtx!.createGain();
        balanceSplitter.connect(gain, channel);
        gain.connect(balanceMerger, 0, channel);
        return gain;
      });
      const guardSplitter = this.audioCtx.createChannelSplitter(2);
      balanceMerger.connect(guardSplitter);
      this.guardAnalysers = [0, 1].map((channel) => {
        const analyser = this.audioCtx!.createAnalyser();
        analyser.fftSize = 1024;
        guardSplitter.connect(analyser, channel);
        return analyser;
      });
      this.protection = this.audioCtx.createWaveShaper();
      this.protectionEnabled = undefined;
      this.protection.oversample = "2x";
      balanceMerger.connect(this.protection);
      this.outputCeiling = this.audioCtx.createWaveShaper();
      this.outputCeiling.oversample = "none";
      this.protection.connect(this.outputCeiling);
      this.outputCeiling.connect(this.masterGainNode);
      this.masterGainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioCtx.destination);
      const meterSplitter = this.audioCtx.createChannelSplitter(2);
      this.masterGainNode.connect(meterSplitter);
      this.stereoAnalysers = [0, 1].map((channel) => {
        const analyser = this.audioCtx!.createAnalyser();
        analyser.fftSize = 1024;
        meterSplitter.connect(analyser, channel);
        return analyser;
      });

      this.isInitialized = true;
      if (this.lastEQ) this.applyEQ(this.lastEQ);
    } catch (e) {
      console.warn("Web Audio initialization error:", e);
    }
  }

  private wireAudioElementEvents(audio: HTMLAudioElement) {
    if ((audio as any).__aetherEventsWired) return;
    (audio as any).__aetherEventsWired = true;

    audio.addEventListener("ended", () => {
      if (this.loadedTrackId !== this.currentTrack?.id) return;
      this.cancelBackgroundPlaybackRecovery();
      this.shouldResumeAfterInterruption = false;
      this.backgroundAutoPaused = false;
      this.releaseWakeLock();
      this.setStatus("paused");
      this.onStateChangeCallback?.(false);
      this.onTrackEndedCallback?.();
    });

    audio.addEventListener("loadedmetadata", () => {
      if (this.loadedTrackId !== this.currentTrack?.id) return;
      if (this.startPosition > 0) {
        audio.currentTime = Math.min(
          this.startPosition,
          audio.duration || this.startPosition,
        );
        this.startPosition = 0;
      }
      if (this.currentTrack) {
        this.updateMediaSession(this.currentTrack);
      }
      this.syncMediaSessionPosition();
    });

    audio.addEventListener("timeupdate", () => {
      if (this.loadedTrackId !== this.currentTrack?.id) return;
      const cur = audio.currentTime || 0;
      const dur = audio.duration || 0;
      this.onTimeUpdateCallback?.(cur, dur);
      this.syncMediaSessionPosition();
    });

    audio.addEventListener("playing", () => {
      if (audio.paused || this.loadedTrackId !== this.currentTrack?.id) return;
      this.setStatus("playing");
      if (this.switchGain && this.audioCtx) {
        const now = this.audioCtx.currentTime;
        this.switchGain.gain.cancelScheduledValues(now);
        this.switchGain.gain.setValueAtTime(0, now);
        this.switchGain.gain.linearRampToValueAtTime(1, now + 0.012);
      }
      this.cancelBackgroundPlaybackRecovery();
      this.shouldResumeAfterInterruption = true;
      this.backgroundAutoPaused = false;
      this.claimExclusiveAudioFocus();
      this.onStateChangeCallback?.(true);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
    });

    audio.addEventListener("pause", () => {
      if (this.isBackgrounded() && this.shouldResumeAfterInterruption) {
        this.backgroundAutoPaused = true;
        this.scheduleBackgroundPlaybackRecovery(true);
      } else {
        this.cancelBackgroundPlaybackRecovery();
        this.releaseWakeLock();
      }

      if (!["loading", "buffering", "error"].includes(this.status))
        this.setStatus("paused");
      this.onStateChangeCallback?.(false);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "paused";
      }
    });

    for (const event of ["waiting", "stalled"] as const)
      audio.addEventListener(event, () => {
        if (!audio.paused && this.status !== "loading")
          this.setStatus("buffering");
      });
    audio.addEventListener("error", () => {
      if (audio.error)
        this.fail(
          "This audio file is missing, corrupt, or unsupported by this browser. Re-import it or try another format.",
        );
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

    this.currentObjectUrl = src.startsWith("blob:") ? src : null;
    audio.src = src;
  }

  // =====================================================================
  // Public API
  // =====================================================================

  public async playTrack(
    track: Track,
    audioUrl?: string,
    callbacks?: AudioEngineCallbacks,
  ): Promise<void> {
    if (callbacks) {
      if (callbacks.onEnded) this.onTrackEndedCallback = callbacks.onEnded;
      if (callbacks.onTimeUpdate)
        this.onTimeUpdateCallback = callbacks.onTimeUpdate;
      if (callbacks.onStateChange)
        this.onStateChangeCallback = callbacks.onStateChange;
      if (callbacks.onError) this.onErrorCallback = callbacks.onError;
    }
    const generation = ++this.loadGeneration;
    const position = this.startPosition;
    this.startPosition = 0;
    this.currentTrack = track;
    this.setStatus("loading");
    this.nativeMeterAt = 0;
    this.onStateChangeCallback?.(false);
    this.cancelBackgroundPlaybackRecovery();
    this.shouldResumeAfterInterruption = false;
    if (this.usesNativePlayback()) {
      try {
        await this.playTrackNatively(track, generation, position, audioUrl);
      } catch (err) {
        if (generation === this.loadGeneration) {
          this.nativePlaying = false;
          this.fail(
            err instanceof Error ? err.message : "Native playback failed",
          );
        }
      }
      return;
    }

    // Start AudioContext resume on the user gesture, before any IndexedDB await.
    this.initWebAudio();
    if (!this.isInitialized) {
      this.fail(
        "Audio processing could not be initialized. Reload and press play again.",
      );
      return;
    }
    const focus = this.claimExclusiveAudioFocus();
    // Ramp the old signal down before source replacement; never mix two decoders.
    if (this.switchGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.switchGain.gain.cancelScheduledValues(now);
      this.switchGain.gain.setValueAtTime(this.switchGain.gain.value, now);
      this.switchGain.gain.linearRampToValueAtTime(0, now + 0.008);
    }
    let ownedUrl: string | null = null;
    try {
      const blob =
        audioUrl || track.audioUrl ? null : await getTrackBlob(track.id);
      if (generation !== this.loadGeneration) return;
      let urlToPlay = audioUrl || track.audioUrl;
      if (blob) urlToPlay = ownedUrl = URL.createObjectURL(blob);
      if (!urlToPlay)
        throw new Error(
          "Audio is not present on this device. Re-import the original file.",
        );
      // Local files only. No remote streaming URL can enter this graph.
      if (
        !/^(blob:|data:audio\/)/.test(urlToPlay) &&
        !/^\/(?![\\/])/.test(urlToPlay)
      )
        throw new Error("Only local audio is supported.");
      await focus;
      await new Promise((resolve) => window.setTimeout(resolve, 12));
      if (generation !== this.loadGeneration) {
        if (ownedUrl) URL.revokeObjectURL(ownedUrl);
        return;
      }
      const audio = this.ensureAudioElement();
      audio.pause();
      audio.removeAttribute("crossorigin");
      this.startPosition = position;
      this.setAudioSource(urlToPlay);
      ownedUrl = null; // Source owner now manages revocation.
      this.loadedTrackId = track.id;
      audio.playbackRate = this.playbackRate;
      audio.load();
      if (this.switchGain && this.audioCtx) {
        this.switchGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
        this.switchGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        this.switchGain.gain.linearRampToValueAtTime(
          1,
          this.audioCtx.currentTime + 0.02,
        );
      }
      this.shouldResumeAfterInterruption = true;
      await audio.play();
      if (generation !== this.loadGeneration) return;
      this.updateMediaSession(track);
      this.syncMediaSessionPosition();
    } catch (err) {
      if (ownedUrl) URL.revokeObjectURL(ownedUrl);
      if (generation !== this.loadGeneration) return; // Interrupted play() is expected during rapid skipping.
      this.fail(
        err instanceof Error
          ? err.message
          : "Playback failed. Try pressing play again.",
      );
    }
  }

  public play() {
    const canResumeWeb =
      !this.usesNativePlayback() &&
      this.audioElement?.src &&
      !this.audioElement.error &&
      this.loadedTrackId === this.currentTrack?.id;
    if (
      this.currentTrack &&
      (this.loadedTrackId !== this.currentTrack.id ||
        (this.status === "error" && !canResumeWeb))
    ) {
      void this.playTrack(this.currentTrack);
      return;
    }
    // Retry an autoplay-policy rejection on the direct gesture, without reloading the decoder.
    if (canResumeWeb && this.status === "error") this.setStatus("buffering");
    if (this.usesNativePlayback()) {
      AetherPlayer.play().catch((err) =>
        this.onErrorCallback?.("Native play failed: " + err.message),
      );
      return;
    }
    this.initWebAudio();
    this.shouldResumeAfterInterruption = true;
    this.claimExclusiveAudioFocus();
    this.audioElement
      ?.play()
      .catch((err) => this.fail("Playback could not resume: " + err.message));
  }

  public pause() {
    ++this.loadGeneration;
    this.setStatus("paused");
    this.onStateChangeCallback?.(false);
    if (this.switchGain && this.audioCtx)
      this.switchGain.gain.setTargetAtTime(1, this.audioCtx.currentTime, 0.01);
    if (this.usesNativePlayback()) {
      AetherPlayer.pause().catch((err) =>
        this.onErrorCallback?.("Native pause failed: " + err.message),
      );
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
      const clamped =
        isFinite(duration) && duration > 0
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
    this.outputVolume = clamped;
    if (this.audioElement) this.audioElement.volume = 1;
    if (this.masterGainNode && this.audioCtx)
      this.masterGainNode.gain.setTargetAtTime(
        clamped,
        this.audioCtx.currentTime,
        0.01,
      );
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = Math.max(0.5, Math.min(3, rate));
    if (this.usesNativePlayback()) {
      AetherPlayer.setPlaybackRate({ rate }).catch(() => {});
      return;
    }
    if (this.audioElement) this.audioElement.playbackRate = rate;
  }

  public getAnalyserData(
    frequencyArray: Uint8Array,
    timeDomainArray: Uint8Array,
  ) {
    if (this.analyserNode) {
      // Sample the whole FFT rather than silently dropping all the high bins.
      if (this.frequencySamples.length !== this.analyserNode.frequencyBinCount)
        this.frequencySamples = new Uint8Array(
          this.analyserNode.frequencyBinCount,
        );
      const bins = this.frequencySamples;
      this.analyserNode.getByteFrequencyData(bins);
      for (let i = 0; i < frequencyArray.length; i++)
        frequencyArray[i] =
          bins[Math.floor((i * bins.length) / frequencyArray.length)];
      this.analyserNode.getByteTimeDomainData(timeDomainArray);
    } else {
      frequencyArray.fill(0);
      timeDomainArray.fill(128);
    }
  }

  /** Real, independent channel RMS. Native values are measured in the PCM sink, not invented from spectrum bins. */
  public getMeterLevels(): MeterLevels {
    if (this.usesNativePlayback()) {
      if (!this.nativePlaying || performance.now() - this.nativeMeterAt > 500)
        return {
          ...this.nativeMeter,
          left: 0,
          right: 0,
          peak: 0,
          overloaded: false,
        };
      return this.nativeMeter;
    }
    let peak = 0;
    const rms = this.stereoAnalysers.map((analyser) => {
      analyser.getFloatTimeDomainData(this.meterSamples);
      let sum = 0;
      for (const sample of this.meterSamples) {
        sum += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
      }
      return Math.sqrt(sum / this.meterSamples.length);
    });
    let hot = false;
    for (const analyser of this.guardAnalysers) {
      analyser.getFloatTimeDomainData(this.meterSamples);
      for (const sample of this.meterSamples)
        if (Math.abs(sample) >= 0.97) {
          hot = true;
          break;
        }
    }
    return {
      left: rms[0] || 0,
      right: rms[1] || 0,
      peak,
      overloaded: hot || peak >= 0.97,
      source: rms.length ? "web" : "unavailable",
    };
  }

  public applyEQ(eq: EQSettings) {
    this.lastEQ = eq;
    if (this.usesNativePlayback()) {
      AetherPlayer.applyEQ(eq).catch((error) =>
        this.fail("Native DSP failed: " + error.message),
      );
      return;
    }
    if (
      !this.isInitialized ||
      !this.audioCtx ||
      this.audioCtx.state === "closed"
    )
      return;
    const now = this.audioCtx.currentTime;
    const smooth = (param: AudioParam, value: number) => {
      param.cancelScheduledValues(now);
      param.setTargetAtTime(value, now, 0.025);
    };
    if (this.preampGainNode)
      smooth(
        this.preampGainNode.gain,
        eq.enabled
          ? 10 ** ((eq.preamp - headroomDb(eq, this.audioCtx.sampleRate)) / 20)
          : 1,
      );
    this.widthGains.forEach((gain, i) => {
      const width = eq.enabled ? (eq.mono ? 0 : eq.stereoWidth / 100) : 1;
      smooth(gain.gain, (i === 0 || i === 3 ? 1 + width : 1 - width) / 2);
    });
    this.balanceGains.forEach((gain, channel) => {
      const balance = eq.enabled ? eq.balance || 0 : 0;
      smooth(
        gain.gain,
        channel === 0 ? Math.min(1, 1 - balance) : Math.min(1, 1 + balance),
      );
    });
    this.eqFilters.forEach((filter, idx) =>
      smooth(filter.gain, eq.enabled ? eq.bands[idx] || 0 : 0),
    );
    if (this.bassFilter)
      smooth(this.bassFilter.gain, eq.enabled ? eq.bassBoost * 0.12 : 0);
    if (this.trebleFilter)
      smooth(this.trebleFilter.gain, eq.enabled ? eq.trebleBoost * 0.12 : 0);
    if (this.protection) {
      // Identity below -1.4 dBFS; a continuous soft knee bounds overloaded peaks.
      // This is a safety guard, not a loudness maximizer or true-peak limiter.
      const protect = eq.peakProtection !== false;
      if (this.protectionEnabled !== protect) {
        if (protect && !this.protectionCurve) {
          const curve = new Float32Array(4097);
          for (let i = 0; i < curve.length; i++) {
            const x = (i * 2) / (curve.length - 1) - 1,
              a = Math.abs(x);
            curve[i] =
              a > 0.85
                ? Math.sign(x) * (0.85 + 0.13 * Math.tanh((a - 0.85) / 0.13))
                : x;
          }
          this.protectionCurve = curve;
        }
        this.protection.curve = protect ? this.protectionCurve : null;
        // Oversampling reconstruction can overshoot a soft curve. Keep a final
        // sample ceiling AFTER that filter; this still makes no true-peak claim.
        if (!this.ceilingCurve) {
          this.ceilingCurve = new Float32Array(4097);
          for (let i = 0; i < this.ceilingCurve.length; i++)
            this.ceilingCurve[i] = Math.max(
              -0.98,
              Math.min(0.98, (i * 2) / (this.ceilingCurve.length - 1) - 1),
            );
        }
        if (this.outputCeiling)
          this.outputCeiling.curve = protect ? this.ceilingCurve : null;
        this.protectionEnabled = protect;
      }
    }
  }

  // Media Session API is the WEB lock-screen story. On Android the native
  // MediaSession/notification owns metadata; a second WebView MediaSession
  // would fight it, so this is a no-op there.
  public updateMediaSession(track: Track) {
    if (this.usesNativePlayback()) return;
    if (!("mediaSession" in navigator)) return;

    const artworkUrl =
      track.coverArt &&
      (track.coverArt.startsWith("http") ||
        track.coverArt.startsWith("data:image"))
        ? track.coverArt
        : new URL(assetUrl("pwa-512.png"), window.location.href).href;
    const artworkType =
      artworkUrl.includes(".png") || artworkUrl.startsWith("data:image/png")
        ? "image/png"
        : "image/jpeg";

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || "Aether Audio",
      artwork: [
        { src: artworkUrl, sizes: "96x96", type: artworkType },
        { src: artworkUrl, sizes: "256x256", type: artworkType },
        { src: artworkUrl, sizes: "512x512", type: artworkType },
      ],
    });

    const audio = this.audioElement;
    navigator.mediaSession.playbackState = audio
      ? audio.paused
        ? "paused"
        : "playing"
      : "paused";
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

    if (!("mediaSession" in navigator)) return;

    const audio = () => this.audioElement;

    const actionMap: Partial<
      Record<MediaSessionAction, (details?: any) => void>
    > = {
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
          navigator.mediaSession.setActionHandler(
            action as MediaSessionAction,
            handler as any,
          );
        } else {
          navigator.mediaSession.setActionHandler(
            action as MediaSessionAction,
            null,
          );
        }
      } catch (e) {
        // Safe catch for unsupported actions in older browsers
      }
    });
  }

  public getCurrentTime(): number {
    return this.usesNativePlayback()
      ? this.nativePosition
      : this.audioElement?.currentTime || 0;
  }

  public getDuration(): number {
    return this.usesNativePlayback()
      ? this.nativeDuration
      : this.audioElement?.duration || 0;
  }

  public isPaused(): boolean {
    return this.usesNativePlayback()
      ? !this.nativePlaying
      : (this.audioElement?.paused ?? true);
  }
}

export const audioEngine = AudioEngine.getInstance();
