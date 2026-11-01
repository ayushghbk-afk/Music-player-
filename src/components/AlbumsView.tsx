import React, { useMemo, useState } from "react";
import { Play, Search, ArrowLeft, Disc3, ArrowUpRight } from "lucide-react";
import { Track } from "../types";
import { Artwork, displayTitle, timeLabel } from "./Artwork";
export function AlbumsView({
  tracks,
  onPlayTrack,
}: {
  tracks: Track[];
  onPlayTrack: (track: Track) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<"album" | "artist">("album");
  const groups = useMemo(() => {
    const map = new Map<string, Track[]>();
    tracks.forEach((t) => {
      const key = groupBy === "artist" ? t.artist : t.album;
      map.set(key, [...(map.get(key) || []), t]);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tracks, groupBy]);
  const collection = groups.find(([key]) => key === selected);
  return (
    <section className="collection-page">
      <div className="page-intro">
        <div>
          <div className="eyebrow">THE COLLECTION, RECONSIDERED</div>
          <h1>
            {groupBy === "album"
              ? "An album is a whole world."
              : "The people behind the sound."}
          </h1>
          <p>Take your time. There’s a story in every record.</p>
        </div>
        <Disc3 size={25} className="page-symbol" />
      </div>
      {collection ? (
        <>
          <button className="text-back" onClick={() => setSelected(null)}>
            <ArrowLeft size={14} /> Back to {groupBy}s
          </button>
          <div className="album-detail-hero">
            <Artwork track={collection[1][0]} />
            <div>
              <div className="eyebrow">
                YOUR {groupBy.toUpperCase()} COLLECTION
              </div>
              <h2>{collection[0]}</h2>
              <p>
                {collection[1][0].artist} · {collection[1].length} tracks ·{" "}
                {timeLabel(collection[1].reduce((n, t) => n + t.duration, 0))}
              </p>
              <button
                className="button-primary"
                onClick={() => onPlayTrack(collection[1][0])}
              >
                <Play size={13} fill="currentColor" /> Play first track
              </button>
            </div>
          </div>
          <div className="album-detail-tracks">
            {collection[1].map((track, i) => (
              <button key={track.id} onClick={() => onPlayTrack(track)}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <Artwork track={track} />
                <div>
                  <strong>{displayTitle(track)}</strong>
                  <small>{track.artist}</small>
                </div>
                <span className="quality-pill">{track.format}</span>
                <span>{timeLabel(track.duration)}</span>
                <Play size={14} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="collection-toolbar">
            <div className="segmented-control">
              <button
                className={groupBy === "album" ? "selected" : ""}
                onClick={() => setGroupBy("album")}
              >
                Albums
              </button>
              <button
                className={groupBy === "artist" ? "selected" : ""}
                onClick={() => setGroupBy("artist")}
              >
                Artists
              </button>
            </div>
            <label className="library-search">
              <Search size={15} />
              <input
                aria-label="Search albums and artists"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find something you love"
              />
            </label>
          </div>
          <div className="album-browser">
            {groups
              .filter(([name, list]) =>
                `${name} ${list[0].artist}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map(([name, list]) => (
                <button
                  className="album-browser-card"
                  key={name}
                  onClick={() => setSelected(name)}
                >
                  <div className="album-browser-art">
                    <Artwork track={list[0]} />
                    <span className="album-corner">
                      {list.some((t) => t.isHiRes) ? "HI-RES" : "LOCAL AUDIO"}
                    </span>
                    <span className="album-play">
                      <ArrowUpRight size={18} />
                    </span>
                  </div>
                  <h3>{name}</h3>
                  <p>
                    {groupBy === "album"
                      ? list[0].artist
                      : `${new Set(list.map((t) => t.album)).size} albums`}
                  </p>
                  <small>
                    {list.length} {list.length === 1 ? "track" : "tracks"} ·{" "}
                    {timeLabel(list.reduce((n, t) => n + t.duration, 0))}
                  </small>
                </button>
              ))}
          </div>
          {!groups.length && (
            <div className="empty-library">
              <Disc3 />
              <h3>Your next discovery is waiting.</h3>
              <p>Import some local files to start your album collection.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
