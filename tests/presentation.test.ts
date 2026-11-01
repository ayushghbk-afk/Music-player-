import test from "node:test";
import assert from "node:assert/strict";
import { artworkFor, displayTitle, timeLabel } from "../src/components/Artwork";
import { INITIAL_SAMPLE_TRACKS } from "../src/services/sampleLibrary";
import { Track } from "../src/types";

const track = INITIAL_SAMPLE_TRACKS[0] as Track;

test("presentation formats elapsed time safely", () => {
  assert.equal(timeLabel(0), "0:00");
  assert.equal(timeLabel(125.7), "2:05");
  assert.equal(timeLabel(-1), "0:00");
  assert.equal(timeLabel(Number.NaN), "0:00");
  assert.equal(timeLabel(Number.POSITIVE_INFINITY), "0:00");
});

test("demo covers use bundled artwork without rewriting library metadata", () => {
  assert.equal(artworkFor(track), "/art/landscape-1.svg");
  assert.ok(track.coverArt?.startsWith("linear-gradient"));
  assert.equal(
    artworkFor({ ...track, id: "sample-track-5" }),
    "/art/landscape-5.svg",
  );
  assert.equal(artworkFor(null), "/art/landscape-1.svg");
});

test("embedded artwork is retained and fallback covers are deterministic", () => {
  const coverArt = "data:image/png;base64,aGVsbG8=";
  assert.equal(artworkFor({ ...track, coverArt }), coverArt);
  const custom = { ...track, id: "custom-track", coverArt: undefined };
  assert.equal(artworkFor(custom), artworkFor(custom));
  assert.match(artworkFor(custom), /^\/art\/landscape-[1-5]\.svg$/);
});

test("compact titles do not modify the original track title", () => {
  assert.equal(displayTitle(track), "Celestial Horizon");
  assert.equal(track.title, "Celestial Horizon (Studio Master)");
  assert.equal(
    displayTitle({ ...track, id: "imported", title: "My Song (Acoustic)" }),
    "My Song (Acoustic)",
  );
  assert.equal(
    displayTitle({ ...track, title: "A song without a suffix" }),
    "A song without a suffix",
  );
});
