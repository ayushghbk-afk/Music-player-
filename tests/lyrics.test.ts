import test from "node:test";
import assert from "node:assert/strict";
import {
  activeLyricIndex,
  embeddedLyrics,
  findLyricsTarget,
  parseLyrics,
  readLyricsFile,
} from "../src/services/lyrics";
import { INITIAL_SAMPLE_TRACKS } from "../src/services/sampleLibrary";

test("LRC supports multiple stamps, BOM, offsets, metadata and fractional seconds", () => {
  const parsed = parseLyrics(
    "\uFEFF[ar:Artist]\r\n[offset:-500]\r\n[00:02.50][00:04.125]Chorus\r\n[00:00.1]Opening\r\n[00:10]",
  );
  assert.equal(parsed.synced, true);
  assert.deepEqual(parsed.lines, [
    { time: 0, text: "Opening" },
    { time: 2, text: "Chorus" },
    { time: 3.625, text: "Chorus" },
    { time: 9.5, text: "" },
  ]);
  assert.equal(activeLyricIndex(parsed.lines, -1), -1);
  assert.equal(activeLyricIndex(parsed.lines, 2.1), 1);
  assert.equal(activeLyricIndex(parsed.lines, 100), 3);
});
test("plain multilingual lyrics are retained without invented timing", () => {
  assert.deepEqual(parseLyrics("पहली पंक्ति\r\nSecond line\n\n第三行"), {
    synced: false,
    lines: [
      { time: null, text: "पहली पंक्ति" },
      { time: null, text: "Second line" },
      { time: null, text: "第三行" },
    ],
  });
});
test("reads UTF-8/UTF-16 lyrics and rejects oversized, empty or malformed inputs", async () => {
  assert.equal(
    await readLyricsFile(new File(["[00:01]Hello"], "track.lrc")),
    "[00:01]Hello",
  );
  const utf16 = Buffer.from("\ufeffनमस्ते", "utf16le");
  assert.equal(await readLyricsFile(new File([utf16], "track.txt")), "नमस्ते");
  await assert.rejects(
    readLyricsFile(new File([""], "empty.lrc")),
    /No lyrics/,
  );
  await assert.rejects(
    readLyricsFile(new File(["text"], "track.exe")),
    /Choose/,
  );
  await assert.rejects(
    readLyricsFile(new File(["a".repeat(400001)], "track.lrc")),
    /too large/,
  );
  await assert.rejects(
    readLyricsFile(new File([new Uint8Array([255, 255])], "track.lrc")),
    /decode/,
  );
});
test("sidecars pair by original filename or title and refuse ambiguous matches", () => {
  const track = {
    ...INITIAL_SAMPLE_TRACKS[0],
    originalFileName: "01 My song.flac",
    title: "My tagged title",
  };
  assert.equal(findLyricsTarget("01 MY SONG.LRC", [track]).id, track.id);
  assert.equal(findLyricsTarget("My tagged title.txt", [track]).id, track.id);
  assert.throws(() => findLyricsTarget("unknown.lrc", [track]), /No matching/);
  assert.throws(
    () =>
      findLyricsTarget("01 My song.lrc", [track, { ...track, id: "other" }]),
    /Multiple/,
  );
});
test("embedded SYLT millisecond timestamps import as LRC; frame timestamps remain plain", () => {
  assert.equal(
    embeddedLyrics([
      {
        text: "",
        timeStampFormat: 2,
        syncText: [
          { text: "Hello", timestamp: 1125 },
          { text: "World", timestamp: 62000 },
        ],
      },
    ]),
    "[00:01.125]Hello\n[01:02.000]World",
  );
  assert.equal(
    embeddedLyrics([
      {
        timeStampFormat: 1,
        syncText: [{ text: "Frame timed", timestamp: 100 }],
      },
    ]),
    "Frame timed",
  );
  assert.equal(embeddedLyrics([{ text: "Plain embedded" }]), "Plain embedded");
});
