import React, { useEffect, useRef, useState } from 'react';
import { Sliders, Zap, RotateCcw, Volume2, Sparkles, X, Activity, BarChart2, Layers } from 'lucide-react';
import { EQSettings } from '../types';
import { audioEngine, EQ_FREQUENCIES } from '../services/audioEngine';

interface EqualizerModalProps {
  isOpen: boolean;
  eqSettings: EQSettings;
  onUpdateEQ: (settings: EQSettings) => void;
  onClose: () => void;
}

const PRESETS: Record<string, { bands: number[]; preamp: number; bass: number; treble: number }> = {
  'Audiophile Neutral': { bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], preamp: 0, bass: 0, treble: 0 },
  'Acoustic': { bands: [3, 2, 1, 0, 1, 2, 3, 2, 2, 3], preamp: 1, bass: 10, treble: 20 },
  'Bass Booster': { bands: [8, 6, 5, 3, 1, 0, 0, 0, 0, 0], preamp: -2, bass: 60, treble: 0 },
  'Vocal Boost': { bands: [-2, -1, 0, 3, 5, 4, 3, 2, 0, -1], preamp: 0, bass: 0, treble: 10 },
  'Electronic': { bands: [5, 4, 2, 0, -2, 2, 1, 3, 5, 6], preamp: -1, bass: 40, treble: 30 },
  'Jazz Master': { bands: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3], preamp: 0, bass: 15, treble: 20 },
  'Rock & Roll': { bands: [5, 3, 2, 0, -1, 0, 2, 3, 4, 5], preamp: -1, bass: 30, treble: 25 },
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

  const bandPoints = EQ_FREQUENCIES.map((freq, i) => {
    const x = paddingX + (i / 9) * graphWidth;
    const bandVal = eqSettings.bands[i] || 0;
    const preampVal = eqSettings.preamp || 0;

    let bassContrib = 0;
    if (i === 0) bassContrib = (eqSettings.bassBoost / 100) * 5;
    else if (i === 1) bassContrib = (eqSettings.bassBoost / 100) * 3.5;
    else if (i === 2) bassContrib = (eqSettings.bassBoost / 100) * 1.8;

    let trebleContrib = 0;
    if (i === 9) trebleContrib = (eqSettings.trebleBoost / 100) * 5;
    else if (i === 8) trebleContrib = (eqSettings.trebleBoost / 100) * 3.5;
    else if (i === 7) trebleContrib = (eqSettings.trebleBoost / 100) * 1.8;

    const netDb = eqSettings.enabled ? bandVal + preampVal + bassContrib + trebleContrib : 0;
    const clampedDb = Math.max(-18, Math.min(18, netDb));
    const y = centerY - (clampedDb / 18) * (graphHeight / 2);

    return { x, y, bandVal, netDb, freq, index: i };
  });

  const getSmoothPath = (pts: typeof bandPoints) => {
    if (pts.length === 0) return '';
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
    if (isDraggingBand === null || !svgRef.current || !eqSettings.enabled) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientY = e.clientY - rect.top;

    const normalizedY = (clientY - (rect.height * paddingY) / height) / ((rect.height * graphHeight) / height);
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
          <span className="font-bold text-white uppercase tracking-wider text-[10px]">DSP Response Curve</span>
          <span
            className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${
              eqSettings.enabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-zinc-800 text-zinc-500 border-zinc-700'
            }`}
          >
            {eqSettings.enabled ? 'ACTIVE GRAPH' : 'BYPASSED'}
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
              <stop offset="0%" stopColor="#10b981" stopOpacity={eqSettings.enabled ? 0.45 : 0.05} />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity={eqSettings.enabled ? 0.2 : 0.02} />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </linearGradient>

            <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
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
                stroke={db === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)'}
                strokeDasharray={db === 0 ? 'none' : '3 3'}
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
            stroke={eqSettings.enabled ? '#38bdf8' : '#52525b'}
            strokeWidth={eqSettings.enabled ? 2.5 : 1.5}
            strokeLinecap="round"
            filter={eqSettings.enabled ? 'url(#glowEffect)' : undefined}
          />

          {bandPoints.map((pt) => {
            const isHovered = activeBandHover === pt.index;
            const isDragging = isDraggingBand === pt.index;
            const freqLabel = pt.freq >= 1000 ? `${pt.freq / 1000}k` : `${pt.freq}`;

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
                    fill="rgba(56, 189, 248, 0.25)"
                    className="animate-pulse"
                  />
                )}

                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered || isDragging ? 5.5 : 4}
                  fill={
                    !eqSettings.enabled
                      ? '#52525b'
                      : pt.bandVal > 0
                      ? '#38bdf8'
                      : pt.bandVal < 0
                      ? '#f43f5e'
                      : '#10b981'
                  }
                  stroke="#09090b"
                  strokeWidth="2"
                  className="transition-all duration-150"
                />

                <text
                  x={pt.x}
                  y={height - 2}
                  textAnchor="middle"
                  fill={isHovered ? '#ffffff' : '#71717a'}
                  fontSize="8.5"
                  fontFamily="monospace"
                  fontWeight={isHovered ? 'bold' : 'normal'}
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
                      fill="#38bdf8"
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

/* Realtime Audio Spectrum Analyzer Graph Component */
const RealtimeSpectrumGraph: React.FC<{ eqSettings: EQSettings }> = ({ eqSettings }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const freqArray = new Uint8Array(64);
    const timeDomainArray = new Uint8Array(64);
    let animationFrameId: number;

    const render = () => {
      audioEngine.getAnalyserData(freqArray, timeDomainArray);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let y = 20; y < height - 10; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw 32 Spectrum Frequency Bars
      const barCount = 32;
      const paddingX = 25;
      const graphW = width - paddingX * 2;
      const barW = (graphW / barCount) * 0.7;
      const gap = (graphW / barCount) * 0.3;

      for (let i = 0; i < barCount; i++) {
        const rawVal = freqArray[i % freqArray.length] / 255;
        const barH = Math.max(3, rawVal * (height - 35));
        const x = paddingX + i * (barW + gap);
        const y = height - 18 - barH;

        const grad = ctx.createLinearGradient(0, height, 0, 0);
        grad.addColorStop(0, '#10b981');
        grad.addColorStop(0.5, '#38bdf8');
        grad.addColorStop(1, '#a855f7');

        ctx.fillStyle = eqSettings.enabled ? grad : 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
        ctx.fill();

        // Top peak indicator light
        ctx.fillStyle = eqSettings.enabled ? '#ffffff' : '#71717a';
        ctx.fillRect(x, Math.max(2, y - 3), barW, 2);
      }

      // Live Envelope Curve Overlay
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = eqSettings.enabled ? '#38bdf8' : '#52525b';
      for (let i = 0; i < barCount; i++) {
        const rawVal = freqArray[i % freqArray.length] / 255;
        const barH = Math.max(3, rawVal * (height - 35));
        const x = paddingX + i * (barW + gap) + barW / 2;
        const y = height - 18 - barH;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [eqSettings.enabled]);

  return (
    <div className="bg-zinc-950/90 rounded-2xl border border-white/10 p-3 shadow-inner space-y-1 relative overflow-hidden select-none">
      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 px-1">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="font-bold text-white uppercase tracking-wider text-[10px]">Real-Time Spectrum Analyzer</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            FFT LIVE MONITOR
          </span>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono text-zinc-400">
          <span>20 Hz</span>
          <span>1 kHz</span>
          <span>20 kHz</span>
        </div>
      </div>

      <div className="relative w-full h-32">
        <canvas
          ref={canvasRef}
          width={600}
          height={140}
          className="w-full h-full block rounded-xl"
        />
      </div>
    </div>
  );
};

/* Custom Studio Touch & Drag Vertical Band Slider Component */
const VerticalBandSlider: React.FC<{
  freq: number;
  val: number;
  disabled: boolean;
  onChange: (val: number) => void;
}> = ({ freq, val, disabled, onChange }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const freqLabel = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;

  // Normalized value from 0 (-12dB) to 1 (+12dB)
  const norm = (val + 12) / 24;
  const percentFromTop = (1 - norm) * 100;

  const calculateDbFromPointer = (clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const clampedY = Math.max(0, Math.min(rect.height, relativeY));
    const ratio = 1 - clampedY / rect.height;
    const rawDb = -12 + ratio * 24;
    const roundedDb = Math.round(rawDb * 2) / 2;
    onChange(Math.max(-12, Math.min(12, roundedDb)));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    calculateDbFromPointer(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || disabled) return;
    calculateDbFromPointer(e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
      setIsDragging(false);
    }
  };

  return (
    <div className="flex flex-col items-center h-full justify-between select-none group px-0.5">
      {/* dB Value Badge */}
      <span
        className={`text-[10px] font-mono font-bold transition-colors ${
          disabled
            ? 'text-zinc-600'
            : val > 0
            ? 'text-sky-400'
            : val < 0
            ? 'text-rose-400'
            : 'text-zinc-400'
        }`}
      >
        {val > 0 ? `+${val}` : val}
      </span>

      {/* Interactive Vertical Slider Track */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative w-6 sm:w-7 h-36 rounded-xl bg-zinc-950/90 border border-white/10 flex items-center justify-center cursor-pointer touch-none transition-all ${
          disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-sky-500/50 hover:bg-zinc-900'
        }`}
      >
        {/* Center 0dB Reference Line */}
        <div className="absolute top-1/2 left-1 right-1 h-0.5 bg-zinc-700/80 pointer-events-none z-0" />

        {/* Center Vertical Track Slot */}
        <div className="absolute top-2 bottom-2 w-1.5 bg-zinc-800 rounded-full overflow-hidden pointer-events-none">
          {/* Active Fill Bar from 0dB */}
          {val !== 0 && (
            <div
              className={`absolute w-full rounded-full transition-all duration-75 ${
                val > 0 ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]' : 'bg-rose-400'
              }`}
              style={{
                top: val > 0 ? `${percentFromTop}%` : '50%',
                bottom: val > 0 ? '50%' : `${100 - percentFromTop}%`,
              }}
            />
          )}
        </div>

        {/* Floating Thumb Handle */}
        <div
          className={`absolute w-5 sm:w-6 h-5 rounded-lg border flex items-center justify-center transition-all duration-75 z-10 shadow-md ${
            isDragging
              ? 'bg-sky-400 border-white text-black scale-110 shadow-[0_0_12px_rgba(56,189,248,0.8)]'
              : val !== 0
              ? 'bg-zinc-800 border-sky-400/80 text-sky-300'
              : 'bg-zinc-800 border-zinc-600 text-zinc-400'
          }`}
          style={{
            top: `calc(${percentFromTop}% - 10px)`,
          }}
        >
          {/* Grip lines */}
          <div className="flex gap-0.5">
            <div className={`w-0.5 h-2 rounded-full ${isDragging ? 'bg-black' : 'bg-white/40'}`} />
            <div className={`w-0.5 h-2 rounded-full ${isDragging ? 'bg-black' : 'bg-white/40'}`} />
          </div>
        </div>
      </div>

      {/* Frequency Label */}
      <span className="text-[10px] font-mono text-zinc-400 font-medium group-hover:text-white transition-colors">
        {freqLabel}
      </span>
    </div>
  );
};

