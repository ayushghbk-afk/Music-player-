import React from "react";
import { assetUrl } from "../services/deployment";
import {
  Play,
  ArrowUpRight,
  ArrowRight,
  AudioLines,
  Headphones,
  SlidersHorizontal,
  Disc3,
  ShieldCheck,
  Sparkles,
  Pause,
} from "lucide-react";
import { Track, EQSettings } from "../types";
import { Artwork, displayTitle } from "./Artwork";
interface LibraryExperienceProps {
  tracks: Track[];
  onPlay: (track: Track) => void;
  onViewAlbums: () => void;
  onImport: () => void;
  onViewHiRes: () => void;
}
export function LibraryExperience({
  tracks,
  onPlay,
  onViewAlbums,
  onViewHiRes,
  onImport,
}: LibraryExperienceProps) {
  const albums = tracks
    .filter(
      (track, i, all) => all.findIndex((t) => t.album === track.album) === i,
    )
    .slice(0, 5);
  const featured = tracks.find((t) => t.id === "sample-track-1") || tracks[0];
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">YOUR SPACE. YOUR SOUND.</div>
          <h1 className="desktop-library-title">
            A little closer to the music<span>.</span>
          </h1>
          <h1 className="mobile-library-title">
            Find your
            <br />
            kind of quiet<span>.</span>
          </h1>
          <p>A collection that’s entirely yours. Every detail, every note.</p>
        </div>
        <span className="offline-indicator">
          <i /> Listening, uninterrupted
        </span>
      </div>
      <div className="mobile-collection-summary">
        <span>
          <ShieldCheck size={13} /> YOUR OFFLINE COLLECTION
        </span>
        <strong>
          {tracks.length} tracks <i>·</i>{" "}
          {new Set(tracks.map((t) => t.album)).size} albums
        </strong>
      </div>
      <section className="feature-banner">
        <img
          className="feature-landscape"
          src={assetUrl("art/landscape-1.svg")}
          alt="Sun setting over layered mountain silhouettes"
        />
        <div className="feature-shade" />
        <div className="feature-copy">
          <div className="feature-label">
            <AudioLines size={14} /> THE AETHER LISTENING ROOM
          </div>
          <h2>
            Less noise.
            <br />
            More feeling.
          </h2>
          <p>
            Rediscover the details you fell in love with.
            <br /> Your music, beautifully uncompromised.
          </p>
          <div className="feature-buttons">
            <button
              className="button-primary"
              disabled={!featured}
              onClick={() => featured && onPlay(featured)}
            >
              <Play size={14} fill="currentColor" /> Enter the listening room
            </button>
            <button className="feature-link" onClick={onImport}>
              Bring your music <ArrowUpRight size={16} />
            </button>
          </div>
        </div>
        <div className="feature-caption">
          <span>CURATED FOR YOUR EARS</span>
          <small>Local files. Limitless feeling.</small>
        </div>
        <div className="feature-edition">
          AETHER ORIGINALS <span>VOL. 01 — SOUNDSCAPES</span>
        </div>
      </section>
      <div className="mobile-library-shortcuts">
        <button onClick={onViewAlbums}>
          <Disc3 size={18} />
          <span>Albums</span>
          <ArrowUpRight size={13} />
        </button>
        <button onClick={onViewHiRes}>
          <AudioLines size={18} />
          <span>Hi-res audio</span>
          <ArrowUpRight size={13} />
        </button>
        <button onClick={onImport}>
          <ArrowUpRight size={18} />
          <span>Import music</span>
        </button>
      </div>
      <section className="album-section">
        <div className="section-heading">
          <div>
            <h2>
              In your rotation{" "}
              <span>A little inspiration from your library</span>
            </h2>
          </div>
          <button onClick={onViewAlbums}>
            View albums <ArrowRight size={14} />
          </button>
        </div>
        {albums.length ? (
          <div className="rotation-grid">
            {albums.map((track, i) => (
              <button
                key={track.id}
                className="rotation-card"
                onClick={() => onPlay(track)}
              >
                <div className="rotation-art">
                  <Artwork track={track} />
                  <span className="album-corner">
                    {track.isHiRes ? "HI-RES" : track.format}
                  </span>
                  <span className="album-play">
                    <Play size={17} fill="currentColor" />
                  </span>
                  <span className="album-index">0{i + 1}</span>
                </div>
                <strong>{displayTitle(track)}</strong>
                <span>{track.artist}</span>
              </button>
            ))}
          </div>
        ) : (
          <button className="empty-rotation" onClick={onImport}>
            <Disc3 /> Your collection starts with a single track. Import your
            music <ArrowUpRight size={16} />
          </button>
        )}
      </section>
    </>
  );
}
export function ListeningPanel({
  tracks,
  currentTrack,
  isPlaying,
  eq,
  onPlay,
  onExpand,
  onEQ,
  onAssistant,
}: {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  eq: EQSettings;
  onPlay: (track: Track) => void;
  onExpand: () => void;
  onEQ: () => void;
  onAssistant: () => void;
}) {
  const upcoming = currentTrack
    ? [
        ...tracks.slice(tracks.findIndex((t) => t.id === currentTrack.id) + 1),
        ...tracks.slice(
          0,
          tracks.findIndex((t) => t.id === currentTrack.id),
        ),
      ].slice(0, 3)
    : tracks.slice(0, 3);
  return (
    <aside className="listening-panel">
      <div className="panel-title">
        <span>
          <Headphones size={15} /> YOUR LISTENING ROOM
        </span>
        <span className="status-dot" />
      </div>
      <button
        className="listening-art"
        onClick={currentTrack ? onExpand : () => tracks[0] && onPlay(tracks[0])}
      >
        <Artwork track={currentTrack || tracks[0]} />
        <span>
          {currentTrack
            ? isPlaying
              ? "NOW PLAYING"
              : "PAUSED"
            : "READY WHEN YOU ARE"}
          <span>{isPlaying ? <Pause size={14} /> : <Play size={14} />}</span>
        </span>
      </button>
      <div className="listening-track">
        <h3>
          {currentTrack ? displayTitle(currentTrack) : "Find your frequency."}
        </h3>
        <p>{currentTrack?.artist || "A moment. Just for you."}</p>
        {currentTrack && (
          <div className="listening-spec">
            <span>{currentTrack.format}</span>
            <span>
              {currentTrack.bitDepth
                ? `${currentTrack.bitDepth}-bit`
                : "Local file"}
            </span>
            <span>
              {currentTrack.sampleRate
                ? `${currentTrack.sampleRate / 1000} kHz`
                : "Native rate"}
            </span>
          </div>
        )}
      </div>
      <button className="eq-preview" onClick={onEQ}>
        <div>
          <SlidersHorizontal size={15} />
          <span>Studio equalizer</span>
          <small>{eq.enabled ? "ON" : "OFF"}</small>
        </div>
        <div className="mini-eq">
          {eq.bands.map((band, i) => (
            <span key={i}>
              <i style={{ bottom: `${50 + band * 3}%` }} />
            </span>
          ))}
        </div>
        <p>
          {eq.preset}
          <ArrowUpRight size={13} />
        </p>
      </button>
      <div className="up-next-heading">
        <h3>
          {currentTrack ? "More from your library" : "Start with a favorite"}
        </h3>
        <span>{upcoming.length} tracks</span>
      </div>
      <div className="up-next-list">
        {upcoming.map((track) => (
          <button key={track.id} onClick={() => onPlay(track)}>
            <Artwork track={track} />
            <div>
              <strong>{displayTitle(track)}</strong>
              <small>{track.artist}</small>
            </div>
            <Play size={13} />
          </button>
        ))}
      </div>
      <button className="assistant-card" onClick={onAssistant}>
        <Sparkles size={17} />
        <div>
          <strong>A sound of your own</strong>
          <p>Fine-tune with your sound assistant.</p>
        </div>
        <ArrowUpRight size={15} />
      </button>
      <div className="private-note">
        <ShieldCheck size={13} />
        <span>On your device. In your control.</span>
      </div>
    </aside>
  );
}
