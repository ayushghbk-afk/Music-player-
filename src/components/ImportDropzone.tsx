import React, { useEffect, useState, useRef } from "react";
import {
  Upload,
  X,
  AudioLines,
  ShieldCheck,
  FileAudio,
  LoaderCircle,
  HardDrive,
  CloudUpload,
} from "lucide-react";
import { useDialogFocus } from "./useDialogFocus";
import { getAllTracks, saveTrack } from "../services/db";
import { readLyricsFile, findLyricsTarget } from "../services/lyrics";
import { importAudioFile } from "../services/importTracks";
import { CloudUploadPanel } from "./CloudUploadPanel";
import type { CloudSong, CloudUser } from "../services/cloud";

export type ImportMode = "local" | "cloud";

export function ImportDropzone({
  isOpen,
  initialMode = "local",
  user,
  onClose,
  onImportComplete,
  onRequireAuth,
  onCloudUploadComplete,
}: {
  isOpen: boolean;
  initialMode?: ImportMode;
  user: CloudUser | null;
  onClose: () => void;
  onImportComplete: () => void | Promise<void>;
  onRequireAuth: () => void;
  onCloudUploadComplete: (song: CloudSong) => void | Promise<void>;
}) {
  const [mode, setMode] = useState<ImportMode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const locked = busy || cloudBusy;
  const dialogRef = useDialogFocus(isOpen, () => {
    if (!locked) onClose();
  });
  const importing = useRef(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0, name: "", stage: "" });

  useEffect(() => {
    if (isOpen) { setMode(initialMode); setLog([]); }
  }, [isOpen, initialMode]);

  async function importFiles(files: FileList | File[]) {
    if (importing.current) return;
    const list = Array.from(files);
    if (!list.length) return;
    importing.current = true;
    setBusy(true);
    setLog([]);
    const audio = list.filter((file) => !/\.(lrc|txt)$/i.test(file.name));
    const sidecars = list.filter((file) => /\.(lrc|txt)$/i.test(file.name));
    let completed = 0;
    try {
      for (const file of [...audio, ...sidecars]) {
        setProgress({ completed, total: list.length, name: file.name, stage: "Opening file" });
        try {
          if (/\.(lrc|txt)$/i.test(file.name)) {
            setProgress((p) => ({ ...p, stage: "Matching lyrics to your library" }));
            const lyrics = await readLyricsFile(file);
            const track = findLyricsTarget(file.name, await getAllTracks());
            await saveTrack({ ...track, lyrics });
            setLog((l) => [...l, `Lyrics imported for ${track.title}`]);
          } else {
            const track = await importAudioFile(file, (stage) => setProgress((p) => ({ ...p, stage })));
            setLog((l) => [...l, `Ready: ${track.title}`]);
          }
        } catch (e) {
          setLog((l) => [...l, `${file.name}: ${e instanceof Error ? e.message : "Import failed"}`]);
        }
        completed++;
        setProgress((p) => ({ ...p, completed }));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      setProgress((p) => ({ ...p, stage: "Refreshing your collection" }));
      await onImportComplete();
    } catch (e) {
      setLog((l) => [...l, `Refresh failed: ${e instanceof Error ? e.message : "Try reopening the library"}`]);
    } finally {
      importing.current = false;
      setBusy(false);
    }
  }
  if (!isOpen) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onClick={(e) => {
      if (e.target === e.currentTarget && !locked) onClose();
    }}>
      <section ref={dialogRef} className="import-dialog cloud-capable-dialog" role="dialog" aria-modal="true" aria-label="Import or upload audio">
        <div className="dialog-heading">
          <span className="tool-card-icon"><AudioLines size={22} /></span>
          <button className="icon-button" aria-label="Close import" disabled={locked} onClick={onClose}><X size={18} /></button>
        </div>
        <div className="import-mode-tabs" role="tablist" aria-label="Music destination">
          <button type="button" role="tab" aria-selected={mode === "local"} className={mode === "local" ? "active" : ""} disabled={locked} onClick={() => setMode("local")}><HardDrive size={14} /> On this device</button>
          <button type="button" role="tab" aria-selected={mode === "cloud"} className={mode === "cloud" ? "active" : ""} disabled={locked} onClick={() => setMode("cloud")}><CloudUpload size={14} /> Cloud library</button>
        </div>
        {mode === "local" ? (
          <>
            <div className="eyebrow">MAKE YOURSELF AT HOME</div>
            <h2>Your music belongs here.</h2>
            <p>Bring your favorite recordings into your own private listening space.</p>
            <label className={`import-target ${dragging ? "dragging" : ""} ${busy ? "busy" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); void importFiles(e.dataTransfer.files); }}>
              {busy ? <LoaderCircle size={28} className="loading-spinner" /> : <Upload size={28} strokeWidth={1.4} />}
              <strong>{busy ? progress.stage : "Drop the needle. Or your files."}</strong>
              <span>{busy ? `${progress.completed} / ${progress.total} complete · ${progress.name}` : "Drag your audio here, or browse your files"}</span>
              <span className="browse-file-button">{busy ? "Importing…" : "Choose audio files"}</span>
              <input aria-label="Audio files" className="sr-only" type="file" multiple accept="audio/*,.flac,.alac,.m4a,.ogg,.wav,.lrc,.txt" disabled={busy}
                onChange={(e) => { if (e.target.files) void importFiles(e.target.files); e.target.value = ""; }} />
            </label>
            {busy && (
              <div className="import-progress" role="status" aria-live="polite">
                <progress aria-label="Files processed" value={progress.completed} max={progress.total || 1} />
                <span>{progress.stage} · {progress.completed} of {progress.total} files</span>
              </div>
            )}
            <div className="import-formats"><FileAudio size={13} /> FLAC · WAV · MP3 · AAC · OGG · ALAC / M4A</div>
            <p className="import-privacy"><ShieldCheck size={16} /><span>Never uploaded. Always yours.<small>Tags are read on-device. Duplicate files are recognized automatically. Add matching-name .lrc / .txt files alongside audio, or import lyrics from a track’s editor. Original files stay untouched.</small></span></p>
            <ul aria-live="polite" className="import-log">{log.map((line, i) => <li key={i}>{line}</li>)}</ul>
            {log.length > 0 && !busy && <button className="button-primary import-done" onClick={onClose}>Back to my collection</button>}
          </>
        ) : (
          <CloudUploadPanel user={user} onRequireAuth={onRequireAuth} onUploaded={onCloudUploadComplete} onBusyChange={setCloudBusy} />
        )}
      </section>
    </div>
  );
}
