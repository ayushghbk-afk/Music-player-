import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface AetherPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  native?: boolean;
  type?: string;
  message?: string;
}

export interface AetherPlayerPlugin {
  beginCache(options: { trackId: string; extension: string }): Promise<void>;
  appendCache(options: { data: string }): Promise<void>;
  playCached(options: {
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
