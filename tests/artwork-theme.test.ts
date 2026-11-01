import test from "node:test";
import assert from "node:assert/strict";
import { artworkAccent } from "../src/services/artworkTheme";

test("artwork accents remain readable even for saturated blue and fall back on blank images", () => {
  for (const rgb of [
    [0, 0, 255],
    [255, 0, 0],
    [0, 255, 0],
    [40, 40, 40],
  ]) {
    const color = artworkAccent(new Uint8ClampedArray([...rgb, 255]));
    const linear = [1, 3, 5]
      .map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
    const luminance = linear.reduce(
      (sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i],
      0,
    );
    assert.ok(luminance > 0.415, `Unreadable accent ${color}`);
  }
  assert.equal(artworkAccent(new Uint8ClampedArray([0, 0, 0, 0])), "#e5a68c");
});
