import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  defaultStudioRack,
  cloneEQ,
  tapTempo,
  rackTrim,
} from "../src/services/studioRack";
import { eqSchema, settingsSchema } from "../src/services/backupSchema";
import {
  cutBiquad,
  eqCoefficients,
  responseDb,
  headroomDb,
} from "../src/services/dsp";
import { StudioRack } from "../src/components/StudioRack";
import type { EQSettings } from "../src/types";

const flat: EQSettings = {
  enabled: true,
  preset: "Flat",
  bands: Array(10).fill(0),
  preamp: 0,
  bassBoost: 0,
  trebleBoost: 0,
  stereoWidth: 100,
};
test("old EQ migrates to a bypassed neutral rack; invalid or unsafe system values are rejected", () => {
  const restored = eqSchema.parse(flat);
  assert.deepEqual(restored.rack, defaultStudioRack());
  for (const patch of [
    { highPassHz: 1 },
    { lowPassHz: 999 },
    { outputTrimDb: 1 },
    { delayMs: 101 },
    { delayMs: NaN },
    { parametric: [] },
    { parametric: [{ frequency: 1000, gain: 13, q: 0 }] },
  ]) {
    assert.equal(
      eqSchema.safeParse({
        ...flat,
        rack: { ...defaultStudioRack(), ...patch },
      }).success,
      false,
      JSON.stringify(patch),
    );
  }
  assert.equal(settingsSchema.shape.studioView.parse(undefined), "simple");
  assert.equal(
    settingsSchema.shape.studioView.safeParse("fake").success,
    false,
  );
});
test("12 dB/oct cuts have a -3 dB corner and attenuate the correct side", () => {
  for (const sr of [8000, 16000, 44100, 48000, 96000]) {
    for (const type of ["highpass", "lowpass"] as const) {
      const coefficients = [cutBiquad(type, 1000, sr)];
      assert.ok(Math.abs(responseDb(coefficients, 1000, sr) + 3.0103) < 0.001);
      assert.ok(
        responseDb(
          coefficients,
          type === "highpass" ? 100 : Math.min(sr * 0.49, 3000),
          sr,
        ) < -18,
      );
    }
  }
});
test("parametric Q changes bandwidth, gain is correct, bypass is neutral and headroom sees narrow boosts", () => {
  const rack = { ...defaultStudioRack(), enabled: true };
  rack.parametric[1] = { frequency: 1333, gain: 12, q: 12 };
  const boosted = { ...flat, rack };
  assert.ok(
    Math.abs(responseDb(eqCoefficients(boosted), 1333, 48000) - 12) < 1e-5,
  );
  assert.ok(headroomDb(boosted) > 12.99);
  const wide = cloneEQ(boosted);
  wide.rack!.parametric[1].q = 0.3;
  assert.ok(
    responseDb(eqCoefficients(wide), 2000, 48000) >
      responseDb(eqCoefficients(boosted), 2000, 48000) + 5,
  );
  assert.ok(
    Math.abs(
      responseDb(
        eqCoefficients({ ...boosted, rack: { ...rack, enabled: false } }),
        1333,
        48000,
      ),
    ) < 1e-6,
  );
  for (const sr of [8000, 16000, 48000, 192000])
    assert.ok(
      Number.isFinite(
        headroomDb(
          { ...boosted, rack: { ...rack, highPassHz: 1000, lowPassHz: 20000 } },
          sr,
        ),
      ),
    );
  assert.equal(
    rackTrim({ ...flat, rack: { ...rack, outputTrimDb: -12 } }),
    -12,
  );
  assert.equal(
    rackTrim({ ...flat, enabled: false, rack: { ...rack, outputTrimDb: -12 } }),
    0,
  );
});
test("A/B snapshots deeply isolate rack bands, import/export retains complete processing", () => {
  const original = {
    ...flat,
    rack: {
      ...defaultStudioRack(),
      enabled: true,
      delayMs: 24.5,
      invertLeft: true,
    },
  };
  const snapshot = cloneEQ(original);
  snapshot.rack!.parametric[0].gain = -6;
  snapshot.bands[0] = 6;
  assert.equal(original.rack.parametric[0].gain, 0);
  assert.equal(original.bands[0], 0);
  const roundTrip = eqSchema.parse(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(roundTrip.rack, original.rack);
});
test("manual tap BPM estimates intervals, ignores accidental double taps, restarts after silence", () => {
  let result = tapTempo([], 1000);
  assert.equal(result.bpm, null);
  for (const time of [1500, 2000, 2500, 3000])
    result = tapTempo(result.taps, time);
  assert.equal(result.bpm, 120);
  assert.deepEqual(tapTempo(result.taps, 3050).taps, result.taps);
  assert.equal(tapTempo(result.taps, 6000).bpm, null);
});
test("system rack is accessible, bounded, bypassed by default and not mislabeled as calibrated protection", () => {
  const html = renderToStaticMarkup(
    React.createElement(StudioRack, { settings: flat, onUpdate() {} }),
  );
  assert.ok(html.includes('aria-label="Enable system rack"'));
  assert.ok(html.includes('aria-label="PEQ 3 Q exact"'));
  assert.ok(html.includes('aria-label="System delay"'));
  assert.ok(html.includes("Invert Left polarity"));
  assert.ok(html.includes('disabled=""'));
  assert.ok(html.includes("not speaker crossovers"));
});
