import type { EQSettings, StudioRackSettings } from "../types";

export function defaultStudioRack(): StudioRackSettings {
  return {
    enabled: false,
    highPassHz: 0,
    lowPassHz: 0,
    parametric: [120, 1000, 8000].map((frequency) => ({
      frequency,
      gain: 0,
      q: 1.4,
    })),
    outputTrimDb: 0,
    delayMs: 0,
    invertLeft: false,
    invertRight: false,
  };
}
export function cloneEQ(settings: EQSettings): EQSettings {
  return {
    ...settings,
    bands: [...settings.bands],
    ...(settings.rack
      ? {
          rack: {
            ...settings.rack,
            parametric: settings.rack.parametric.map((b) => ({ ...b })),
          },
        }
      : {}),
  };
}
export function rackActive(settings: EQSettings): boolean {
  return settings.enabled && !!settings.rack?.enabled;
}
export function rackTrim(settings: EQSettings): number {
  return rackActive(settings) ? settings.rack!.outputTrimDb : 0;
}
/** Manual tap estimate only. Long gaps restart the series, not a beat detector. */
export function tapTempo(
  previous: number[],
  now: number,
): { taps: number[]; bpm: number | null } {
  const gap = previous.length ? now - previous[previous.length - 1] : Infinity;
  if (gap < 200) return { taps: previous, bpm: estimate(previous) };
  const taps = gap > 2200 ? [now] : [...previous, now].slice(-9);
  return { taps, bpm: estimate(taps) };
}
function estimate(taps: number[]): number | null {
  return taps.length < 2
    ? null
    : Math.round(
        (600000 * (taps.length - 1)) / (taps[taps.length - 1] - taps[0]),
      ) / 10;
}
