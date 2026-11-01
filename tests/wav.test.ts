import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audioBufferToWavBlob } from '../src/services/sampleLibrary';
test('demo WAV uses RIFF, stereo 24-bit PCM and exact data size', async () => {
  const fake = { numberOfChannels: 2, sampleRate: 96000, length: 3, getChannelData: () => new Float32Array([-1, 0, 1]) };
  const bytes = await audioBufferToWavBlob(fake).arrayBuffer();
  const view = new DataView(bytes);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'RIFF');
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 96000);
  assert.equal(view.getUint16(34, true), 24);
  assert.equal(view.getUint32(40, true), 18);
  assert.equal(bytes.byteLength, 62);
  assert.equal(view.getUint8(46), 128);
  assert.equal(view.getUint8(60), 255);
  assert.equal(view.getUint8(61), 127);
});

test('music-metadata reads the encoded demo resolution rather than fabricated tags', async () => {
  const { parseBlob } = await import('music-metadata');
  const wav = audioBufferToWavBlob({ numberOfChannels: 2, sampleRate: 96000, length: 960, getChannelData: () => new Float32Array(960) });
  const metadata = await parseBlob(wav);
  assert.equal(metadata.format.sampleRate, 96000);
  assert.equal(metadata.format.bitsPerSample, 24);
  assert.equal(metadata.format.numberOfChannels, 2);
});
