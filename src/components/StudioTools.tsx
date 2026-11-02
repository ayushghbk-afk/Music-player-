import React, { useEffect, useRef, useState } from "react";
import type { EQSettings } from "../types";
import { audioEngine } from "../services/audioEngine";
import { dbfs, headroomDb } from "../services/dsp";
import { cloneEQ } from "../services/studioRack";
import { eqSchema } from "../services/backupSchema";
import { getKV, setKV } from "../services/db";

export function StudioMeters() {
  const [levels, setLevels] = useState({
    left: -60,
    right: -60,
    peak: -60,
    hot: false,
  });
  const hold = useRef({ peak: -60, until: 0, hotUntil: 0 });
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const meter = audioEngine.getMeterLevels(),
        now = performance.now(),
        peak = dbfs(meter.peak);
      if (peak >= hold.current.peak || now > hold.current.until) {
        hold.current.peak = peak;
        hold.current.until = now + 1500;
      }
      if (meter.overloaded) hold.current.hotUntil = now + 1200;
      setLevels({
        left: dbfs(meter.left),
        right: dbfs(meter.right),
        peak: hold.current.peak,
        hot: now < hold.current.hotUntil,
      });
    }, 100);
    return () => clearInterval(timer);
  }, []);
  const value = (db: number) => (db <= -60 ? "−∞" : db.toFixed(1));
  return (
    <div className="studio-meters" aria-label="Measured output levels">
      {(["left", "right"] as const).map((channel) => (
        <div key={channel}>
          <span>{channel === "left" ? "L" : "R"}</span>
          <meter
            min={-60}
            max={0}
            low={-24}
            high={-6}
            optimum={-18}
            value={levels[channel]}
            aria-label={`${channel} RMS level`}
          />
          <output>
            {value(levels[channel])} <small>dBFS RMS</small>
          </output>
        </div>
      ))}
      <p>
        <span className={levels.hot ? "studio-hot" : ""}>
          {levels.hot ? "PEAK GUARD / HOT SIGNAL" : "MEASURED STEREO OUTPUT"}
        </span>
        <span>Peak hold {value(levels.peak)} dBFS</span>
      </p>
      <small>
        {audioEngine.isNative()
          ? "Native PCM sink · before hardware/DAC volume"
          : "Web Audio · after output volume"}{" "}
        · RMS and sample peak, not LUFS / true peak.
      </small>
    </div>
  );
}
const clone = cloneEQ;
export function StudioTools({
  settings,
  onUpdate,
}: {
  settings: EQSettings;
  onUpdate: (settings: EQSettings) => void;
}) {
  const [slot, setSlot] = useState<"A" | "B">("A");
  const slots = useRef<{ A: EQSettings; B: EQSettings } | null>(null);
  const [presets, setPresets] = useState<EQSettings[]>([]);
  const [name, setName] = useState("My signature");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const request = useRef(false);
  useEffect(() => {
    let cancelled = false;
    getKV<unknown>("studioPresets", [])
      .then((value) => {
        const result = eqSchema.array().max(20).safeParse(value);
        if (!cancelled) {
          if (result.success)
            setPresets(
              result.data.map((p) => ({
                ...p,
                preset: p.preset || "User preset",
              })),
            );
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled)
          setMessage("Could not load saved presets. Reload before saving.");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!slots.current)
    slots.current = { A: clone(settings), B: clone(settings) };
  const compare = (next: "A" | "B") => {
    if (next === slot) return;
    slots.current![slot] = clone(settings);
    onUpdate(clone(slots.current![next]));
    setSlot(next);
    setMessage(`Listening to ${next}. Comparison is not loudness-matched.`);
  };
  const persist = async (next: EQSettings[]) => {
    if (request.current || !ready) return;
    request.current = true;
    setBusy(true);
    try {
      await setKV("studioPresets", next);
      setPresets(next);
      setMessage("Studio presets saved on this device.");
    } catch {
      setMessage("Could not save preset. Check available device storage.");
    } finally {
      request.current = false;
      setBusy(false);
    }
  };
  const update = (patch: Partial<EQSettings>) =>
    onUpdate({ ...settings, ...patch, preset: "Custom" });
  const reduction = headroomDb(settings, audioEngine.getDspSampleRate());
  return (
    <section
      className="studio-tools"
      aria-label="Studio protection and monitoring"
    >
      <div className="studio-tools-heading">
        <div>
          <span className="eyebrow">SIGNAL & MONITORING</span>
          <h3>More control. Less guesswork.</h3>
        </div>
        <div className="studio-ab">
          <button aria-pressed={slot === "A"} onClick={() => compare("A")}>
            A
          </button>
          <button aria-pressed={slot === "B"} onClick={() => compare("B")}>
            B
          </button>
          <button
            onClick={() => {
              slots.current![slot === "A" ? "B" : "A"] = clone(settings);
              setMessage(`Copied ${slot} to ${slot === "A" ? "B" : "A"}.`);
            }}
          >
            Copy {slot} → {slot === "A" ? "B" : "A"}
          </button>
        </div>
      </div>
      <StudioMeters />
      <div className="studio-protection-grid">
        <label>
          <input
            type="checkbox"
            checked={settings.autoHeadroom !== false}
            onChange={(e) => update({ autoHeadroom: e.target.checked })}
          />
          <span>
            Auto headroom
            <small>
              {settings.enabled
                ? `−${reduction.toFixed(1)} dB compensation · response estimate`
                : "EQ bypassed · no compensation"}
            </small>
          </span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.peakProtection !== false}
            onChange={(e) => update({ peakProtection: e.target.checked })}
          />
          <span>
            Peak protection
            <small>Soft-knee sample guard · remains on during EQ bypass</small>
          </span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={!!settings.mono}
            disabled={!settings.enabled}
            onChange={(e) => update({ mono: e.target.checked })}
          />
          <span>
            Mono monitor<small>Sum L/R to check phase and center balance</small>
          </span>
        </label>
        <label className="studio-balance">
          <span>
            Channel balance{" "}
            <output>
              {Math.abs(settings.balance || 0) < 0.01
                ? "Center"
                : `${(settings.balance || 0) < 0 ? "L" : "R"} ${Math.round(Math.abs(settings.balance || 0) * 100)}%`}
            </output>
          </span>
          <input
            type="range"
            aria-label="Channel balance"
            min={-1}
            max={1}
            step={0.01}
            disabled={!settings.enabled}
            value={settings.balance || 0}
            onChange={(e) => update({ balance: Number(e.target.value) })}
          />
          <button onClick={() => update({ balance: 0 })}>Center</button>
        </label>
      </div>
      <div className="studio-preset-tools">
        <label>
          PRESET NAME
          <input
            aria-label="Custom preset name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button
          disabled={!ready || busy || !name.trim()}
          onClick={() => {
            const preset = `User: ${name.trim()}`;
            if (
              presets.length >= 20 &&
              !presets.some((p) => p.preset === preset)
            ) {
              setMessage(
                "Maximum 20 presets. Remove one before saving another.",
              );
              return;
            }
            void persist([
              ...presets.filter((p) => p.preset !== preset),
              { ...clone(settings), preset },
            ]);
          }}
        >
          Save preset
        </button>
        <button
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(settings, null, 2)], {
                type: "application/json",
              }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "aether-studio-preset.json";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Export EQ
        </button>
        <label className="studio-file-button">
          Import EQ
          <input
            aria-label="Import EQ preset"
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                if (file.size > 16384) throw new Error("Preset exceeds 16 KB");
                const result = eqSchema.parse(JSON.parse(await file.text()));
                onUpdate({ ...result, preset: result.preset || "Imported" });
                setMessage(
                  "Preset loaded. Use Save preset to keep it on this device.",
                );
              } catch {
                setMessage(
                  "Invalid preset: expected ten bands and valid Aether DSP settings (16 KB maximum).",
                );
              }
            }}
          />
        </label>
      </div>
      {presets.length > 0 && (
        <div className="studio-user-presets">
          {presets.map((preset) => (
            <div key={preset.preset}>
              <button onClick={() => onUpdate(clone(preset))}>
                {preset.preset}
              </button>
              <button
                disabled={busy}
                aria-label={`Delete ${preset.preset}`}
                onClick={() =>
                  void persist(
                    presets.filter((p) => p.preset !== preset.preset),
                  )
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="studio-note">
        {settings.autoHeadroom === false
          ? "Headroom is off: boosted EQ can distort. Lower preamp or turn protection back on. "
          : ""}
        Protection can color peaks when driven hard. A/B is not level-matched;
        saved presets are device-local and not included in library backups.
      </p>
      {message && (
        <p role="status" className="studio-message">
          {message}
        </p>
      )}
    </section>
  );
}
