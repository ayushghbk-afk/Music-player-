import React, { useEffect, useRef, useState } from "react";
import type { Track } from "../types";
import { audioEngine } from "../services/audioEngine";
import { tapTempo } from "../services/studioRack";
import { timeLabel } from "./Artwork";
import { StudioControl } from "./StudioControl";

export function StudioDeck({
  track,
  rate,
  onRateChange,
}: {
  track: Track | null;
  rate: number;
  onRateChange: (rate: number) => void;
}) {
  const [cue, setCue] = useState<{ id: string; time: number } | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const taps = useRef<number[]>([]);
  useEffect(() => {
    setCue(null);
    taps.current = [];
    setBpm(null);
  }, [track?.id]);
  const ready =
    !!track && ["playing", "paused"].includes(audioEngine.getStatus());
  return (
    <section className="studio-deck" aria-label="Single-deck DJ tools">
      <div>
        <span className="eyebrow">SINGLE DECK / PERFORMANCE</span>
        <h3>Find your entry. Set your pace.</h3>
        <p className="studio-note">
          {track
            ? `${track.title} · ${track.artist}`
            : "Load a local track to set a cue."}
        </p>
      </div>
      <div className="studio-deck-grid">
        <StudioControl
          label="Playback speed"
          value={Math.round(rate * 1000) / 10}
          min={50}
          max={300}
          step={0.1}
          unit="%"
          onChange={(value) => onRateChange(value / 100)}
        />
        <div className="studio-deck-buttons">
          <button onClick={() => onRateChange(1)}>Reset speed</button>
          <button
            disabled={!ready}
            onClick={() =>
              setCue({ id: track!.id, time: audioEngine.getCurrentTime() })
            }
          >
            Set cue
          </button>
          <button
            disabled={!ready || cue?.id !== track?.id || !cue}
            onClick={() => {
              if (cue && cue.id === track?.id) audioEngine.seek(cue.time);
            }}
          >
            Jump to cue {cue && cue.id === track?.id ? timeLabel(cue.time) : ""}
          </button>
          <button
            onClick={() => {
              const result = tapTempo(taps.current, performance.now());
              taps.current = result.taps;
              setBpm(result.bpm);
            }}
          >
            Tap BPM
          </button>
          <output role="status">
            {bpm
              ? `${bpm.toFixed(1)} BPM · manual estimate`
              : "Tap twice or more to estimate BPM"}
          </output>
        </div>
      </div>
      <p className="studio-note">
        Playback speed uses the engine’s time stretching; it is not a pitch-bend
        wheel. Cue stays only while this view is mounted and never starts
        playback. No second deck, sync, beat grid, headphone cue bus or
        recording.
      </p>
    </section>
  );
}
