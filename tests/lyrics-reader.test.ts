import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LyricsView } from "../src/components/LyricsView";
import { lyricScrollTop } from "../src/services/lyricsLayout";

test("lyrics centering uses viewport-relative geometry and stays within scroll bounds", () => {
  assert.equal(lyricScrollTop(120, 300, 500, 240, 40, 1200), 220);
  assert.equal(
    lyricScrollTop(120, 900, 1100, 240, 40, 1200),
    220,
    "Ancestor scroll/position must not change the result",
  );
  assert.equal(lyricScrollTop(0, 300, 310, 240, 40, 1200), 0);
  assert.equal(lyricScrollTop(900, 300, 650, 240, 40, 1200), 960);
  assert.equal(lyricScrollTop(0, 300, 500, 240, 40, 100), 0);
  assert.equal(
    lyricScrollTop(100, 300, 500, 240, 800, 1500),
    288,
    "Oversized lines start at the top rather than hiding their first words",
  );
});
test("lyrics reader has keyboard scrolling, reading-size controls and an expand action", () => {
  const html = renderToStaticMarkup(
    React.createElement(LyricsView, {
      lyrics: "Readable words",
      currentTime: 0,
      onSeek() {},
      onToggleExpand() {},
    }),
  );
  assert.ok(html.includes('role="region"'));
  assert.ok(html.includes('aria-label="Song lyrics"'));
  assert.ok(html.includes('tabindex="0"'));
  assert.ok(html.includes('aria-label="Larger lyrics text"'));
  assert.ok(html.includes('aria-label="Smaller lyrics text"'));
  assert.ok(html.includes('aria-label="Fullscreen lyrics"'));
  assert.ok(html.includes('dir="auto"'));
  assert.ok(!html.includes("Import / edit"));
});
test("simultaneous translated LRC lines highlight together, not just the last timestamp", () => {
  const html = renderToStaticMarkup(
    React.createElement(LyricsView, {
      lyrics: "[00:01]Original\n[00:01]अनुवाद\n[00:05]Next",
      currentTime: 2,
      onSeek() {},
      expanded: true,
      onToggleExpand() {},
    }),
  );
  assert.equal((html.match(/aria-current="true"/g) || []).length, 2);
  assert.ok(html.includes('aria-label="Exit fullscreen lyrics"'));
  assert.ok(html.includes("Seek to 5.0 seconds: Next"));
});
