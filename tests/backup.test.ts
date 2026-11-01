import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBackup } from '../src/services/backupSchema';
const settings = { gapless: true, crossfadeSec: 0, theme: 'obsidian', visualizerMode: 'bars', volume: 0.8, playbackRate: 1, resampleRate: 'native', autoPlayNext: true };
const eq = { enabled: true, preset: 'Flat', bands: Array(10).fill(0), preamp: 0, bassBoost: 0, trebleBoost: 0, stereoWidth: 100 };
const track = { id: 'one', title: 'Test', artist: 'Aether', album: 'Tests', format: 'WAV', bitrate: '24-bit / 96kHz', isHiRes: true, duration: 1, addedAt: 1, playCount: 0 };
const payload = () => ({ version: '1.0.0', exportedAt: new Date().toISOString(), playlists: [], favorites: [], trackMetadata: [track], settings, eqSettings: eq });
test('valid backups are sanitized and deduplicated', () => {
  const p = payload();
  const clean = validateBackup({ ...p, favorites: ['one', 'one'], trackMetadata: [{ ...track, audioUrl: 'https://attacker.test/stream', extra: 'ignored' }, track], evil: true });
  assert.equal(clean.trackMetadata.length, 1);
  assert.equal(clean.favorites.length, 1);
  assert.equal('audioUrl' in clean.trackMetadata[0], false);
  assert.equal('evil' in clean, false);
});
test('rejects invalid gains, script artwork, paths, and malformed arrays before writes', () => {
  for (const bad of [
    { ...payload(), eqSettings: { ...eq, bands: [999] } },
    { ...payload(), trackMetadata: [{ ...track, coverArt: 'javascript:alert(1)' }] },
    { ...payload(), trackMetadata: [{ ...track, id: '../../file' }] },
    { ...payload(), playlists: {} },
    { ...payload(), settings: { ...settings, volume: Infinity } },
  ]) assert.throws(() => validateBackup(bad));
});

test('built-in demo gradient artwork round-trips but arbitrary CSS is rejected', () => {
  const gradient = 'linear-gradient(135deg, #0f172a 0%, #38bdf8 50%, #6366f1 100%)';
  assert.equal(validateBackup({ ...payload(), trackMetadata: [{ ...track, coverArt: gradient }] }).trackMetadata[0].coverArt, gradient);
  assert.throws(() => validateBackup({ ...payload(), trackMetadata: [{ ...track, coverArt: 'url(https://tracker.test/x)' }] }));
});