export const EqualizerModal: React.FC<EqualizerModalProps> = ({
  isOpen,
  eqSettings,
  onUpdateEQ,
  onClose,
}) => {
  const [graphMode, setGraphMode] = useState<'control' | 'spectrum' | 'split'>('split');

  if (!isOpen) return null;

  const handleBandChange = (idx: number, val: number) => {
    const newBands = [...eqSettings.bands];
    newBands[idx] = val;
    onUpdateEQ({
      ...eqSettings,
      bands: newBands,
      preset: 'Custom',
    });
  };

  const handleSelectPreset = (name: string) => {
    const p = PRESETS[name];
    if (p) {
      onUpdateEQ({
        ...eqSettings,
        preset: name,
        bands: [...p.bands],
        preamp: p.preamp,
        bassBoost: p.bass,
        trebleBoost: p.treble,
      });
    }
  };

  const handleReset = () => {
    handleSelectPreset('Audiophile Neutral');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="bg-zinc-950 border border-white/10 rounded-3xl p-4 sm:p-6 w-full max-w-2xl shadow-2xl space-y-5 animate-fadeIn select-none max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Studio 10-Band Graphic EQ</h2>
              <p className="text-[11px] text-zinc-400 font-mono">Precision DSP & Harmonic Tuning</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Toggle On/Off Switch */}
            <button
              onClick={() => onUpdateEQ({ ...eqSettings, enabled: !eqSettings.enabled })}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all border ${
                eqSettings.enabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-md'
                  : 'bg-zinc-900 text-zinc-500 border-zinc-800'
              }`}
            >
              {eqSettings.enabled ? 'EQ ACTIVE' : 'EQ BYPASSED'}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Presets Row */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] font-mono text-zinc-500 uppercase flex-shrink-0">Presets:</span>
          <div className="flex items-center gap-1.5">
            {Object.keys(PRESETS).map((name) => (
              <button
                key={name}
                onClick={() => handleSelectPreset(name)}
                className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border transition-all flex-shrink-0 ${
                  eqSettings.preset === name
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold'
                    : 'bg-zinc-900 text-zinc-400 border-white/5 hover:text-white'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Graph Mode Selection Tabs */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <span className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            DSP Visualizer Graphs
          </span>
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setGraphMode('control')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
                graphMode === 'control'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Activity className="w-3 h-3" />
              Control Curve
            </button>
            <button
              onClick={() => setGraphMode('spectrum')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
                graphMode === 'spectrum'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <BarChart2 className="w-3 h-3" />
              Live Spectrum
            </button>
            <button
              onClick={() => setGraphMode('split')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
                graphMode === 'split'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Layers className="w-3 h-3" />
              Dual View
            </button>
          </div>
        </div>

        {/* Dynamic Graph Views */}
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {(graphMode === 'control' || graphMode === 'split') && (
            <EqualizerGraph eqSettings={eqSettings} onBandChange={handleBandChange} />
          )}
          {(graphMode === 'spectrum' || graphMode === 'split') && (
            <RealtimeSpectrumGraph eqSettings={eqSettings} />
          )}
        </div>

        {/* 10-Band Sliders Console Board */}
        <div className="bg-zinc-900/80 p-3 sm:p-4 rounded-2xl border border-white/10 space-y-2">
          <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 px-1 border-b border-white/5 pb-1.5">
            <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1">
              <Sliders className="w-3 h-3 text-sky-400" />
              10-Band EQ Frequencies
            </span>
            <div className="flex items-center gap-3">
              <span className="text-sky-400">+12 dB</span>
              <span className="text-zinc-500">0 dB</span>
              <span className="text-rose-400">-12 dB</span>
            </div>
          </div>

          <div className="overflow-x-auto pb-1 pt-1">
            <div className="grid grid-cols-10 min-w-[500px] sm:min-w-0 gap-1 sm:gap-2 h-52 items-center">
              {EQ_FREQUENCIES.map((freq, idx) => {
                const val = eqSettings.bands[idx] || 0;
                return (
                  <VerticalBandSlider
                    key={freq}
                    freq={freq}
                    val={val}
                    disabled={!eqSettings.enabled}
                    onChange={(newVal) => handleBandChange(idx, newVal)}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Additional DSP Sliders (Preamp, Bass Boost, Treble Boost) */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-900/60 p-3 rounded-xl border border-white/5 space-y-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-zinc-400">Preamp Gain</span>
              <span className="text-sky-400 font-bold">{eqSettings.preamp} dB</span>
            </div>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              disabled={!eqSettings.enabled}
              value={eqSettings.preamp}
              onChange={(e) =>
                onUpdateEQ({ ...eqSettings, preamp: parseFloat(e.target.value), preset: 'Custom' })
              }
              className="w-full h-1 bg-zinc-800 appearance-none rounded-lg accent-sky-400 disabled:opacity-30"
            />
          </div>

          <div className="bg-zinc-900/60 p-3 rounded-xl border border-white/5 space-y-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-zinc-400">Sub-Bass Boost</span>
              <span className="text-sky-400 font-bold">{eqSettings.bassBoost}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              disabled={!eqSettings.enabled}
              value={eqSettings.bassBoost}
              onChange={(e) =>
                onUpdateEQ({ ...eqSettings, bassBoost: parseFloat(e.target.value), preset: 'Custom' })
              }
              className="w-full h-1 bg-zinc-800 appearance-none rounded-lg accent-sky-400 disabled:opacity-30"
            />
          </div>

          <div className="bg-zinc-900/60 p-3 rounded-xl border border-white/5 space-y-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-zinc-400">Treble Clarity</span>
              <span className="text-sky-400 font-bold">{eqSettings.trebleBoost}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              disabled={!eqSettings.enabled}
              value={eqSettings.trebleBoost}
              onChange={(e) =>
                onUpdateEQ({ ...eqSettings, trebleBoost: parseFloat(e.target.value), preset: 'Custom' })
              }
              className="w-full h-1 bg-zinc-800 appearance-none rounded-lg accent-sky-400 disabled:opacity-30"
            />
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex justify-between items-center pt-2">
          <button
            onClick={handleReset}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Neutral
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs shadow-md"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
