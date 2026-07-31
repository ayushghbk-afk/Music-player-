import React from 'react';
import { Disc, Play, Music, Sparkles } from 'lucide-react';
import { Track } from '../types';

interface AlbumsViewProps {
  tracks: Track[];
  onPlayTrack: (track: Track) => void;
}

interface AlbumGroup {
  name: string;
  artist: string;
  coverArt?: string;
  isHiRes: boolean;
  tracks: Track[];
}

export const AlbumsView: React.FC<AlbumsViewProps> = ({ tracks, onPlayTrack }) => {
  // Group tracks by Album
  const albumsMap = tracks.reduce((acc, track) => {
    const albumName = track.album || 'Unknown Album';
    if (!acc[albumName]) {
      acc[albumName] = {
        name: albumName,
        artist: track.artist,
        coverArt: track.coverArt,
        isHiRes: track.isHiRes,
        tracks: [],
      };
    }
    acc[albumName].tracks.push(track);
    return acc;
  }, {} as Record<string, AlbumGroup>);

  const albumsList: AlbumGroup[] = Object.values(albumsMap);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white tracking-wide">Albums & Collections</h2>
        <p className="text-xs text-zinc-400">Organized audiophile master albums in your local vault</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {albumsList.map((album) => {
          const totalDuration = album.tracks.reduce((sum, t) => sum + t.duration, 0);
          const mins = Math.round(totalDuration / 60);

          return (
            <div
              key={album.name}
              className="bg-zinc-900/60 border border-white/5 p-3 rounded-2xl group hover:border-sky-500/30 transition-all duration-300 hover:scale-[1.02]"
            >
              {/* Cover Art Card */}
              <div
                className="w-full aspect-square rounded-xl overflow-hidden shadow-lg relative mb-3 border border-white/5"
                style={{
                  background: album.coverArt?.startsWith('linear')
                    ? album.coverArt
                    : '#27272a',
                }}
              >
                {album.coverArt && album.coverArt.startsWith('http') ? (
                  <img
                    src={album.coverArt}
                    alt={album.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : null}

                {/* Overlay Play Button */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                  <button
                    onClick={() => onPlayTrack(album.tracks[0])}
                    className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-transform"
                    title="Play Album"
                  >
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                  </button>
                </div>

                {album.isHiRes && (
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-amber-500/40 text-amber-300 text-[9px] font-mono font-bold flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    HI-RES
                  </div>
                )}
              </div>

              {/* Album Info */}
              <h3 className="text-xs font-semibold text-white truncate">{album.name}</h3>
              <p className="text-[11px] text-zinc-400 truncate">{album.artist}</p>
              <div className="flex items-center gap-2 mt-2 text-[10px] font-mono text-zinc-500">
                <span>{album.tracks.length} tracks</span>
                <span>•</span>
                <span>{mins} mins</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
