import test from "node:test";
import assert from "node:assert/strict";
import { INITIAL_SAMPLE_TRACKS } from "../src/services/sampleLibrary";

// Exercise the real orchestration with a deterministic media element; no fake DSP claims.
const documentStub = Object.assign(new EventTarget(), {
  visibilityState: "visible",
});
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: documentStub,
});
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: Object.assign(new EventTarget(), { setTimeout, clearTimeout }),
});
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {},
});
const { AudioEngine } = await import("../src/services/audioEngine");
class Media extends EventTarget {
  src = "";
  paused = true;
  volume = 1;
  playbackRate = 1;
  currentTime = 0;
  duration = 12;
  error = null;
  removeAttribute() {}
  load() {
    this.currentTime = 0;
  }
  play() {
    this.paused = false;
    this.dispatchEvent(new Event("playing"));
    return Promise.resolve();
  }
  pause() {
    if (!this.paused) {
      this.paused = true;
      this.dispatchEvent(new Event("pause"));
    }
  }
}
function engine() {
  const instance: any = new (AudioEngine as any)();
  instance.audioElement = new Media();
  instance.initWebAudio = () => {
    instance.isInitialized = true;
  };
  instance.claimExclusiveAudioFocus = async () => {};
  instance.wireAudioElementEvents(instance.audioElement);
  return instance;
}
const a = { ...INITIAL_SAMPLE_TRACKS[0], id: "a" },
  b = { ...INITIAL_SAMPLE_TRACKS[1], id: "b" };
const sourceA = "data:audio/wav;base64,AAAA",
  sourceB = "data:audio/wav;base64,BBBB";
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("newest track wins when an older preparation resolves later", async () => {
  const e = engine(),
    gate = deferred(),
    errors: string[] = [];
  let calls = 0;
  e.claimExclusiveAudioFocus = () =>
    ++calls === 1 ? gate.promise : Promise.resolve();
  e.setCallbacks({ onError: (message: string) => errors.push(message) });
  const slow = e.playTrack(a, sourceA);
  await e.playTrack(b, sourceB);
  gate.resolve();
  await slow;
  assert.equal(e.loadedTrackId, b.id);
  assert.equal(e.audioElement.src, sourceB);
  assert.equal(e.getStatus(), "playing");
  assert.deepEqual(errors, []);
});
test("pause cancels pending load; Play retries the selected track instead of the old decoder", async () => {
  const e = engine(),
    gate = deferred();
  await e.playTrack(b, sourceB);
  const focus = e.claimExclusiveAudioFocus;
  e.claimExclusiveAudioFocus = () => gate.promise;
  const pending = e.playTrack(a, sourceA);
  e.pause();
  gate.resolve();
  await pending;
  e.claimExclusiveAudioFocus = focus;
  assert.equal(e.getStatus(), "paused");
  assert.equal(e.audioElement.paused, true);
  assert.equal(e.loadedTrackId, b.id);
  // Real selected tracks retain their source via metadata when playback is retried.
  e.currentTrack = { ...a, audioUrl: sourceA };
  e.play();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(e.loadedTrackId, a.id);
  assert.equal(e.getStatus(), "playing");
});
test("stale metadata/time/ended events do not affect a newer pending selection", async () => {
  const e = engine(),
    gate = deferred();
  let ended = 0,
    times = 0;
  await e.playTrack(a, sourceA);
  e.setCallbacks({ onEnded: () => ended++, onTimeUpdate: () => times++ });
  e.claimExclusiveAudioFocus = () => gate.promise;
  const next = e.playTrack(b, sourceB);
  e.audioElement.dispatchEvent(new Event("timeupdate"));
  e.audioElement.dispatchEvent(new Event("ended"));
  assert.equal(times, 0);
  assert.equal(ended, 0);
  e.pause();
  gate.resolve();
  await next;
});
test("remote sources produce a useful error and stop rather than stream", async () => {
  const e = engine();
  let error = "";
  e.setCallbacks({ onError: (message: string) => (error = message) });
  for (const source of [
    "https://example.test/song.mp3",
    "//example.test/song.mp3",
    "/\\\\example.test/song.mp3",
  ]) {
    await e.playTrack(a, source);
    assert.equal(e.loadedTrackId, null);
  }
  assert.equal(e.getStatus(), "error");
  assert.match(error, /Only local/);
  assert.equal(e.loadedTrackId, null);
});
test("playback rate is applied before starting a replacement media source", async () => {
  const e = engine();
  e.setPlaybackRate(1.5);
  await e.playTrack(a, sourceA);
  assert.equal(e.audioElement.playbackRate, 1.5);
});

test("autoplay rejection can retry directly on a gesture without reloading the source", async () => {
  const e = engine(),
    play = e.audioElement.play.bind(e.audioElement);
  let denied = true;
  e.audioElement.play = () =>
    denied ? Promise.reject(new Error("NotAllowedError")) : play();
  await e.playTrack(a, sourceA);
  assert.equal(e.getStatus(), "error");
  const generation = e.loadGeneration;
  denied = false;
  e.play();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(e.getStatus(), "playing");
  assert.equal(
    e.loadGeneration,
    generation,
    "A gesture retry must not reload and defer play()",
  );
});
