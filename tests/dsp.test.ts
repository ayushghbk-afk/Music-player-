import test from "node:test";
import assert from "node:assert/strict";
import { eqSchema, settingsSchema } from "../src/services/backupSchema";
import {
  biquad,
  dbfs,
  eqCoefficients,
  headroomDb,
  responseDb,
} from "../src/services/dsp";
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
test("RBJ filters have unity flat response and requested center/shelf gains", () => {
  for (const frequency of [31, 250, 1000, 8000, 16000])
    assert.ok(
      Math.abs(responseDb(eqCoefficients(flat), frequency, 48000)) < 1e-6,
    );
  assert.ok(
    Math.abs(responseDb([biquad(1000, 6, 48000)], 1000, 48000) - 6) < 1e-6,
  );
  assert.ok(responseDb([biquad(100, 12, 48000, "low")], 10, 48000) > 11.9);
});
test("headroom compensates combined EQ, preamp and width with a safety margin", () => {
  assert.ok(Math.abs(headroomDb(flat) - 1) < 1e-5);
  const boosted = {
    ...flat,
    bands: Array(10).fill(12),
    preamp: 12,
    bassBoost: 100,
    trebleBoost: 100,
    stereoWidth: 200,
  };
  const reduction = headroomDb(boosted),
    coefficients = eqCoefficients(boosted);
  assert.ok(reduction > 25 && reduction < 60);
  for (let i = 0; i < 1000; i++) {
    const frequency = 10 * 2200 ** (i / 999);
    assert.ok(
      responseDb(coefficients, frequency, 48000) +
        12 +
        20 * Math.log10(2) -
        reduction <
        -0.9,
    );
  }
  assert.equal(headroomDb({ ...boosted, enabled: false }), 0);
  assert.equal(headroomDb({ ...boosted, autoHeadroom: false }), 0);
  assert.ok(headroomDb({ ...boosted, mono: true }) < reduction - 5.9);
});
test("DSP remains finite at common input rates including clamped low sample rates", () => {
  for (const rate of [8000, 16000, 22050, 44100, 48000, 96000, 192000])
    assert.ok(
      Number.isFinite(
        headroomDb(
          { ...flat, bands: Array(10).fill(12), bassBoost: 100 },
          rate,
        ),
      ),
    );
  assert.equal(dbfs(0), -60);
  assert.equal(dbfs(1), 0);
  assert.ok(Math.abs(dbfs(0.5) + 6.0206) < 0.001);
});
test("old persisted settings gain safe defaults; invalid new controls are rejected", () => {
  const parsed = eqSchema.parse(flat);
  assert.equal(parsed.autoHeadroom, true);
  assert.equal(parsed.peakProtection, true);
  assert.equal(parsed.balance, 0);
  assert.equal(parsed.mono, false);
  assert.equal(eqSchema.safeParse({ ...flat, balance: 3 }).success, false);
  assert.equal(eqSchema.safeParse({ ...flat, preamp: NaN }).success, false);
  const old = {
    gapless: true,
    crossfadeSec: 0,
    theme: "obsidian",
    visualizerMode: "bars",
    volume: 0.85,
    playbackRate: 1,
    resampleRate: "native",
    autoPlayNext: true,
  };
  assert.equal(settingsSchema.parse(old).autoTheme, true);
});
