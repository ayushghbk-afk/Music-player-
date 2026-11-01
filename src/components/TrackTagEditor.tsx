import React, { useState, useEffect } from "react";
import { readLyricsFile, parseLyrics } from "../services/lyrics";
import { Track } from "../types";
import { useDialogFocus } from "./useDialogFocus";
import { Artwork } from "./Artwork";
import { X } from "lucide-react";
export function TrackTagEditor({
  track,
  isOpen,
  onSaveTrack,
  onClose,
}: {
  track: Track | null;
  isOpen: boolean;
  onSaveTrack: (track: Track) => void | Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Track | null>(track);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  useEffect(() => {
    setDraft(track);
    setError("");
  }, [track]);
  const locked = busy || reading;
  const ref = useDialogFocus(isOpen, () => {
    if (!locked) onClose();
  });
  if (!isOpen || !draft) return null;
  const field = "bg-zinc-900 border border-white/10 rounded-lg p-3 w-full mt-1";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit track tags"
      className="dialog-backdrop tag-editor"
    >
      <section ref={ref} className="tag-dialog">
        <form
          className="bg-zinc-950 border border-white/15 rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-auto space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (locked) return;
            setBusy(true);
            setError("");
            try {
              await onSaveTrack(draft);
              onClose();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not save tags");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="tag-heading">
            <Artwork track={draft} />
            <div>
              <div className="eyebrow">THE FINER DETAILS</div>
              <h2 className="text-xl">Make it your own.</h2>
              <p>Library metadata only. Your original audio stays untouched.</p>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Close track editor"
              disabled={locked}
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
          {(["title", "artist", "album", "genre"] as const).map((key) => (
            <label key={key} className="block text-sm capitalize">
              {key}
              <input
                required={key !== "genre"}
                maxLength={500}
                className={field}
                value={draft[key] || ""}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </label>
          ))}
          <div className="grid grid-cols-2 gap-4">
            {(["year", "trackNumber"] as const).map((key) => (
              <label key={key} className="text-sm">
                {key === "year" ? "Year" : "Track number"}
                <input
                  type="number"
                  min={0}
                  max={key === "year" ? 9999 : 99999}
                  className={field}
                  value={draft[key] ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [key]:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <label className="lyrics-import-button">
            {reading ? "Reading lyrics…" : "Import lyrics (.lrc / .txt)"}
            <input
              type="file"
              accept=".lrc,.txt,text/plain"
              aria-label="Import lyrics file"
              disabled={locked}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setReading(true);
                setError("");
                try {
                  const lyrics = await readLyricsFile(file);
                  setDraft((current) =>
                    current ? { ...current, lyrics } : current,
                  );
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Could not read lyrics",
                  );
                } finally {
                  setReading(false);
                }
              }}
            />
          </label>
          <label className="block text-sm">
            Lyrics
            <textarea
              maxLength={100000}
              className={field}
              value={draft.lyrics || ""}
              rows={5}
              onChange={(e) => setDraft({ ...draft, lyrics: e.target.value })}
            />
          </label>
          <p className="text-xs text-zinc-400">
            {parseLyrics(draft.lyrics || "").synced
              ? "Timestamped lyrics · sync and seek in Now Playing"
              : "Plain text · add LRC timestamps for playback sync"}
          </p>
          {error && (
            <p role="alert" className="text-red-300">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-4">
            <button type="button" disabled={locked} onClick={onClose}>
              Cancel
            </button>
            <button
              disabled={locked}
              className="bg-indigo-600 px-5 py-3 rounded-xl"
            >
              {busy ? "Saving…" : "Save tags"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
