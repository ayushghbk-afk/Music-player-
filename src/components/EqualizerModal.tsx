import React, { useEffect, useRef, useState } from "react";
import {
  Sliders,
  Zap,
  RotateCcw,
  Volume2,
  Sparkles,
  X,
  Activity,
  BarChart2,
  Layers,
} from "lucide-react";
import { EQSettings } from "../types";
import { audioEngine, EQ_FREQUENCIES } from "../services/audioEngine";
import { StudioTools } from "./StudioTools";
import { AudioVisualizer } from "./AudioVisualizer";
import { eqCoefficients, responseDb, headroomDb } from "../services/dsp";
import { useDialogFocus } from "./useDialogFocus";

interface EqualizerModalProps {
  isOpen: boolean;
  embedded?: boolean;
  eqSettings: EQSettings;
  onUpdateEQ: (settings: EQSettings) => void;
  onClose: () => void;
}

const PRESETS: Record<
  string,
  { bands: number[]; preamp: number; bass: number; treble: number }
> = {
  Flat: {
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    preamp: 0,
    bass: 0,
    treble: 0,
  },
  "Audiophile Neutral": {
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    preamp: 0,
    bass: 0,
    treble: 0,
  },
  Acoustic: {
    bands: [3, 2, 1, 0, 1, 2, 3, 2, 2, 3],
    preamp: 1,
    bass: 10,
    treble: 20,
  },
  "Bass Booster": {
    bands: [8, 6, 5, 3, 1, 0, 0, 0, 0, 0],
    preamp: -2,
    bass: 60,
    treble: 0,
  },
  "Vocal Boost": {
    bands: [-2, -1, 0, 3, 5, 4, 3, 2, 0, -1],
    preamp: 0,
    bass: 0,
    treble: 10,
  },
  Electronic: {
    bands: [5, 4, 2, 0, -2, 2, 1, 3, 5, 6],
    preamp: -1,
    bass: 40,
    treble: 30,
  },
  "Jazz Master": {
    bands: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
    preamp: 0,
    bass: 15,
    treble: 20,
  },
  "Rock & Roll": {
    bands: [5, 3, 2, 0, -1, 0, 2, 3, 4, 5],
    preamp: -1,
    bass: 30,
    treble: 25,
  },
};

