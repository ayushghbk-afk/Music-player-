import test from 'node:test';
import assert from 'node:assert/strict';
import { assetUrl } from '../src/services/deployment';

test('public assets respect project Pages base without double slashes', () => {
  assert.equal(assetUrl('art/landscape-1.svg', '/Music-player-/'), '/Music-player-/art/landscape-1.svg');
  assert.equal(assetUrl('/pwa-512.png', '/Music-player-/'), '/Music-player-/pwa-512.png');
  assert.equal(assetUrl('manifest.json', '/'), '/manifest.json');
  assert.equal(assetUrl('sw.js', '/another-project'), '/another-project/sw.js');
});
