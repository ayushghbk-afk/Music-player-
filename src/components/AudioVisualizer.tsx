import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';
import { VisualizerMode } from '../types';

interface AudioVisualizerProps {
  mode: VisualizerMode;
  isPlaying: boolean;
  className?: string;
  accentColor?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  mode,
  isPlaying,
  className = '',
  accentColor = '#38bdf8', // Sky Blue default
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const freqArray = new Uint8Array(128);
    const timeDomainArray = new Uint8Array(128);

    const render = () => {
      audioEngine.getAnalyserData(freqArray, timeDomainArray);

      // Handle high-DPI canvases
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (mode === 'bars') {
        // Glowing Frequency Bars
        const barCount = 48;
        const barWidth = (width / barCount) * 0.7;
        const gap = (width / barCount) * 0.3;

        for (let i = 0; i < barCount; i++) {
          const val = freqArray[i % freqArray.length] / 255;
          const barHeight = val * (height * 0.85);

          const x = i * (barWidth + gap);
          const y = height - barHeight;

          const gradient = ctx.createLinearGradient(0, height, 0, 0);
          gradient.addColorStop(0, accentColor);
          gradient.addColorStop(0.7, '#818cf8');
          gradient.addColorStop(1, '#c084fc');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
          ctx.fill();

          // Peak light cap
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, Math.max(0, y - 3), barWidth, 2);
        }
      } else if (mode === 'wave') {
        // Oscilloscope Waveform
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = accentColor;
        ctx.shadowBlur = 12;
        ctx.shadowColor = accentColor;

        ctx.beginPath();
        const sliceWidth = width / timeDomainArray.length;
        let x = 0;

        for (let i = 0; i < timeDomainArray.length; i++) {
          const v = timeDomainArray[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (mode === 'nebula') {
        // Circular Spectrum Nebula
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(centerX, centerY) * 0.45;

        const points = 64;
        const angleStep = (Math.PI * 2) / points;

        ctx.save();
        ctx.translate(centerX, centerY);

        // Core glow
        const radGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, radius * 1.5);
        radGrad.addColorStop(0, `${accentColor}33`);
        radGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 15;
        ctx.shadowColor = accentColor;

        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
          const val = freqArray[i % freqArray.length] / 255;
          const r = radius + val * 45;
          const angle = i * angleStep;
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
        ctx.shadowBlur = 0;
      } else if (mode === '31-band') {
        // High-Density 31-Band Studio RTA
        const bands = 31;
        const bWidth = width / bands;

        for (let i = 0; i < bands; i++) {
          const val = freqArray[Math.floor((i / bands) * freqArray.length)] / 255;
          const bHeight = val * (height * 0.9);

          const x = i * bWidth;
          const y = height - bHeight;

          // Band bar background
          ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.fillRect(x + 2, 0, bWidth - 4, height);

          // LED segment block effect
          const segmentCount = 16;
          const segHeight = height / segmentCount;
          const activeSegments = Math.floor(val * segmentCount);

          for (let s = 0; s < activeSegments; s++) {
            const segY = height - (s + 1) * segHeight;
            let col = accentColor;
            if (s > 13) col = '#ef4444'; // Red clip warning
            else if (s > 10) col = '#f59e0b'; // Amber warm

            ctx.fillStyle = col;
            ctx.fillRect(x + 3, segY + 1, bWidth - 6, segHeight - 2);
          }
        }
      } else if (mode === 'vu-meter') {
        // Vintage Dual Needle VU Meters
        const meterWidth = width / 2 - 10;
        const drawVUMeter = (ox: number, title: string, level: number) => {
          ctx.save();
          ctx.translate(ox, 0);

          // Meter face plate
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(0, 0, meterWidth, height, 8);
          ctx.fill();
          ctx.stroke();

          // Scale Arc
          const cx = meterWidth / 2;
          const cy = height + 10;
          const r = height * 0.85;

          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, r, Math.PI * 1.25, Math.PI * 1.75);
          ctx.stroke();

          // Label
          ctx.fillStyle = '#64748b';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(title, cx, 20);

          // Needle angle calculation
          const targetAngle = Math.PI * 1.25 + level * (Math.PI * 0.5);
          const nx = cx + Math.cos(targetAngle) * (r - 10);
          const ny = cy + Math.sin(targetAngle) * (r - 10);

          ctx.strokeStyle = level > 0.85 ? '#ef4444' : '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.shadowBlur = level > 0.85 ? 8 : 0;
          ctx.shadowColor = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(cx, cy - 10);
          ctx.lineTo(nx, ny);
          ctx.stroke();

          ctx.restore();
        };

        const leftAvg = (freqArray[5] + freqArray[10] + freqArray[15]) / (3 * 255);
        const rightAvg = (freqArray[8] + freqArray[18] + freqArray[28]) / (3 * 255);

        drawVUMeter(0, 'LEFT CHANNEL (CH-1)', leftAvg);
        drawVUMeter(width / 2 + 10, 'RIGHT CHANNEL (CH-2)', rightAvg);
      }

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [mode, isPlaying, accentColor]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
