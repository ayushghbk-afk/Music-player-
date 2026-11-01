import React, { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { importAudioFile } from '../services/importTracks';

export function ImportDropzone({ isOpen, onClose, onImportComplete }: { isOpen: boolean; onClose: () => void; onImportComplete: () => void }) {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  async function importFiles(files: FileList | File[]) {
    if (busy) return;
    setBusy(true); setLog([]);
    for (const file of Array.from(files)) {
      try { const track = await importAudioFile(file); setLog(l => [...l, `Imported ${track.title}`]); }
      catch (e) { setLog(l => [...l, `${file.name}: ${e instanceof Error ? e.message : 'Import failed'}`]); }
    }
    setBusy(false); onImportComplete();
  }
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Import local audio">
    <section className="bg-zinc-950 border border-white/15 rounded-2xl p-6 w-full max-w-xl">
      <div className="flex justify-between items-center mb-5"><h2 className="text-xl font-semibold">Import local audio</h2><button aria-label="Close import" disabled={busy} onClick={onClose}><X /></button></div>
      <label className="border border-dashed border-indigo-400/50 rounded-xl p-10 flex flex-col items-center gap-4 cursor-pointer bg-indigo-500/5" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void importFiles(e.dataTransfer.files); }}>
        <Upload className="text-indigo-400" /><span>{busy ? 'Reading tags and saving audio…' : 'Choose files or drop them here'}</span>
        <span className="text-xs text-zinc-400">FLAC · WAV · MP3 · AAC · OGG · ALAC / M4A</span>
        <input aria-label="Audio files" className="sr-only" type="file" multiple accept="audio/*,.flac,.alac,.m4a,.ogg,.wav" disabled={busy} onChange={e => { if (e.target.files) void importFiles(e.target.files); }} />
      </label>
      <p className="text-xs text-zinc-500 mt-4">Files stay on this device. Tags are read locally; repeat imports are deduplicated by content. Tag edits change library metadata, not the source file.</p>
      <ul aria-live="polite" className="text-sm mt-4 max-h-48 overflow-auto space-y-2">{log.map((line, i) => <li key={i}>{line}</li>)}</ul>
    </section>
  </div>;
}
