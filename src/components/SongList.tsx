import React, { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Heart,
  MoreHorizontal,
  Search,
  ArrowDownWideNarrow,
  Clock3,
  Check,
  Pencil,
  Trash2,
  ListPlus,
  X,
  Music2,
} from "lucide-react";
import { Track } from "../types";
import { Artwork, displayTitle, timeLabel } from "./Artwork";
interface SongListProps {
  tracks: Track[];
  currentTrackId?: string;
  isPlaying: boolean;
  favorites: string[];
  hiResOnlyFilter?: boolean;
  onPlayTrack: (track: Track) => void;
  onToggleFavorite: (id: string) => void;
  onEditTrackTags: (track: Track) => void;
  onDeleteTrack: (id: string) => void;
  onAddToPlaylist: (id: string) => void;
}
export function SongList(p: SongListProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("added");
  const [menu, setMenu] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest(".track-menu-wrap")) setMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const filtered = p.tracks
    .filter(
      (t) =>
        (!p.hiResOnlyFilter || t.isHiRes) &&
        (filter !== "favorites" || p.favorites.includes(t.id)) &&
        (filter === "all" || filter === "favorites" || t.format === filter) &&
        `${t.title} ${t.artist} ${t.album}`
          .toLowerCase()
          .includes(search.toLowerCase().trim()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "artist"
          ? a.artist.localeCompare(b.artist)
          : sort === "duration"
            ? b.duration - a.duration
            : b.addedAt - a.addedAt,
    );
  return (
    <div className="library-table" ref={root}>
      <div className="library-toolbar">
        <div className="library-tabs">
          <button
            className={filter !== "favorites" ? "selected" : ""}
            onClick={() => setFilter("all")}
          >
            All tracks <span>{p.tracks.length}</span>
          </button>
          <button
            className={filter === "favorites" ? "selected" : ""}
            onClick={() => setFilter("favorites")}
          >
            <Heart size={13} /> Favorites <span>{p.favorites.length}</span>
          </button>
        </div>
        <div className="table-tools">
          <label className="library-search">
            <Search size={15} />
            <input
              aria-label="Search library"
              placeholder="Search your library"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button aria-label="Clear search" onClick={() => setSearch("")}>
                <X size={13} />
              </button>
            )}
          </label>
          <label className="sort-control">
            <ArrowDownWideNarrow size={16} />
            <select
              aria-label="Sort tracks"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="added">Recently added</option>
              <option value="title">Title</option>
              <option value="artist">Artist</option>
              <option value="duration">Duration</option>
            </select>
          </label>
          <select
            className="format-filter"
            aria-label="Filter audio format"
            value={filter === "favorites" ? "all" : filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All formats</option>
            {["WAV", "FLAC", "ALAC", "MP3", "AAC", "OGG", "DSD"].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="track-table-head">
        <span>#</span>
        <span>TITLE / ARTIST</span>
        <span>ALBUM</span>
        <span>QUALITY</span>
        <Clock3 size={13} />
        <span />
      </div>
      {!filtered.length && (
        <div className="empty-library">
          <Music2 size={30} />
          <h3>
            {search
              ? "No matches. Keep exploring."
              : filter === "favorites"
                ? "Your favorites start here."
                : "Make room for your music."}
          </h3>
          <p>
            {search
              ? "Try another title, album, or artist."
              : "Import your tracks or tap a heart to build your collection."}
          </p>
        </div>
      )}
      {filtered.map((track, index) => {
        const current = track.id === p.currentTrackId;
        const favorite = p.favorites.includes(track.id);
        return (
          <div
            className={`track-row ${current ? "current" : ""}`}
            key={track.id}
          >
            <button
              className="track-number"
              aria-label={`Play ${track.title}`}
              onClick={() => p.onPlayTrack(track)}
            >
              {current && p.isPlaying ? (
                <span className="playing-bars">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Play size={14} className="row-play" fill="currentColor" />
                </>
              )}
            </button>
            <button
              className="track-title"
              onClick={() => p.onPlayTrack(track)}
            >
              <div className="track-thumb">
                <Artwork track={track} />
                {current && p.isPlaying && <Pause size={15} />}
              </div>
              <div>
                <strong>{displayTitle(track)}</strong>
                <small>{track.artist}</small>
              </div>
            </button>
            <span className="track-album">{track.album}</span>
            <div className="track-quality">
              <span
                className={
                  track.isHiRes ? "quality-pill" : "quality-pill standard"
                }
              >
                {track.isHiRes && <AudioMark />}
                {track.format}
              </span>
              <small>
                {track.bitDepth ? `${track.bitDepth}-bit` : ""}
                {track.sampleRate ? ` / ${track.sampleRate / 1000} kHz` : ""}
              </small>
            </div>
            <span className="track-duration">{timeLabel(track.duration)}</span>
            <div className="track-actions">
              <button
                aria-label={`${favorite ? "Unfavorite" : "Favorite"} ${track.title}`}
                className={`icon-button favorite-button ${favorite ? "is-favorite" : ""}`}
                onClick={() => p.onToggleFavorite(track.id)}
              >
                <Heart size={15} fill={favorite ? "currentColor" : "none"} />
              </button>
              <div className="track-menu-wrap">
                <button
                  className="icon-button"
                  aria-label={`Options for ${track.title}`}
                  aria-expanded={menu === track.id}
                  onClick={() => setMenu(menu === track.id ? null : track.id)}
                >
                  <MoreHorizontal size={18} />
                </button>
                {menu === track.id && (
                  <div className="track-menu">
                    <button
                      onClick={() => {
                        p.onAddToPlaylist(track.id);
                        setMenu(null);
                      }}
                    >
                      <ListPlus size={15} /> Add to playlist
                    </button>
                    <button
                      onClick={() => {
                        p.onEditTrackTags(track);
                        setMenu(null);
                      }}
                    >
                      <Pencil size={15} /> Edit track details
                    </button>
                    <button
                      onClick={() => {
                        p.onToggleFavorite(track.id);
                        setMenu(null);
                      }}
                    >
                      <Check size={15} />{" "}
                      {favorite ? "Remove favorite" : "Save to favorites"}
                    </button>
                    <button
                      className="danger"
                      onClick={() => {
                        if (
                          confirm(`Remove “${track.title}” from your library?`)
                        )
                          p.onDeleteTrack(track.id);
                        setMenu(null);
                      }}
                    >
                      <Trash2 size={15} /> Remove track
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div className="table-footer">
        <span>
          {filtered.length} tracks ·{" "}
          {timeLabel(filtered.reduce((n, t) => n + t.duration, 0))} total
        </span>
        <span>
          <i /> Available offline
        </span>
      </div>
    </div>
  );
}
function AudioMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1 4v2m2-4v6m2-8v10m2-8v6m2-4v2" stroke="currentColor" />
    </svg>
  );
}
