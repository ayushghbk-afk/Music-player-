import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { mediaTrack, reconcileAndroidLibrary, scanAndroidLibrary } from "../src/services/androidLibrary";
import { getAllTracks, deleteTrack, saveTrack, getKV } from "../src/services/db";
import type { AndroidAudio } from "../src/services/aetherPlayer";

const audio = (id: number, volume = "external_primary"): AndroidAudio => ({
  id: `media-${volume}-${id}`, uri: `content://media/${volume}/audio/media/${id}`,
  name: `${id}.mp3`, title: `Song ${id}`, artist: "<unknown>", album: null,
  duration: 123000, size: 1048576, mimeType: "audio/mpeg", addedAt: 1234,
});

test("MediaStore metadata maps to playable tracks without claiming unknown resolution", () => {
  const track = mediaTrack(audio(1));
  assert.equal(track.sourceUri, audio(1).uri);
  assert.equal(track.duration, 123);
  assert.equal(track.fileSizeMB, 1);
  assert.equal(track.artist, "Unknown artist");
  assert.equal(track.format, "MP3");
  assert.equal(track.isHiRes, false);
  assert.equal(mediaTrack({ ...audio(1), name: "mystery.xyz", mimeType: null }).format, "OTHER");
});

test("scans merge edits, hide removed entries, and only reconcile mounted volumes", async () => {
  await reconcileAndroidLibrary([audio(1), audio(2), audio(3, "card")], ["external_primary", "card"]);
  const initial = (await getAllTracks()).find(track => track.id === audio(1).id)!;
  await saveTrack({ ...initial, title: "Edited", playCount: 7 });
  await deleteTrack(audio(2).id);
  assert.deepEqual(await getKV("hiddenMediaTracks", []), [audio(2).id]);
  await reconcileAndroidLibrary([{ ...audio(1), duration: 200000 }, audio(2)], ["external_primary"]);
  const tracks = await getAllTracks();
  assert.equal(tracks.find(t => t.id === audio(1).id)?.title, "Edited");
  assert.equal(tracks.find(t => t.id === audio(1).id)?.playCount, 7);
  assert.equal(tracks.find(t => t.id === audio(1).id)?.duration, 200);
  assert.equal(tracks.some(t => t.id === audio(2).id), false);
  assert.equal(tracks.some(t => t.id === audio(3, "card").id), true);
  await reconcileAndroidLibrary([], ["external_primary", "card"]);
  assert.deepEqual(await getAllTracks(), []);
});


test("denied or failed scans leave existing library entries untouched", async () => {
  await reconcileAndroidLibrary([audio(4)], ["external_primary"]);
  assert.equal(await scanAndroidLibrary(false, async () => ({ permission: "denied" })), "denied");
  await assert.rejects(scanAndroidLibrary(false, async () => { throw new Error("query failed"); }), /query failed/);
  await assert.rejects(scanAndroidLibrary(false, async () => ({ permission: "granted", tracks: [] })), /Incomplete/);
  assert.ok((await getAllTracks()).some(t => t.id === audio(4).id));
});
