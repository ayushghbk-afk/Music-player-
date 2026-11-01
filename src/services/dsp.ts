import type { EQSettings } from "../types";

export const EQ_FREQUENCIES = [
  31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
];
export type Coefficients = [number, number, number, number, number];

/** RBJ peaking / constant-slope shelves; shared by the graph and headroom estimate. */
export function biquad(
  frequency: number,
  gain: number,
  sampleRate: number,
  shelf?: "low" | "high",
): Coefficients {
  const a = 10 ** (gain / 40),
    w = (2 * Math.PI * Math.min(sampleRate * 0.45, frequency)) / sampleRate;
  const c = Math.cos(w),
    s = Math.sin(w),
    alpha = s / (2 * 1.4);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (!shelf) {
    b0 = 1 + alpha * a;
    b1 = -2 * c;
    b2 = 1 - alpha * a;
    a0 = 1 + alpha / a;
    a1 = -2 * c;
    a2 = 1 - alpha / a;
  } else {
    const r = (2 * Math.sqrt(a) * s) / Math.SQRT2;
    if (shelf === "low") {
      b0 = a * (a + 1 - (a - 1) * c + r);
      b1 = 2 * a * (a - 1 - (a + 1) * c);
      b2 = a * (a + 1 - (a - 1) * c - r);
      a0 = a + 1 + (a - 1) * c + r;
      a1 = -2 * (a - 1 + (a + 1) * c);
      a2 = a + 1 + (a - 1) * c - r;
    } else {
      b0 = a * (a + 1 + (a - 1) * c + r);
      b1 = -2 * a * (a - 1 + (a + 1) * c);
      b2 = a * (a + 1 + (a - 1) * c - r);
      a0 = a + 1 - (a - 1) * c + r;
      a1 = 2 * (a - 1 - (a + 1) * c);
      a2 = a + 1 - (a - 1) * c - r;
    }
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
export function responseDb(
  coefficients: Coefficients[],
  frequency: number,
  sampleRate: number,
): number {
  const w = (2 * Math.PI * frequency) / sampleRate,
    c = Math.cos(w),
    s = Math.sin(w),
    c2 = Math.cos(2 * w),
    s2 = Math.sin(2 * w);
  return coefficients.reduce((db, [b0, b1, b2, a1, a2]) => {
    const n = (b0 + b1 * c + b2 * c2) ** 2 + (b1 * s + b2 * s2) ** 2;
    const d = (1 + a1 * c + a2 * c2) ** 2 + (a1 * s + a2 * s2) ** 2;
    return db + 10 * Math.log10(Math.max(1e-20, n / d));
  }, 0);
}
export function eqCoefficients(
  eq: EQSettings,
  sampleRate = 48000,
): Coefficients[] {
  return [
    ...EQ_FREQUENCIES.map((f, i) => biquad(f, eq.bands[i] || 0, sampleRate)),
    biquad(100, eq.bassBoost * 0.12, sampleRate, "low"),
    biquad(8000, eq.trebleBoost * 0.12, sampleRate, "high"),
  ];
}
/** Frequency-response estimate + stereo matrix bound + 1 dB margin; not ReplayGain or true-peak analysis. */
export function headroomDb(eq: EQSettings, sampleRate = 48000): number {
  if (!eq.enabled || eq.autoHeadroom === false) return 0;
  const coefficients = eqCoefficients(eq, sampleRate);
  let peak = -Infinity;
  for (let i = 0; i <= 256; i++) {
    const frequency =
      10 * (Math.min(22000, sampleRate * 0.49) / 10) ** (i / 256);
    peak = Math.max(peak, responseDb(coefficients, frequency, sampleRate));
  }
  const width = eq.mono ? 1 : Math.max(1, eq.stereoWidth / 100);
  return Math.max(0, peak + eq.preamp + 20 * Math.log10(width) + 1);
}
export const dbfs = (amplitude: number): number =>
  Math.max(-60, 20 * Math.log10(Math.max(1e-6, amplitude)));
