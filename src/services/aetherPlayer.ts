import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface AetherPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  native?: boolean;
  type?: string;
  message?: string;
}

export interface TrackImportOptions {
  trackId: string;
  extension: string;
}

export interface ServerInfo {
  available: boolean;
  port?: number;
  token?: string;
}

export interface AetherPlayerPlugin {
  /** Loopback server info for streamed imports (preferred path). */
  getServerInfo(): Promise<ServerInfo>;
  /** True when the track's audio file already exists in native storage. */
  hasTrack(options: { trackId: string }): Promise<{ available: boolean }>;
  /** Removes the track's stored audio file. */
  deleteTrack(options: { trackId: string }): Promise<void>;
  /** Removes every stored audio file. */
  clearTracks(): Promise<{ removed: number }>;
  /** Chunked (base64) import fallback: begin/append/commit. */
  beginCache(options: { trackId: string; extension: string }): Promise<void>;
  appendCache(options: { data: string }): Promise<void>;
  commitCache(): Promise<{ path: string }>;
  /** Legacy: finalize a chunked import and play it. */
  playCached(options: {
    title: string;
    artist: string;
    album: string;
    startPosition?: number;
  }): Promise<AetherPlayerState>;
  /** Play a track from persistent native storage (no transfer needed). */
  playStored(options: {
    trackId: string;
    title: string;
    artist: string;
    album: string;
    startPosition?: number;
  }): Promise<AetherPlayerState>;
  playUrl(options: {
    url: string;
    title: string;
    artist: string;
    album: string;
    startPosition?: number;
  }): Promise<AetherPlayerState>;
  play(): Promise<AetherPlayerState>;
  pause(): Promise<AetherPlayerState>;
  seek(options: { seconds: number }): Promise<AetherPlayerState>;
  setVolume(options: { volume: number }): Promise<void>;
  setPlaybackRate(options: { rate: number }): Promise<void>;
  getState(): Promise<AetherPlayerState>;
  addListener(
    eventName: 'playerEvent',
    listenerFunc: (event: AetherPlayerState) => void
  ): Promise<PluginListenerHandle>;
}

export const AetherPlayer = registerPlugin<AetherPlayerPlugin>('AetherPlayer');

const CHUNK_SIZE = 48 * 1024;

export const arrayBufferToBase64Chunks = (buffer: ArrayBuffer): string[] => {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const slice = bytes.subarray(offset, Math.min(offset + CHUNK_SIZE, bytes.length));
    let binary = '';
    for (let i = 0; i < slice.length; i++) {
      binary += String.fromCharCode(slice[i]);
    }
    chunks.push(btoa(binary));
  }
  return chunks;
};

export const extensionForTrack = (format?: string, mime?: string): string => {
  const source = `${format || ''} ${mime || ''}`.toLowerCase();
  if (source.includes('flac')) return 'flac';
  if (source.includes('wav')) return 'wav';
  if (source.includes('ogg')) return 'ogg';
  if (source.includes('aac') || source.includes('m4a')) return 'm4a';
  if (source.includes('mp3') || source.includes('mpeg')) return 'mp3';
  return 'bin';
};

/**
 * The original fetch, unaffected by the CapacitorHttp patch. Needed because
 * CapacitorHttp routes fetch bodies through the native bridge (stringifying /
 * base64-ing them), which would defeat the point of the streaming import.
 */
const rawFetch = (): typeof fetch => {
  const original = (window as any).CapacitorWebFetch;
  return typeof original === 'function' ? original.bind(window) : window.fetch.bind(window);
};

let cachedServerInfo: ServerInfo | null = null;

const serverInfo = async (): Promise<ServerInfo> => {
  if (cachedServerInfo && cachedServerInfo.available && cachedServerInfo.port) return cachedServerInfo;
  cachedServerInfo = await AetherPlayer.getServerInfo();
  return cachedServerInfo;
};

const importViaServer = async (
  options: TrackImportOptions,
  blob: Blob,
  info: ServerInfo
): Promise<void> => {
  if (!info.available || !info.port || !info.token) {
    throw new Error('Streaming server unavailable');
  }
  const url =
    `http://127.0.0.1:${info.port}/import/${encodeURIComponent(options.trackId)}` +
    `?ext=${encodeURIComponent(options.extension)}&token=${encodeURIComponent(info.token)}`;
  const response = await rawFetch()(url, {
    method: 'POST',
    body: blob,
    keepalive: false,
  });
  if (!response.ok) {
    throw new Error(`Streaming import failed: ${response.status}`);
  }
};

const importViaChunks = async (options: TrackImportOptions, blob: Blob): Promise<void> => {
  const buffer = await blob.arrayBuffer();
  const chunks = arrayBufferToBase64Chunks(buffer);
  await AetherPlayer.beginCache(options);
  for (const data of chunks) {
    await AetherPlayer.appendCache({ data });
  }
  await AetherPlayer.commitCache();
};

/**
 * Copies a track's audio blob into persistent native storage ONCE. Playback
 * afterwards never crosses the JS/native boundary with audio data.
 *
 * Preferred path: streamed over the loopback HTTP server (raw bytes, no
 * Base64, ~64 KB native buffers). Fallback: chunked base64 through the
 * Capacitor plugin, still persistent — it runs at import time in the
 * foreground, never on the playback path.
 */
export const importTrackToNativeStore = async (
  options: TrackImportOptions,
  blob: Blob
): Promise<'streamed' | 'chunked'> => {
  try {
    const info = await serverInfo();
    await importViaServer(options, blob, info);
    return 'streamed';
  } catch {
    cachedServerInfo = null; // re-probe next time
    await importViaChunks(options, blob);
    return 'chunked';
  }
};

export const nativeTrackExists = async (trackId: string): Promise<boolean> => {
  try {
    const { available } = await AetherPlayer.hasTrack({ trackId });
    return !!available;
  } catch {
    return false;
  }
};

export const deleteNativeTrack = async (trackId: string): Promise<void> => {
  try {
    await AetherPlayer.deleteTrack({ trackId });
  } catch {
    // Non-fatal: a leftover audio file only wastes space.
  }
};
