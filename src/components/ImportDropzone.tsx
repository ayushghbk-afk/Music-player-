import React, { useState } from "react";
import {
  Upload,
  X,
  AudioLines,
  ShieldCheck,
  FileAudio,
  LoaderCircle,
} from "lucide-react";
import { useDialogFocus } from "./useDialogFocus";
import { importAudioFile } from "../services/importTracks";

export function ImportDropzone({
  isOpen,
  onClose,
  onImportComplete,
}: {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const dialogRef = useDialogFocus(isOpen, () => {
    if (!busy) onClose();
  });
  async function importFiles(files: FileList | File[]) {
    if (busy) return;
    setBusy(true);
    setLog([]);
    for (const file of Array.from(files)) {
      try {
        const track = await importAudioFile(file);
        setLog((l) => [...l, `Imported ${track.title}`]);
      } catch (e) {
        setLog((l) => [
          ...l,
          `${file.name}: ${e instanceof Error ? e.message : "Import failed"}`,
        ]);
      }
    }
    setBusy(false);
    onImportComplete();
  }
  if (!isOpen) return null;
  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="import-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Import local audio"
      >
        <div className="dialog-heading">
          <span className="tool-card-icon">
            <AudioLines size={22} />
          </span>
          <button
            className="icon-button"
            aria-label="Close import"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="eyebrow">MAKE YOURSELF AT HOME</div>
        <h2>Your music belongs here.</h2>
        <p>
          Bring your favorite recordings into your own private listening space.
        </p>
        <label
          className={`import-target ${dragging ? "dragging" : ""} ${busy ? "busy" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void importFiles(e.dataTransfer.files);
          }}
        >
          {busy ? (
            <LoaderCircle size={28} className="loading-spinner" />
          ) : (
            <Upload size={28} strokeWidth={1.4} />
          )}
          <strong>
            {busy ? "Finding every detail…" : "Drop the needle. Or your files."}
          </strong>
          <span>
            {busy
              ? "Reading tags and saving audio locally."
              : "Drag your audio here, or browse your files"}
          </span>
          <span className="browse-file-button">
            {busy ? "Importing…" : "Choose audio files"}
          </span>
          <input
            aria-label="Audio files"
            className="sr-only"
            type="file"
            multiple
            accept="audio/*,.flac,.alac,.m4a,.ogg,.wav"
            disabled={busy}
            onChange={(e) => {
              if (e.target.files) void importFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <div className="import-formats">
          <FileAudio size={13} /> FLAC · WAV · MP3 · AAC · OGG · ALAC / M4A
        </div>
        <p className="import-privacy">
          <ShieldCheck size={16} />
          <span>
            Never uploaded. Always yours.
            <small>
              Tags are read on-device. Duplicate files are recognized
              automatically. Library tag edits don’t change the original file.
            </small>
          </span>
        </p>
        <ul aria-live="polite" className="import-log">
          {log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        {log.length > 0 && !busy && (
          <button className="button-primary import-done" onClick={onClose}>
            Back to my collection
          </button>
        )}
      </section>
    </div>
  );
}