/* Equalizer Frequency Response Curve Graph Component */
const EqualizerGraph: React.FC<{
  eqSettings: EQSettings;
  onBandChange: (idx: number, val: number) => void;
}> = ({ eqSettings, onBandChange }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeBandHover, setActiveBandHover] = useState<number | null>(null);
  const [isDraggingBand, setIsDraggingBand] = useState<number | null>(null);

  const width = 600;
  const height = 140;
  const paddingX = 35;
  const paddingY = 18;
  const graphWidth = width - paddingX * 2;
  const graphHeight = height - paddingY * 2;
  const centerY = paddingY + graphHeight / 2;

  const sampleRate = audioEngine.getDspSampleRate();
  const coefficients = eqCoefficients(eqSettings, sampleRate);
  const reduction = headroomDb(eqSettings, sampleRate);
  const bandPoints = EQ_FREQUENCIES.map((freq, i) => {
    const x = paddingX + (i / 9) * graphWidth;
    const bandVal = eqSettings.bands[i] || 0;
    const netDb = eqSettings.enabled
      ? responseDb(coefficients, freq, sampleRate) +
        eqSettings.preamp -
        reduction
      : 0;
    const clampedDb = Math.max(-18, Math.min(18, netDb));
    const y = centerY - (clampedDb / 18) * (graphHeight / 2);

    return { x, y, bandVal, netDb, freq, index: i };
  });

  const getSmoothPath = (pts: typeof bandPoints) => {
    if (pts.length === 0) return "";
    let path = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const curr = pts[i];
      const next = pts[i + 1];
      const prev = pts[i - 1] || curr;
      const after = pts[i + 2] || next;

      const cp1x = curr.x + (next.x - prev.x) * 0.22;
      const cp1y = curr.y + (next.y - prev.y) * 0.22;
      const cp2x = next.x - (after.x - curr.x) * 0.22;
      const cp2y = next.y - (after.y - curr.y) * 0.22;

      path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${next.x.toFixed(1)},${next.y.toFixed(1)}`;
    }
    return path;
  };

  const curvePath = getSmoothPath(bandPoints);
  const fillPath = `${curvePath} L ${bandPoints[9].x},${height - paddingY} L ${bandPoints[0].x},${height - paddingY} Z`;

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isDraggingBand === null || !svgRef.current || !eqSettings.enabled)
      return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientY = e.clientY - rect.top;

    const normalizedY =
      (clientY - (rect.height * paddingY) / height) /
      ((rect.height * graphHeight) / height);
    const clampedNorm = Math.max(0, Math.min(1, normalizedY));
    const dbVal = Math.round((0.5 - clampedNorm) * 24 * 2) / 2;
    const clampedDb = Math.max(-12, Math.min(12, dbVal));

    onBandChange(isDraggingBand, clampedDb);
  };

  const handlePointerUp = () => {
    setIsDraggingBand(null);
  };

  return (
    <div className="bg-zinc-950/90 rounded-2xl border border-white/10 p-3 shadow-inner space-y-1 relative overflow-hidden select-none">
      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 px-1">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
          <span className="font-bold text-white uppercase tracking-wider text-[10px]">
            DSP Response Curve
          </span>
          <span
            className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${
              eqSettings.enabled
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                : "bg-zinc-800 text-zinc-500 border-zinc-700"
            }`}
          >
            {eqSettings.enabled ? "ACTIVE GRAPH" : "BYPASSED"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[9px]">
          <span className="text-sky-400 font-semibold">+12 dB</span>
          <span className="text-zinc-500">0 dB</span>
          <span className="text-rose-400 font-semibold">-12 dB</span>
        </div>
      </div>

      <div className="relative w-full h-32">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full cursor-crosshair overflow-visible"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <defs>
            <linearGradient id="eqCurveGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="#10b981"
                stopOpacity={eqSettings.enabled ? 0.45 : 0.05}
              />
              <stop
                offset="50%"
                stopColor="#e5a68c"
                stopOpacity={eqSettings.enabled ? 0.2 : 0.02}
              />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </linearGradient>

            <filter
              id="glowEffect"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {[-12, -6, 0, 6, 12].map((db) => {
            const y = centerY - (db / 18) * (graphHeight / 2);
            return (
              <line
                key={db}
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke={
                  db === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)"
                }
                strokeDasharray={db === 0 ? "none" : "3 3"}
                strokeWidth={db === 0 ? 1.5 : 1}
              />
            );
          })}

          {bandPoints.map((pt) => (
            <line
              key={pt.freq}
              x1={pt.x}
              y1={paddingY}
              x2={pt.x}
              y2={height - paddingY}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
            />
          ))}

          <path d={fillPath} fill="url(#eqCurveGradient)" />

          <path
            d={curvePath}
            fill="none"
            stroke={eqSettings.enabled ? "#e5a68c" : "#52525b"}
            strokeWidth={eqSettings.enabled ? 2.5 : 1.5}
            strokeLinecap="round"
            filter={eqSettings.enabled ? "url(#glowEffect)" : undefined}
          />

          {bandPoints.map((pt) => {
            const isHovered = activeBandHover === pt.index;
            const isDragging = isDraggingBand === pt.index;
            const freqLabel =
              pt.freq >= 1000 ? `${pt.freq / 1000}k` : `${pt.freq}`;

            return (
              <g
                key={pt.freq}
                className="cursor-pointer"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (eqSettings.enabled) setIsDraggingBand(pt.index);
                }}
                onMouseEnter={() => setActiveBandHover(pt.index)}
                onMouseLeave={() => setActiveBandHover(null)}
              >
                {(isHovered || isDragging) && eqSettings.enabled && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="10"
                    fill="rgba(229, 166, 140, 0.25)"
                    className="animate-pulse"
                  />
                )}

                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered || isDragging ? 5.5 : 4}
                  fill={
                    !eqSettings.enabled
                      ? "#52525b"
                      : pt.bandVal > 0
                        ? "#e5a68c"
                        : pt.bandVal < 0
                          ? "#f43f5e"
                          : "#10b981"
                  }
                  stroke="#09090b"
                  strokeWidth="2"
                  className="transition-all duration-150"
                />

                <text
                  x={pt.x}
                  y={height - 2}
                  textAnchor="middle"
                  fill={isHovered ? "#ffffff" : "#71717a"}
                  fontSize="8.5"
                  fontFamily="monospace"
                  fontWeight={isHovered ? "bold" : "normal"}
                >
                  {freqLabel}
                </text>

                {(isHovered || isDragging) && eqSettings.enabled && (
                  <g>
                    <rect
                      x={pt.x - 20}
                      y={Math.max(2, pt.y - 20)}
                      width="40"
                      height="15"
                      rx="4"
                      fill="#18181b"
                      stroke="rgba(255,255,255,0.2)"
                    />
                    <text
                      x={pt.x}
                      y={Math.max(12, pt.y - 9)}
                      textAnchor="middle"
                      fill="#e5a68c"
                      fontSize="8.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {pt.bandVal > 0 ? `+${pt.bandVal}dB` : `${pt.bandVal}dB`}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {!eqSettings.enabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-mono text-[11px] font-bold text-zinc-500 bg-zinc-950/80 px-3 py-1 rounded-full border border-white/5 uppercase tracking-widest">
              Equalizer Bypassed (Flat Signal)
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/* Real post-volume browser FFT; Android uses the PCM RMS meter instead. */
const RealtimeSpectrumGraph: React.FC<{ eqSettings: EQSettings }> = () => (
  <div className="studio-fft">
    <div className="studio-fft-summary">
      <span>WEB AUDIO · POST-VOLUME FFT</span>
      <span>0 – {(audioEngine.getDspSampleRate() / 2000).toFixed(1)} kHz</span>
    </div>
    <div style={{ height: 140 }}>
      <AudioVisualizer mode="bars" isPlaying={!audioEngine.isPaused()} />
    </div>
    <small>Frequency display only; not a calibrated 31-band measurement.</small>
  </div>
);

export const EqualizerModal: React.FC<EqualizerModalProps> = ({
  isOpen,
  embedded = false,
  eqSettings,
  onUpdateEQ,
  onClose,
}) => {
  const [graphMode, setGraphMode] = useState<"control" | "spectrum">("control");
  const dialogRef = useDialogFocus(isOpen && !embedded, onClose);
  if (!isOpen) return null;
  const updateBand = (index: number, value: number) => {
    const bands = [...eqSettings.bands];
    bands[index] = value;
    onUpdateEQ({ ...eqSettings, bands, preset: "Custom" });
  };
  const selectPreset = (name: string) => {
    const preset = PRESETS[name];
    if (preset)
      onUpdateEQ({
        ...eqSettings,
        preset: name,
        bands: [...preset.bands],
        preamp: preset.preamp,
        bassBoost: preset.bass,
        trebleBoost: preset.treble,
      });
  };
  return (
    <div
      className={embedded ? "eq-embedded" : "dialog-backdrop eq-backdrop"}
      onClick={(e) => {
        if (!embedded && e.currentTarget === e.target) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="studio-equalizer"
        role={embedded ? undefined : "dialog"}
        aria-modal={embedded ? undefined : true}
        aria-label="Studio equalizer"
      >
        <div className="eq-heading">
          <div>
            <div className="eyebrow">CRAFT YOUR SIGNATURE SOUND</div>
            <h2>
              Studio equalizer<span>.</span>
            </h2>
            <p>A little warmth. A little clarity. Entirely your call.</p>
          </div>
          <div className="eq-heading-actions">
            <button
              className={`eq-power ${eqSettings.enabled ? "enabled" : ""}`}
              aria-pressed={eqSettings.enabled}
              onClick={() =>
                onUpdateEQ({ ...eqSettings, enabled: !eqSettings.enabled })
              }
            >
              <span /> {eqSettings.enabled ? "Processing on" : "Bypassed"}
            </button>
            {!embedded && (
              <button
                className="icon-button"
                aria-label="Close equalizer"
                onClick={onClose}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
        <div className="eq-presets">
          <label className="field-label">
            START WITH A PRESET
            <select
              aria-label="Equalizer preset"
              value={eqSettings.preset}
              onChange={(e) => selectPreset(e.target.value)}
            >
              {!PRESETS[eqSettings.preset] && (
                <option value={eqSettings.preset}>{eqSettings.preset}</option>
              )}
              {Object.keys(PRESETS).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <button
            className="text-back"
            onClick={() =>
              onUpdateEQ({
                ...eqSettings,
                preset: "Flat",
                bands: Array(10).fill(0),
                preamp: 0,
                bassBoost: 0,
                trebleBoost: 0,
                stereoWidth: 100,
                balance: 0,
                mono: false,
                autoHeadroom: true,
                peakProtection: true,
              })
            }
          >
            <RotateCcw size={13} /> Reset to flat
          </button>
        </div>
        <div className="eq-graph-header">
          <span className="eyebrow">
            {graphMode === "control" ? "ESTIMATED RESPONSE" : "LIVE SIGNAL"}
          </span>
          <div className="segmented-control">
            <button
              className={graphMode === "control" ? "selected" : ""}
              onClick={() => setGraphMode("control")}
            >
              Response
            </button>
            <button
              className={graphMode === "spectrum" ? "selected" : ""}
              onClick={() => setGraphMode("spectrum")}
            >
              {audioEngine.isNative() ? "RMS meters" : "Spectrum"}
            </button>
          </div>
        </div>
        <div className="eq-response">
          {graphMode === "control" ? (
            <EqualizerGraph eqSettings={eqSettings} onBandChange={updateBand} />
          ) : audioEngine.isNative() ? (
            <div style={{ height: 160 }}>
              <AudioVisualizer
                mode="vu-meter"
                isPlaying={!audioEngine.isPaused()}
              />
            </div>
          ) : (
            <RealtimeSpectrumGraph eqSettings={eqSettings} />
          )}
        </div>
        <StudioTools settings={eqSettings} onUpdate={onUpdateEQ} />
        <div
          className={`eq-band-section ${eqSettings.enabled ? "" : "bypassed"}`}
        >
          <div className="eq-db-scale">
            <span>+12</span>
            <span>0 dB</span>
            <span>−12</span>
          </div>
          <div className="eq-bands">
            {EQ_FREQUENCIES.map((freq, i) => (
              <label className="eq-band" key={freq}>
                <output>
                  {eqSettings.bands[i] > 0 ? "+" : ""}
                  {eqSettings.bands[i]}
                </output>
                <input
                  type="range"
                  aria-label={`${freq} Hz gain`}
                  min={-12}
                  max={12}
                  step={0.5}
                  disabled={!eqSettings.enabled}
                  value={eqSettings.bands[i]}
                  onChange={(e) => updateBand(i, Number(e.target.value))}
                />
                <span>
                  {freq >= 1000 ? `${freq / 1000}k` : freq}
                  <small>Hz</small>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="eq-effects">
          {(
            [
              { key: "preamp", label: "Preamp", min: -12, max: 12, unit: "dB" },
              {
                key: "bassBoost",
                label: "Bass warmth",
                min: 0,
                max: 100,
                unit: "%",
              },
              {
                key: "trebleBoost",
                label: "Treble clarity",
                min: 0,
                max: 100,
                unit: "%",
              },
              {
                key: "stereoWidth",
                label: "Stereo width",
                min: 0,
                max: 200,
                unit: "%",
              },
            ] as const
          ).map((effect) => (
            <label key={effect.key}>
              <span>
                {effect.label}
                <output>
                  {eqSettings[effect.key]} {effect.unit}
                </output>
              </span>
              <input
                aria-label={effect.label}
                disabled={!eqSettings.enabled}
                type="range"
                min={effect.min}
                max={effect.max}
                step={effect.key === "preamp" ? 0.5 : 1}
                value={eqSettings[effect.key]}
                onChange={(e) =>
                  onUpdateEQ({
                    ...eqSettings,
                    [effect.key]: Number(e.target.value),
                    preset: "Custom",
                  })
                }
              />
            </label>
          ))}
        </div>
        <p className="eq-footnote">
          <Volume2 size={12} /> Give your music room to breathe. Reduce preamp
          when boosting bands to avoid clipping.
        </p>
      </section>
    </div>
  );
};
