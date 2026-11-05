import test from "node:test";
import assert from "node:assert/strict";
import { cloudSongToTrack } from "../src/services/cloud";

const song = {
  id: "2f6f50ec-9981-4c5a-a33f-e25a1d8c3c1f",
  title: "Cloud master",
  artist: "Aether",
  album: "Streams",
  duration: 120,
  cover_url: null,
  added_at: 1762300000,
  mime_type: "audio/wav",
  file_size: 1048576,
  uploaded_by: "user-1",
  stream_url: "https://storage-cloudflare-worker.mr-hackerdon808.workers.dev/stream/2f6f50ec-9981-4c5a-a33f-e25a1d8c3c1f?ticket=signed",
  stream_expires_at: 1762303600000,
};

test("cloud metadata maps to an isolated cloud track without exposing storage keys", () => {
  const track = cloudSongToTrack(song);
  assert.equal(track.id, `cloud_${song.id}`);
  assert.equal(track.cloudId, song.id);
  assert.equal(track.storage, "cloud");
  assert.equal(track.audioUrl, song.stream_url);
  assert.equal(track.uploadedBy, "user-1");
  assert.equal(track.fileSizeMB, 1);
  assert.equal(track.addedAt, song.added_at * 1000);
  assert.equal(track.isHiRes, false, "unknown cloud resolution must not be presented as hi-res");
  assert(!("b2_key" in track));
});

test("cloud client rejects a stream URL on an untrusted origin", () => {
  assert.throws(() => cloudSongToTrack({ ...song, stream_url: "https://attacker.example/audio.mp3" }), /untrusted stream URL/);
});
