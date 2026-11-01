import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const assets = (await readdir('dist/assets')).filter(f => /\.(js|css)$/.test(f)).map(f => '/assets/' + f);
const revision = createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 12);
let worker = await readFile('public/sw.js', 'utf8');
worker = worker.replace('aether-v2', 'aether-' + revision).replace('/* BUILD_ASSETS */', assets.map(p => ', ' + JSON.stringify(p)).join(''));
await writeFile('dist/sw.js', worker);
