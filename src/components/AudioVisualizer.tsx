import React, { useEffect, useRef } from "react";
import { audioEngine } from "../services/audioEngine";
import { dbfs } from "../services/dsp";
import type { VisualizerMode } from "../types";

interface AudioVisualizerProps {
  mode: VisualizerMode;
  isPlaying: boolean;
  className?: string;
  accentColor?: string;
}
export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  mode,
  isPlaying,
  className = "",
  accentColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current,
      context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const ctx = context;
    const frequency = new Uint8Array(256),
      waveform = new Uint8Array(512);
    let frame = 0,
      last = 0,
      left = 0,
      right = 0,
      settle = 45;
    let width = 0,
      height = 0;
    const render = (now = performance.now()) => {
      const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000 || 0.033));
      last = now;
      if (!document.hidden && width && height) {
        const color =
          accentColor ||
          getComputedStyle(canvas).getPropertyValue("--accent").trim() ||
          "#e5a68c";
        const meter = audioEngine.getMeterLevels();
        const targetL = isPlaying ? meter.left : 0,
          targetR = isPlaying ? meter.right : 0;
        left +=
          (targetL - left) *
          (1 - Math.exp(-dt / (targetL > left ? 0.055 : 0.32)));
        right +=
          (targetR - right) *
          (1 - Math.exp(-dt / (targetR > right ? 0.055 : 0.32)));
        ctx.clearRect(0, 0, width, height);
        const effectiveMode = audioEngine.isNative() ? "vu-meter" : mode;
        if (effectiveMode === "vu-meter") {
          const gap = 10,
            mw = (width - gap) / 2;
          const draw = (x: number, label: string, rms: number) => {
            ctx.save();
            ctx.translate(x, 0);
            const face = ctx.createLinearGradient(0, 0, 0, height);
            face.addColorStop(0, "#232326");
            face.addColorStop(1, "#121315");
            ctx.fillStyle = face;
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.roundRect(0.5, 0.5, mw - 1, height - 1, 10);
            ctx.fill();
            ctx.globalAlpha = 0.35;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.fillStyle = color;
            ctx.textAlign = "center";
            ctx.font = `500 ${mw < 150 ? 8 : 10}px monospace`;
            ctx.fillText(`${label} · RMS dBFS`, mw / 2, 20);
            const cx = mw / 2,
              cy = height * 0.78,
              r = Math.min(mw * 0.48, height * 0.53);
            const start = Math.PI * 1.13,
              range = Math.PI * 0.74;
            ctx.strokeStyle = "#ffffff35";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, r, start, start + range);
            ctx.stroke();
            for (const tick of [-60, -36, -24, -12, -6, 0]) {
              const angle = start + ((tick + 60) / 60) * range;
              ctx.strokeStyle = tick >= -6 ? "#e88273" : "#ffffff65";
              ctx.beginPath();
              ctx.moveTo(
                cx + Math.cos(angle) * (r - 5),
                cy + Math.sin(angle) * (r - 5),
              );
              ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
              ctx.stroke();
              if (mw >= 140) {
                ctx.fillStyle = "#c2bdba";
                ctx.font = "8px monospace";
                ctx.fillText(
                  String(tick),
                  cx + Math.cos(angle) * (r + 10),
                  cy + Math.sin(angle) * (r + 10),
                );
              }
            }
            const angle =
              start + Math.min(1, Math.max(0, (dbfs(rms) + 60) / 60)) * range;
            ctx.strokeStyle = meter.overloaded ? "#ed8575" : color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(
              cx + Math.cos(angle) * (r - 9),
              cy + Math.sin(angle) * (r - 9),
            );
            ctx.stroke();
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = "10px monospace";
            ctx.fillText(
              rms < 0.001 ? "−∞" : dbfs(rms).toFixed(1),
              cx,
              height - 12,
            );
            ctx.restore();
          };
          draw(0, "LEFT", left);
          draw(mw + gap, "RIGHT", right);
        } else {
          audioEngine.getAnalyserData(frequency, waveform);
          ctx.strokeStyle = color;
          ctx.fillStyle = color;
          ctx.lineWidth = 2;
          if (effectiveMode === "wave") {
            ctx.beginPath();
            waveform.forEach((value, i) => {
              const x = (i / (waveform.length - 1)) * width,
                y = height / 2 + ((value - 128) / 128) * height * 0.45;
              if (i) ctx.lineTo(x, y);
              else ctx.moveTo(x, y);
            });
            ctx.stroke();
          } else if (effectiveMode === "nebula") {
            const radius = Math.min(width, height) * 0.25;
            ctx.beginPath();
            for (let i = 0; i <= 96; i++) {
              const angle = (i / 96) * Math.PI * 2,
                r = radius * (1 + (frequency[i % 96] / 255) * 0.8),
                x = width / 2 + Math.cos(angle) * r,
                y = height / 2 + Math.sin(angle) * r;
              if (i) ctx.lineTo(x, y);
              else ctx.moveTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
          } else {
            const count = effectiveMode === "31-band" ? 31 : 48,
              bw = width / count;
            for (let i = 0; i < count; i++) {
              const value = isPlaying
                ? frequency[
                    Math.floor((i / count) ** 2 * (frequency.length - 1))
                  ] / 255
                : 0;
              const h = Math.max(1, value * height * 0.9);
              ctx.globalAlpha = 0.35 + value * 0.65;
              ctx.fillRect(i * bw + 1, height - h, Math.max(1, bw - 3), h);
            }
            ctx.globalAlpha = 1;
          }
        }
      }
      if (isPlaying || settle-- > 0) frame = requestAnimationFrame(render);
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect(),
        ratio = Math.min(2, window.devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      cancelAnimationFrame(frame);
      settle = 45;
      frame = requestAnimationFrame(render);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    const themeObserver = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      settle = 45;
      frame = requestAnimationFrame(render);
    });
    const app = canvas.closest(".aether-app");
    if (app)
      themeObserver.observe(app, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    return () => {
      observer.disconnect();
      themeObserver.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [mode, isPlaying, accentColor]);
  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        role="img"
        aria-label={
          mode === "vu-meter" || audioEngine.isNative()
            ? "Analog stereo VU meters · measured RMS in dBFS"
            : "Live audio visualization"
        }
      />
    </div>
  );
};
