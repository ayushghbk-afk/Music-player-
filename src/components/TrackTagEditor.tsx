import React, { useState } from 'react';
import { Edit2, Sparkles, X, Save } from 'lucide-react';
import { Track, AudioFormat } from '../types';

interface TrackTagEditorProps {
  track: Track | null;
  isOpen: boolean;
  onSaveTrack: (updatedTrack: Track) => void;
  onClose: () => void;
}

export const TrackTagEditor: React.FC<TrackTagEditorProps> = ({
  track,
  isOpen,
  onSaveTrack,
  onClose,
}) => {
  if (!isOpen || !track) return null;

  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [album, setAlbum] = useState(track.album);
  const [year, setYear] = useState(track.year || new Date().getFullYear());
  const [genre, setGenre] = useState(track.genre || 'Audiophile');
  const [format, setFormat] = useState<AudioFormat>(track.format);
  const [bitrate, setBitrate] = useState(track.bitrate);
  const [isHiRes, setIsHiRes] = useState(track.isHiRes);
  const [lyrics, setLyrics] = useState(track.lyrics || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveTrack({
      ...track,
      title,
      artist,
      album,
      year: Number(year),
      genre,
      format,
      bitrate,
      isHiRes,
      lyrics,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <form
        onSubmit={handleSubmit}
        className="bg-zinc-950 border border-white/10 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl animate-fadeIn"
      >
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2.5">
            <Edit2 className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white">Edit Track Metadata & Tags</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="col-span-2">
            <label className="text-zinc-400 block mb-1">Track Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Artist</label>
            <input
              type="text"
              required
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Album</label>
            <input
              type="text"
              required
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Format Codec</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as AudioFormat)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
            >
              <option value="FLAC">FLAC Lossless</option>
              <option value="WAV">WAV Master</option>
              <option value="DSD">DSD Audio</option>
              <option value="ALAC">ALAC Lossless</option>
              <option value="MP3">MP3</option>
              <option value="AAC">AAC</option>
            </select>
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Quality Spec</label>
            <input
              type="text"
              value={bitrate}
              onChange={(e) => setBitrate(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">Genre</label>
            <input
              type="text"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="col-span-2 flex items-center gap-2 bg-black/40 p-3 rounded-xl border border-white/5">
            <input
              type="checkbox"
              id="hires-check"
              checked={isHiRes}
              onChange={(e) => setIsHiRes(e.target.checked)}
              className="accent-amber-400 w-4 h-4 rounded"
            />
            <label htmlFor="hires-check" className="text-xs text-amber-300 font-bold flex items-center gap-1 cursor-pointer">
              <Sparkles className="w-3.5 h-3.5" />
              Mark as 24-Bit Studio Master / Hi-Res Lossless
            </label>
          </div>

          <div className="col-span-2">
            <label className="text-zinc-400 block mb-1">Lyrics & Annotations</label>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Paste synced or standard track lyrics..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500 h-24 font-mono text-xs resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs flex items-center gap-1.5 shadow-md"
          >
            <Save className="w-3.5 h-3.5" />
            Save Metadata
          </button>
        </div>
      </form>
    </div>
  );
};
