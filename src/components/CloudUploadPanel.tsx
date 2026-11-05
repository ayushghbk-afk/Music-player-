import React, { useEffect, useState } from "react";
import { CheckCircle2, CloudUpload, FileAudio, LoaderCircle, LockKeyhole, Music2, Upload } from "lucide-react";
import { parseBlob } from "music-metadata";
import { cloudClient, type CloudSong, type CloudUser } from "../services/cloud";

const MAX_BYTES = 100 * 1024 * 1024;

function embeddedCover(data?: { data: Uint8Array; format: string }[]): string {
  const picture = data?.find((item) => item.data.length <= 1024 * 1024 && /^image\/(jpeg|png|webp|gif)$/.test(item.format));
  if (!picture) return "";
  let binary = "";
  for (let offset = 0; offset < picture.data.length; offset += 32768) {
    binary += String.fromCharCode(...picture.data.subarray(offset, offset + 32768));
  }
  return `data:${picture.format};base64,${btoa(binary)}`;
}

export function CloudUploadPanel({
  user,
  onRequireAuth,
  onUploaded,
  onBusyChange,
}: {
  user: CloudUser | null;
  onRequireAuth: () => void;
  onUploaded: (song: CloudSong) => void | Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [duration, setDuration] = useState(0);
  const [cover, setCover] = useState("");
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState<CloudSong | null>(null);

  useEffect(() => { onBusyChange(busy || reading); return () => onBusyChange(false); }, [busy, reading, onBusyChange]);

  const choose = async (selected?: File) => {
    if (!selected || busy) return;
    setError(""); setUploaded(null); setProgress(0); setCover("");
    if (!/\.(mp3|m4a|aac|wav|ogg|oga|flac)$/i.test(selected.name)) {
      setFile(null); setError("Use an MP3, M4A, AAC, WAV, OGG, or FLAC file."); return;
    }
    if (!selected.size || selected.size > MAX_BYTES) {
      setFile(null); setError("Choose a non-empty audio file no larger than 100 MB."); return;
    }
    setFile(selected);
    setTitle(selected.name.replace(/\.[^.]+$/, ""));
    setArtist("Unknown artist"); setAlbum("Cloud uploads"); setDuration(0);
    setReading(true);
    try {
      const metadata = await parseBlob(selected, { duration: true });
      setTitle(metadata.common.title || selected.name.replace(/\.[^.]+$/, ""));
      setArtist(metadata.common.artist || "Unknown artist");
      setAlbum(metadata.common.album || "Cloud uploads");
      setDuration(Math.round(metadata.format.duration || 0));
      setCover(embeddedCover(metadata.common.picture as unknown as { data: Uint8Array; format: string }[] | undefined));
      if (!metadata.format.codec && !metadata.format.container) throw new Error("Could not identify this audio file");
    } catch (reason) {
      setError(reason instanceof Error ? `${reason.message}. You can still edit the details and try the upload.` : "Tags could not be read; you can enter them manually.");
    } finally {
      setReading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !user || busy || reading) return;
    if (!title.trim()) { setError("Give this track a title."); return; }
    setBusy(true); setError(""); setUploaded(null); setProgress(0);
    try {
      const song = await cloudClient.uploadSong(file, {
        title: title.trim(), artist: artist.trim() || "Unknown artist", album: album.trim() || "Cloud uploads",
        duration: String(duration), cover_url: cover,
      }, setProgress);
      setUploaded(song);
      await onUploaded(song);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="cloud-login-required">
        <span><LockKeyhole size={25} /></span>
        <h3>Sign in to upload to the cloud.</h3>
        <p>Your local import is always available without an account. Cloud uploads are attached to your authenticated user ID.</p>
        <button className="button-primary" onClick={onRequireAuth}>Sign in or create an account</button>
      </div>
    );
  }

  return (
    <form className="cloud-upload" onSubmit={submit}>
      <div className="cloud-upload-intro">
        <div className="eyebrow">PRIVATE B2 STORAGE · SHARED MUSIC CATALOG</div>
        <h3>Upload once. Listen anywhere.</h3>
        <p>Signed in as <strong>{user.username}</strong>. You can manage and delete every track you upload.</p>
      </div>
      {!file ? (
        <label className={`import-target cloud-target ${dragging ? "dragging" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); void choose(event.dataTransfer.files[0]); }}>
          <CloudUpload size={29} strokeWidth={1.4} />
          <strong>Choose a recording for your cloud library</strong>
          <span>MP3 · M4A · AAC · WAV · OGG · FLAC — up to 100 MB</span>
          <span className="browse-file-button">Choose audio file</span>
          <input className="sr-only" type="file" aria-label="Cloud audio file" accept=".mp3,.m4a,.aac,.wav,.ogg,.oga,.flac,audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/ogg,audio/flac" onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ""; }} />
        </label>
      ) : (
        <div className="cloud-file-card">
          <div className="cloud-file-heading">
            <span className="cloud-cover">{cover ? <img src={cover} alt="Embedded cover" /> : <Music2 size={24} />}</span>
            <div><strong>{file.name}</strong><small>{(file.size / 1048576).toFixed(2)} MB {duration ? `· ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}` : ""}</small></div>
            {!busy && <button type="button" onClick={() => { setFile(null); setUploaded(null); setError(""); }}>Change file</button>}
          </div>
          <div className="cloud-metadata-grid">
            <label>Title<input required maxLength={500} disabled={busy || reading} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>Artist<input required maxLength={500} disabled={busy || reading} value={artist} onChange={(event) => setArtist(event.target.value)} /></label>
            <label>Album<input required maxLength={500} disabled={busy || reading} value={album} onChange={(event) => setAlbum(event.target.value)} /></label>
          </div>
          {reading && <p className="cloud-reading" role="status"><LoaderCircle size={14} className="loading-spinner" /> Reading audio tags and artwork…</p>}
          {busy && (
            <div className="cloud-upload-progress" role="status" aria-live="polite">
              <div><span>{progress < 100 ? "Uploading encrypted to private B2 storage…" : "Saving track metadata…"}</span><strong>{progress}%</strong></div>
              <progress max={100} value={progress} aria-label="Upload progress" />
            </div>
          )}
          {uploaded && (
            <div className="cloud-upload-success" role="status"><CheckCircle2 size={19} /><div><strong>{uploaded.title} is ready to stream.</strong><span>The audio and Turso metadata were saved successfully.</span></div></div>
          )}
          {!busy && !uploaded && <button className="button-primary cloud-upload-submit" type="submit" disabled={reading}><Upload size={14} /> Upload to cloud library</button>}
          {uploaded && <button className="button-primary cloud-upload-submit" type="button" onClick={() => { setFile(null); setUploaded(null); setProgress(0); }}><CloudUpload size={14} /> Upload another track</button>}
        </div>
      )}
      {error && <p className="cloud-upload-error" role="alert"><FileAudio size={15} /> {error}</p>}
      <p className="cloud-upload-note">Uploads are checked by extension, MIME type, file signature, and size. Audio stays in a private bucket; playback uses expiring, song-specific stream tickets.</p>
    </form>
  );
}
