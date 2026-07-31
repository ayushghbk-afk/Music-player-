import React, { useState } from 'react';
import {
  Play,
  Pause,
  Star,
  MoreVertical,
  Sparkles,
  Search,
  Filter,
  ArrowUpDown,
  Edit2,
  Trash2,
  Plus,
  Music,
  Disc,
  Clock
} from 'lucide-react';
import { Track, AudioFormat } from '../types';

interface SongListProps {
  tracks: Track[];
  currentTrackId?: string;
  isPlaying: boolean;
  favorites: string[];
  hiResOnlyFilter?: boolean;
  onPlayTrack: (track: Track) => void;
  onToggleFavorite: (trackId: string) => void;
  onEditTrackTags: (track: Track) => void;
  onDeleteTrack: (trackId: string) => void;
  onAddToPlaylist: (trackId: string) => void;
}

export const SongList: React.FC<SongListProps> = ({
  tracks,
  currentTrackId,
  isPlaying,
  favorites,
  hiResOnlyFilter = false,
  onPlayTrack,
  onToggleFavorite,
  onEditTrackTags,
  onDeleteTrack,
  onAddToPlaylist,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'added' | 'title' | 'artist' | 'duration' | 'bitrate'>('added');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeMenuTrackId, setActiveMenuTrackId] = useState<string | null>(null);

  // Filter logic
  const filteredTracks = tracks.filter((t) => {
    if (hiResOnlyFilter && !t.isHiRes) return false;
    if (selectedFormat !== 'all' && t.format !== selectedFormat) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchArtist = t.artist.toLowerCase().includes(q);
      const matchAlbum = t.album.toLowerCase().includes(q);
      return matchTitle || matchArtist || matchAlbum;
    }
    return true;
  });

  // Sort logic
  const sortedTracks = [...filteredTracks].sort((a, b) => {
    let result = 0;
    if (sortBy === 'title') result = a.title.localeCompare(b.title);
    else if (sortBy === 'artist') result = a.artist.localeCompare(b.artist);
    else if (sortBy === 'duration') result = a.duration - b.duration;
    else if (sortBy === 'bitrate') result = (b.isHiRes ? 1 : 0) - (a.isHiRes ? 1 : 0);
    else result = a.addedAt - b.addedAt;

    return sortOrder === 'asc' ? result : -result;
  });

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-4">
      {/* Top Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/60 p-3 rounded-2xl border border-white/5">
        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tracks, artists, albums..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        {/* Format & Sort Selectors */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-xl border border-white/10 text-xs">
            <Filter className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="bg-transparent text-zinc-300 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-zinc-900 text-white">All Formats</option>
              <option value="FLAC" className="bg-zinc-900 text-white">FLAC Lossless</option>
              <option value="WAV" className="bg-zinc-900 text-white">WAV Uncompressed</option>
              <option value="DSD" className="bg-zinc-900 text-white">DSD Master</option>
              <option value="ALAC" className="bg-zinc-900 text-white">ALAC Lossless</option>
              <option value="MP3" className="bg-zinc-900 text-white">MP3</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-xl border border-white/10 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-zinc-300 font-medium focus:outline-none cursor-pointer"
            >
              <option value="added" className="bg-zinc-900 text-white">Date Added</option>
              <option value="title" className="bg-zinc-900 text-white">Title</option>
              <option value="artist" className="bg-zinc-900 text-white">Artist</option>
              <option value="bitrate" className="bg-zinc-900 text-white">Audio Quality</option>
              <option value="duration" className="bg-zinc-900 text-white">Duration</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="text-zinc-400 hover:text-white px-1 text-[10px] font-mono font-bold"
            >
              {sortOrder.toUpperCase()}
            </button>
          </div>
        </div>
      </div>

      {/* Song List Content */}
      <div className="bg-zinc-900/40 rounded-2xl border border-white/5 overflow-hidden">
        {sortedTracks.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Music className="w-10 h-10 text-zinc-600 mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-300">No tracks match your criteria</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Import local audio files or adjust your search filter to display songs in your offline vault.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Touch-Optimized Cards List (sm:hidden) */}
            <div className="sm:hidden divide-y divide-white/5">
              {sortedTracks.map((track, index) => {
                const isCurrent = track.id === currentTrackId;
                const isFav = favorites.includes(track.id);

                return (
                  <div
                    key={track.id}
                    onClick={() => onPlayTrack(track)}
                    className={`p-3 flex items-center justify-between gap-3 active:bg-white/10 transition-colors cursor-pointer ${
                      isCurrent ? 'bg-indigo-500/15 border-l-2 border-indigo-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Thumbnail & Play Overlay */}
                      <div
                        className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden shadow-md relative border border-white/10 flex items-center justify-center"
                        style={{
                          background: track.coverArt?.startsWith('linear')
                            ? track.coverArt
                            : '#27272a',
                        }}
                      >
                        {track.coverArt && track.coverArt.startsWith('http') ? (
                          <img
                            src={track.coverArt}
                            alt={track.title}
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                        <div
                          className={`absolute inset-0 flex items-center justify-center ${
                            isCurrent ? 'bg-black/40' : 'bg-black/20'
                          }`}
                        >
                          {isCurrent && isPlaying ? (
                            <Pause className="w-5 h-5 text-indigo-400 fill-current" />
                          ) : isCurrent ? (
                            <Play className="w-5 h-5 text-indigo-400 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 text-white/80 fill-current" />
                          )}
                        </div>
                      </div>

                      {/* Track Details */}
                      <div className="min-w-0 flex-1">
                        <h4 className={`text-xs font-bold truncate ${isCurrent ? 'text-indigo-400' : 'text-white'}`}>
                          {track.title}
                        </h4>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">{track.artist}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-zinc-300 font-semibold">
                            {track.format}
                          </span>
                          {track.isHiRes && (
                            <span className="font-mono text-[9px] font-bold px-1.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                              <Sparkles className="w-2 h-2" />
                              HI-RES
                            </span>
                          )}
                          <span className="font-mono text-[10px] text-zinc-400 ml-auto pr-1">
                            {formatDuration(track.duration)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0 relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(track.id);
                        }}
                        className={`p-2 rounded-lg ${isFav ? 'text-amber-400' : 'text-zinc-500'}`}
                      >
                        <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuTrackId(activeMenuTrackId === track.id ? null : track.id);
                        }}
                        className="p-2 rounded-lg text-zinc-400 active:text-white"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Mobile Dropdown Menu */}
                      {activeMenuTrackId === track.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-10 w-48 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-1.5 z-50 text-left space-y-1 animate-fadeIn"
                        >
                          <button
                            onClick={() => {
                              onAddToPlaylist(track.id);
                              setActiveMenuTrackId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 active:bg-white/10 rounded-xl"
                          >
                            <Plus className="w-4 h-4" />
                            Add to Playlist
                          </button>
                          <button
                            onClick={() => {
                              onEditTrackTags(track);
                              setActiveMenuTrackId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 active:bg-white/10 rounded-xl"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit Track Info
                          </button>
                          <button
                            onClick={() => {
                              onDeleteTrack(track.id);
                              setActiveMenuTrackId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 active:bg-rose-500/20 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete Track
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (hidden on mobile) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse select-none">
                <thead>
                  <tr className="border-b border-white/5 text-[11px] font-mono text-zinc-500 uppercase">
                    <th className="py-3 px-2 sm:px-4 w-10 sm:w-12 text-center">#</th>
                    <th className="py-3 px-2 sm:px-4">Title & Artist</th>
                    <th className="py-3 px-4 hidden md:table-cell">Album</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Quality & Format</th>
                    <th className="py-3 px-2 sm:px-4 text-right">Duration</th>
                    <th className="py-3 px-2 sm:px-4 w-10 sm:w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {sortedTracks.map((track, index) => {
                    const isCurrent = track.id === currentTrackId;
                    const isFav = favorites.includes(track.id);

                    return (
                      <tr
                        key={track.id}
                        onClick={() => onPlayTrack(track)}
                        className={`group hover:bg-white/5 cursor-pointer transition-colors ${
                          isCurrent ? 'bg-indigo-500/10' : ''
                        }`}
                      >
                        {/* # / Play Button */}
                        <td className="py-2.5 px-2 sm:px-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPlayTrack(track);
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
                          >
                            {isCurrent && isPlaying ? (
                              <Pause className="w-4 h-4 text-indigo-400 fill-current" />
                            ) : isCurrent ? (
                              <Play className="w-4 h-4 text-indigo-400 fill-current" />
                            ) : (
                              <span className="text-zinc-500 group-hover:hidden font-mono text-xs">
                                {index + 1}
                              </span>
                            )}
                            {!isCurrent && (
                              <Play className="w-3.5 h-3.5 text-white hidden group-hover:block fill-current" />
                            )}
                          </button>
                        </td>

                        {/* Title & Artist */}
                        <td className="py-2.5 px-2 sm:px-4">
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden shadow-sm border border-white/5"
                              style={{
                                background: track.coverArt?.startsWith('linear')
                                  ? track.coverArt
                                  : '#27272a',
                              }}
                            >
                              {track.coverArt && track.coverArt.startsWith('http') ? (
                                <img
                                  src={track.coverArt}
                                  alt={track.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`font-semibold truncate ${
                                    isCurrent ? 'text-indigo-400' : 'text-white'
                                  }`}
                                >
                                  {track.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>
                                {/* Mobile inline format tag */}
                                <span className="sm:hidden font-mono text-[9px] px-1 rounded bg-white/5 text-zinc-400">
                                  {track.format}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Album */}
                        <td className="py-3 px-4 hidden md:table-cell text-zinc-400 truncate max-w-[180px]">
                          {track.album}
                        </td>

                        {/* Quality & Format */}
                        <td className="py-3 px-4 hidden sm:table-cell">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                              {track.format}
                            </span>
                            {track.isHiRes && (
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" />
                                HI-RES
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Duration */}
                        <td className="py-3 px-4 text-right font-mono text-zinc-400">
                          {formatDuration(track.duration)}
                        </td>

                        {/* Actions Menu */}
                        <td className="py-3 px-4 text-center relative">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite(track.id);
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isFav ? 'text-amber-400' : 'text-zinc-600 hover:text-zinc-300'
                              }`}
                            >
                              <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuTrackId(
                                  activeMenuTrackId === track.id ? null : track.id
                                );
                              }}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Dropdown Menu */}
                          {activeMenuTrackId === track.id && (
                            <div className="absolute right-4 top-10 w-44 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-1 z-40 text-left space-y-0.5 animate-fadeIn">
                              <button
                                onClick={() => {
                                  onAddToPlaylist(track.id);
                                  setActiveMenuTrackId(null);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add to Playlist
                              </button>
                              <button
                                onClick={() => {
                                  onEditTrackTags(track);
                                  setActiveMenuTrackId(null);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                Edit Track Info
                              </button>
                              <button
                                onClick={() => {
                                  onDeleteTrack(track.id);
                                  setActiveMenuTrackId(null);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete Track
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
