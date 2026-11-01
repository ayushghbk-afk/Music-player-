import React, { useState } from "react";
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
  onSaveTrack: (track: Track) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Track | null>(track);
  const ref = useDialogFocus(isOpen, onClose);
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
          onSubmit={(e) => {
            e.preventDefault();
            onSaveTrack(draft);
            onClose();
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
          <div className="flex justify-end gap-4">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="bg-indigo-600 px-5 py-3 rounded-xl">
              Save tags
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
