export type AudioFormat = 'FLAC' | 'WAV' | 'ALAC' | 'MP3' | 'AAC' | 'OGG' | 'DSD';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  format: AudioFormat;
  bitrate: string; // e.g. "24-bit / 96kHz FLAC"
  isHiRes: boolean;
  coverArt?: string; // base64 or URL or SVG gradient
  audioUrl?: string; // object URL or data URL
  addedAt: number;
  playCount: number;
  lastPlayed?: number;
  year?: number;
  genre?: string;
  trackNumber?: number;
  lyrics?: string;
  fileSizeMB?: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
  coverArt?: string;
  color?: string;
}

export interface EQSettings {
  enabled: boolean;
  preset: string;
  bands: number[]; // 10 gain values (-12dB to +12dB)
  preamp: number; // -12dB to +12dB
  bassBoost: number; // 0 to 100
  trebleBoost: number; // 0 to 100
  stereoWidth: number; // 0 to 200 (100 = normal)
}

export type ThemeOption = 'obsidian' | 'sapphire' | 'cyberpunk' | 'studio-gold' | 'slate';
export type VisualizerMode = 'bars' | 'wave' | 'nebula' | 'vu-meter' | '31-band';

export interface PlayerSettings {
  gapless: boolean;
  crossfadeSec: number;
  theme: ThemeOption;
  visualizerMode: VisualizerMode;
  volume: number;
  playbackRate: number;
  resampleRate: 'native' | '96khz' | '192khz';
  autoPlayNext: boolean;
}

export interface BackupPayload {
  version: string;
  exportedAt: string;
  name?: string;
  playlists: Playlist[];
  favorites: string[];
  trackMetadata: Array<Omit<Track, 'audioUrl'>>;
  settings: PlayerSettings;
  eqSettings: EQSettings;
}
