import { openDB, IDBPDatabase } from 'idb';
import { Track, Playlist, PlayerSettings, EQSettings, BackupPayload } from '../types';

const DB_NAME = 'AetherAudioDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Track store (stores metadata + audio blob)
        if (!db.objectStoreNames.contains('tracks')) {
          const trackStore = db.createObjectStore('tracks', { keyPath: 'id' });
          trackStore.createIndex('addedAt', 'addedAt');
          trackStore.createIndex('title', 'title');
          trackStore.createIndex('artist', 'artist');
          trackStore.createIndex('album', 'album');
        }

        // Playlists store
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }

        // Key-Value Store for settings & favorites
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv');
        }

        // Audio Blobs store for binary audio data
        if (!db.objectStoreNames.contains('audioBlobs')) {
          db.createObjectStore('audioBlobs');
        }
      },
    });
  }
  return dbPromise;
}

// Save or Update Track
export async function saveTrack(track: Track, blob?: Blob): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['tracks', 'audioBlobs'], 'readwrite');
  
  // Store track metadata without the ephemeral object URL
  const { audioUrl, ...trackMeta } = track;
  await tx.objectStore('tracks').put(trackMeta);

  if (blob) {
    await tx.objectStore('audioBlobs').put(blob, track.id);
  }
  await tx.done;
}

// Get All Tracks
export async function getAllTracks(): Promise<Track[]> {
  const db = await getDB();
  const rawTracks = await db.getAll('tracks');
  
  // Re-attach blob object URLs for local playback
  const tracksWithUrls = await Promise.all(
    rawTracks.map(async (t) => {
      const blob = await db.get('audioBlobs', t.id);
      let audioUrl = t.audioUrl;
      if (blob instanceof Blob) {
        audioUrl = URL.createObjectURL(blob);
      }
      return {
        ...t,
        audioUrl,
      } as Track;
    })
  );

  return tracksWithUrls;
}

// Get Audio Blob for track
export async function getTrackBlob(trackId: string): Promise<Blob | undefined> {
  const db = await getDB();
  return db.get('audioBlobs', trackId);
}

// Delete Track
export async function deleteTrack(trackId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['tracks', 'audioBlobs'], 'readwrite');
  await tx.objectStore('tracks').delete(trackId);
  await tx.objectStore('audioBlobs').delete(trackId);
  await tx.done;
}

// Playlists
export async function getAllPlaylists(): Promise<Playlist[]> {
  const db = await getDB();
  return db.getAll('playlists');
}

export async function savePlaylist(playlist: Playlist): Promise<void> {
  const db = await getDB();
  await db.put('playlists', playlist);
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  const db = await getDB();
  await db.delete('playlists', playlistId);
}

// KV Store (Favorites, Settings, EQ)
export async function getKV<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getDB();
  const val = await db.get('kv', key);
  return val !== undefined ? val : defaultValue;
}

export async function setKV<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put('kv', value, key);
}

// Storage stats calculation
export async function getStorageStats(): Promise<{ usedMB: number; trackCount: number; playlistCount: number }> {
  try {
    const db = await getDB();
    const tracks = await db.getAll('tracks');
    const playlists = await db.getAll('playlists');

    let totalBytes = 0;
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      totalBytes = estimate.usage || 0;
    } else {
      // Fallback estimate
      for (const t of tracks) {
        totalBytes += (t.fileSizeMB || 5) * 1024 * 1024;
      }
    }

    return {
      usedMB: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
      trackCount: tracks.length,
      playlistCount: playlists.length,
    };
  } catch {
    return { usedMB: 0, trackCount: 0, playlistCount: 0 };
  }
}

// Full Export for Backup
export async function createFullBackupPayload(
  settings: PlayerSettings,
  eqSettings: EQSettings
): Promise<BackupPayload> {
  const tracks = await getAllTracks();
  const playlists = await getAllPlaylists();
  const favorites = await getKV<string[]>('favorites', []);

  // Exclude ephemeral object URLs from backup metadata
  const trackMetadata = tracks.map(({ audioUrl, ...rest }) => rest);

  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    playlists,
    favorites,
    trackMetadata,
    settings,
    eqSettings,
  };
}

// Import Backup
export async function restoreBackupPayload(
  payload: BackupPayload
): Promise<{ restoredPlaylists: number; restoredTracks: number }> {
  const db = await getDB();

  let restoredTracks = 0;
  if (payload.trackMetadata && Array.isArray(payload.trackMetadata)) {
    const tx = db.transaction('tracks', 'readwrite');
    for (const meta of payload.trackMetadata) {
      const existing = await tx.store.get(meta.id);
      if (!existing) {
        await tx.store.put({
          ...meta,
          addedAt: meta.addedAt || Date.now(),
          playCount: meta.playCount || 0,
        });
        restoredTracks++;
      }
    }
    await tx.done;
  }

  let restoredPlaylists = 0;
  if (payload.playlists && Array.isArray(payload.playlists)) {
    const tx = db.transaction('playlists', 'readwrite');
    for (const pl of payload.playlists) {
      await tx.store.put(pl);
      restoredPlaylists++;
    }
    await tx.done;
  }

  if (payload.favorites && Array.isArray(payload.favorites)) {
    const existingFavs = await getKV<string[]>('favorites', []);
    const mergedFavs = Array.from(new Set([...existingFavs, ...payload.favorites]));
    await setKV('favorites', mergedFavs);
  }

  if (payload.settings) {
    await setKV('playerSettings', payload.settings);
  }

  if (payload.eqSettings) {
    await setKV('eqSettings', payload.eqSettings);
  }

  return { restoredPlaylists, restoredTracks };
}
