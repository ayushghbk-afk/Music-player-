import React, { useState } from 'react';
import {
  ListMusic,
  Plus,
  Play,
  Shuffle,
  Trash2,
  Sparkles,
  Music,
  ChevronRight,
  Edit2,
  ChevronUp,
  ChevronDown,
  X,
  Search,
  Check,
  RotateCcw,
  Clock,
  Layers
} from 'lucide-react';
import { Playlist, Track } from '../types';

interface PlaylistsViewProps {
  playlists: Playlist[];
  tracks: Track[];
  onCreatePlaylist: (name: string, description: string) => void;
  onUpdatePlaylist?: (playlist: Playlist) => void;
  onDeletePlaylist: (id: string) => void;
  onPlayPlaylist: (trackIds: string[], startTrackId?: string) => void;
  onPlayTrack: (track: Track) => void;
}

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({
  playlists,
  tracks,
  onCreatePlaylist,
  onUpdatePlaylist,
  onDeletePlaylist,
  onPlayPlaylist,
  onPlayTrack,
}) => {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddSongsModal, setShowAddSongsModal] = useState(false);

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');

  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [playlistSearch, setPlaylistSearch] = useState('');
  const [addSongSearch, setAddSongSearch] = useState('');

  // Track lookup map
  const trackMap = new Map(tracks.map((t) => [t.id, t]));

  // Selected playlist
  const currentPlaylist = playlists.find((p) => p.id === selectedPlaylistId);
  const currentPlaylistTracks = currentPlaylist
    ? currentPlaylist.trackIds.map((id) => trackMap.get(id)).filter(Boolean) as Track[]
    : [];

  // Filtered tracks in playlist detail view
  const filteredPlaylistTracks = currentPlaylistTracks.filter((t) => {
    if (!playlistSearch) return true;
    const q = playlistSearch.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
  });

  // Calculate total duration
  const totalDurationSecs = currentPlaylistTracks.reduce((acc, t) => acc + t.duration, 0);
  const totalDurationMin = Math.floor(totalDurationSecs / 60);
  const totalDurationHr = Math.floor(totalDurationMin / 60);
  const remainingMin = totalDurationMin % 60;
  const formattedTotalDuration =
    totalDurationHr > 0
      ? `${totalDurationHr} hr ${remainingMin} min`
      : `${totalDurationMin} min`;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlaylistName.trim()) {
      onCreatePlaylist(newPlaylistName.trim(), newPlaylistDesc.trim());
      setNewPlaylistName('');
      setNewPlaylistDesc('');
      setShowCreateModal(false);
    }
  };

  const handleOpenEdit = () => {
    if (!currentPlaylist) return;
    setEditName(currentPlaylist.name);
    setEditDesc(currentPlaylist.description || '');
    setShowEditModal(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPlaylist && editName.trim() && onUpdatePlaylist) {
      const updated: Playlist = {
        ...currentPlaylist,
        name: editName.trim(),
        description: editDesc.trim(),
        updatedAt: Date.now(),
      };
      onUpdatePlaylist(updated);
      setShowEditModal(false);
    }
  };

  // Move track up or down
  const handleMoveTrack = (index: number, direction: 'up' | 'down') => {
    if (!currentPlaylist || !onUpdatePlaylist) return;
    const newTrackIds = [...currentPlaylist.trackIds];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newTrackIds.length) return;

    const temp = newTrackIds[index];
    newTrackIds[index] = newTrackIds[targetIndex];
    newTrackIds[targetIndex] = temp;

    onUpdatePlaylist({
      ...currentPlaylist,
      trackIds: newTrackIds,
      updatedAt: Date.now(),
    });
  };

  // Remove track from playlist
  const handleRemoveTrack = (trackId: string) => {
    if (!currentPlaylist || !onUpdatePlaylist) return;
    const newTrackIds = currentPlaylist.trackIds.filter((id) => id !== trackId);
    onUpdatePlaylist({
      ...currentPlaylist,
      trackIds: newTrackIds,
      updatedAt: Date.now(),
    });
  };

  // Clear all tracks
  const handleClearPlaylist = () => {
    if (!currentPlaylist || !onUpdatePlaylist) return;
    if (confirm('Are you sure you want to remove all tracks from this playlist?')) {
      onUpdatePlaylist({
        ...currentPlaylist,
        trackIds: [],
        updatedAt: Date.now(),
      });
    }
  };

  // Toggle track inclusion from Add Songs Modal
  const handleToggleSongInPlaylist = (trackId: string) => {
    if (!currentPlaylist || !onUpdatePlaylist) return;
    const exists = currentPlaylist.trackIds.includes(trackId);
    let newTrackIds: string[];
    if (exists) {
      newTrackIds = currentPlaylist.trackIds.filter((id) => id !== trackId);
    } else {
      newTrackIds = [...currentPlaylist.trackIds, trackId];
    }
    onUpdatePlaylist({
      ...currentPlaylist,
      trackIds: newTrackIds,
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <ListMusic className="w-6 h-6 text-sky-400" />
            <span>Playlists & Curations</span>
          </h2>
          <p className="text-xs text-zinc-400">Custom audiophile playlists stored in local vault</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Playlist</span>
        </button>
      </div>

      {selectedPlaylistId && currentPlaylist ? (
        /* Playlist Detail View */
        <div className="space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedPlaylistId(null)}
              className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-mono font-semibold"
            >
              ← Back to all playlists
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenEdit}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium flex items-center gap-1.5 border border-white/5 transition-all"
              >
                <Edit2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Edit Info</span>
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete playlist "${currentPlaylist.name}"?`)) {
                    onDeletePlaylist(currentPlaylist.id);
                    setSelectedPlaylistId(null);
                  }
                }}
                className="p-1.5 rounded-xl text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors"
                title="Delete Playlist"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Banner Card */}
          <div className="bg-zinc-900/80 p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
                  <ListMusic className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    {currentPlaylist.name}
                  </h3>
                  <p className="text-xs text-zinc-300">
                    {currentPlaylist.description || 'Custom audio curation'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono text-zinc-400">
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-sky-300 font-semibold">
                      {currentPlaylistTracks.length} tracks
                    </span>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      {formattedTotalDuration}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {currentPlaylistTracks.filter((t) => t.isHiRes).length} Hi-Res
                    </span>
                  </div>
                </div>
              </div>

              {/* Top Playlist Play Controls */}
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => onPlayPlaylist(currentPlaylist.trackIds)}
                  disabled={currentPlaylistTracks.length === 0}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-40 text-black font-semibold text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Play All
                </button>
                <button
                  onClick={() => {
                    const shuffled = [...currentPlaylist.trackIds].sort(() => Math.random() - 0.5);
                    onPlayPlaylist(shuffled);
                  }}
                  disabled={currentPlaylistTracks.length === 0}
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white text-xs font-medium flex items-center gap-2 border border-white/10 transition-all active:scale-95"
                >
                  <Shuffle className="w-4 h-4 text-sky-400" />
                  <span>Shuffle</span>
                </button>
                <button
                  onClick={() => setShowAddSongsModal(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 font-medium text-xs flex items-center gap-2 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Songs</span>
                </button>
              </div>
            </div>

            {/* In-Playlist Search & Action Toolbar */}
            {currentPlaylistTracks.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/5">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter tracks in playlist..."
                    value={playlistSearch}
                    onChange={(e) => setPlaylistSearch(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto text-[11px] text-zinc-400 font-mono">
                  <button
                    onClick={handleClearPlaylist}
                    className="text-rose-400 hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Clear Playlist
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Playlist Track Table / List */}
          <div className="bg-zinc-900/40 rounded-2xl border border-white/5 p-2 space-y-1">
            {currentPlaylistTracks.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <Music className="w-10 h-10 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400 font-medium">This playlist is currently empty.</p>
                <button
                  onClick={() => setShowAddSongsModal(true)}
                  className="px-4 py-2 rounded-xl bg-sky-500 text-white font-medium text-xs shadow-md inline-flex items-center gap-2 hover:bg-sky-400"
                >
                  <Plus className="w-4 h-4" />
                  <span>Browse & Add Songs from Library</span>
                </button>
              </div>
            ) : filteredPlaylistTracks.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                No tracks matching "{playlistSearch}"
              </div>
            ) : (
              filteredPlaylistTracks.map((track, idx) => {
                const originalIndex = currentPlaylist.trackIds.indexOf(track.id);

                return (
                  <div
                    key={track.id}
                    className="flex items-center justify-between p-2.5 sm:p-3 hover:bg-white/5 rounded-xl transition-colors group"
                  >
                    <div
                      onClick={() => onPlayTrack(track)}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    >
                      <span className="text-xs font-mono text-zinc-500 w-6 text-center flex-shrink-0">
                        {originalIndex + 1}
                      </span>

                      {/* Thumbnail */}
                      <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 flex-shrink-0 overflow-hidden border border-white/10">
                        {track.coverArt && track.coverArt.startsWith('http') ? (
                          <img src={track.coverArt} alt={track.title} className="w-full h-full object-cover" />
                        ) : (
                          <Music className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-semibold text-white group-hover:text-sky-400 transition-colors truncate">
                          {track.title}
                        </h4>
                        <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hidden sm:inline-block">
                        {track.format}
                      </span>

                      {/* Reorder Controls */}
                      <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/5">
                        <button
                          onClick={() => handleMoveTrack(originalIndex, 'up')}
                          disabled={originalIndex === 0}
                          className="p-1 text-zinc-400 hover:text-white disabled:opacity-20 transition-colors"
                          title="Move Up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveTrack(originalIndex, 'down')}
                          disabled={originalIndex === currentPlaylist.trackIds.length - 1}
                          className="p-1 text-zinc-400 hover:text-white disabled:opacity-20 transition-colors"
                          title="Move Down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Remove Track Button */}
                      <button
                        onClick={() => handleRemoveTrack(track.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Remove from playlist"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Playlist Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              onClick={() => setSelectedPlaylistId(pl.id)}
              className="bg-zinc-900/60 p-4 rounded-2xl border border-white/5 hover:border-sky-500/30 cursor-pointer transition-all duration-200 group flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
                  <ListMusic className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-white group-hover:text-sky-400 transition-colors truncate">
                    {pl.name}
                  </h3>
                  <p className="text-[11px] text-zinc-400 truncate max-w-[160px]">
                    {pl.description || 'Custom playlist'}
                  </p>
                  <span className="text-[10px] font-mono text-zinc-500">{pl.trackIds.length} tracks</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Add Songs Picker Modal */}
      {showAddSongsModal && currentPlaylist && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-5 w-full max-w-lg space-y-4 shadow-2xl animate-fadeIn max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Add Songs to "{currentPlaylist.name}"</h3>
                <p className="text-[11px] text-zinc-400">Select tracks from your audio vault</p>
              </div>
              <button
                onClick={() => setShowAddSongsModal(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tracks in library..."
                value={addSongSearch}
                onChange={(e) => setAddSongSearch(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Song Picker List */}
            <div className="flex-1 overflow-y-auto space-y-1 divide-y divide-white/5 pr-1 min-h-[220px]">
              {tracks
                .filter((t) => {
                  if (!addSongSearch) return true;
                  const q = addSongSearch.toLowerCase();
                  return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
                })
                .map((track) => {
                  const isInPlaylist = currentPlaylist.trackIds.includes(track.id);

                  return (
                    <div
                      key={track.id}
                      onClick={() => handleToggleSongInPlaylist(track.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                        isInPlaylist ? 'bg-sky-500/15 border border-sky-500/30' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                            isInPlaylist
                              ? 'bg-sky-500 border-sky-400 text-white'
                              : 'border-white/20 bg-zinc-800'
                          }`}
                        >
                          {isInPlaylist && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate">{track.title}</p>
                          <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 px-2 py-0.5 rounded bg-zinc-800 ml-2">
                        {track.format}
                      </span>
                    </div>
                  );
                })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
              <span className="text-zinc-400 font-mono text-[11px]">
                {currentPlaylist.trackIds.length} tracks selected
              </span>
              <button
                onClick={() => setShowAddSongsModal(false)}
                className="px-4 py-2 rounded-xl bg-sky-500 text-white font-medium shadow-md hover:bg-sky-400"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSubmit}
            className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-fadeIn"
          >
            <h3 className="text-base font-bold text-white">Create New Playlist</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Playlist Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Audiophile Midnight Session"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Description</label>
                <textarea
                  placeholder="Optional notes or mood description..."
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 h-20 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs shadow-md"
              >
                Create Playlist
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Playlist Modal */}
      {showEditModal && currentPlaylist && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleEditSubmit}
            className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-fadeIn"
          >
            <h3 className="text-base font-bold text-white">Edit Playlist Details</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Playlist Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Description</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 h-20 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs shadow-md"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

