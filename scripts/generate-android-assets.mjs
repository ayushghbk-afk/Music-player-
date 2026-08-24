import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const out = (...parts) => path.join(root, ...parts);

const ensureDir = async (filePath) => fs.mkdir(path.dirname(filePath), { recursive: true });

const logoSvg = (size = 512) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="36%" r="70%">
      <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.95"/>
      <stop offset="48%" stop-color="#4F46E5" stop-opacity="0.88"/>
      <stop offset="100%" stop-color="#050505" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="mark" x1="110" y1="88" x2="402" y2="424" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#A78BFA"/>
      <stop offset="0.45" stop-color="#38BDF8"/>
      <stop offset="1" stop-color="#22C55E"/>
    </linearGradient>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#000000" flood-opacity="0.45"/>
      <feDropShadow dx="0" dy="0" stdDeviation="18" flood-color="#6366F1" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="#050505"/>
  <circle cx="256" cy="226" r="214" fill="url(#glow)" opacity="0.9"/>
  <g filter="url(#softShadow)">
    <circle cx="256" cy="256" r="144" fill="#09090B" opacity="0.72" stroke="url(#mark)" stroke-width="13"/>
    <path d="M223 170v168c0 30-28 55-63 55s-63-25-63-55 28-55 63-55c13 0 25 3 35 9V155c0-16 10-30 25-35l137-43c20-6 40 9 40 30v164c0 30-28 55-63 55s-63-25-63-55 28-55 63-55c13 0 25 3 35 9V128l-96 30c-15 5-30 11-46 12z" fill="url(#mark)"/>
    <g opacity="0.88" fill="#FFFFFF">
      <rect x="139" y="214" width="12" height="46" rx="6"/>
      <rect x="167" y="194" width="12" height="86" rx="6"/>
      <rect x="195" y="225" width="12" height="54" rx="6"/>
      <rect x="305" y="188" width="12" height="88" rx="6"/>
      <rect x="333" y="211" width="12" height="58" rx="6"/>
      <rect x="361" y="172" width="12" height="106" rx="6"/>
    </g>
  </g>
</svg>`;

const foregroundSvg = (size = 432) => `
<svg width="${size}" height="${size}" viewBox="0 0 432 432" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="mark" x1="95" y1="74" x2="337" y2="358" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#A78BFA"/>
      <stop offset="0.45" stop-color="#38BDF8"/>
      <stop offset="1" stop-color="#22C55E"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#6366F1" flood-opacity="0.68"/>
    </filter>
  </defs>
  <rect width="432" height="432" fill="none"/>
  <g filter="url(#glow)">
    <circle cx="216" cy="216" r="124" fill="#09090B" opacity="0.76" stroke="url(#mark)" stroke-width="12"/>
    <path d="M187 143v141c0 26-24 47-54 47s-54-21-54-47 24-47 54-47c11 0 21 3 30 8V130c0-14 9-26 22-30l116-36c17-5 34 8 34 26v139c0 26-24 47-54 47s-54-21-54-47 24-47 54-47c11 0 21 3 30 8v-83l-81 25c-13 4-26 9-39 11z" fill="url(#mark)"/>
  </g>
</svg>`;

async function pngFromSvg(svg, size, filePath) {
  await ensureDir(filePath);
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(filePath);
}

async function splash(width, height, filePath) {
  const markSize = Math.round(Math.min(width, height) * 0.34);
  const mark = await sharp(Buffer.from(logoSvg(512))).resize(markSize, markSize).png().toBuffer();
  const textSvg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg" cx="50%" cy="38%" r="75%">
        <stop offset="0%" stop-color="#1E1B4B"/>
        <stop offset="52%" stop-color="#09090B"/>
        <stop offset="100%" stop-color="#050505"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <text x="50%" y="${Math.round(height / 2 + markSize / 2 + Math.min(width, height) * 0.085)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(Math.min(width, height) * 0.042)}" font-weight="800" letter-spacing="4" fill="#F8FAFC">AETHER AUDIO</text>
    <text x="50%" y="${Math.round(height / 2 + markSize / 2 + Math.min(width, height) * 0.14)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(Math.min(width, height) * 0.024)}" font-weight="600" letter-spacing="2" fill="#A5B4FC">HI-RES MUSIC PLAYER</text>
  </svg>`;
  await ensureDir(filePath);
  await sharp(Buffer.from(textSvg))
    .composite([{ input: mark, left: Math.round((width - markSize) / 2), top: Math.round((height - markSize) / 2 - Math.min(width, height) * 0.08) }])
    .png({ compressionLevel: 9 })
    .toFile(filePath);
}

const densities = [
  ['mdpi', 48, 108, 320, 480],
  ['hdpi', 72, 162, 480, 720],
  ['xhdpi', 96, 216, 640, 960],
  ['xxhdpi', 144, 324, 960, 1440],
  ['xxxhdpi', 192, 432, 1280, 1920],
];

await pngFromSvg(logoSvg(512), 192, out('public', 'pwa-192.png'));
await pngFromSvg(logoSvg(512), 512, out('public', 'pwa-512.png'));
await pngFromSvg(logoSvg(512), 180, out('public', 'apple-touch-icon.png'));

for (const [density, legacySize, foregroundSize, shortSide, longSide] of densities) {
  await pngFromSvg(logoSvg(512), legacySize, out('android', 'app', 'src', 'main', 'res', `mipmap-${density}`, 'ic_launcher.png'));
  await pngFromSvg(logoSvg(512), legacySize, out('android', 'app', 'src', 'main', 'res', `mipmap-${density}`, 'ic_launcher_round.png'));
  await pngFromSvg(foregroundSvg(432), foregroundSize, out('android', 'app', 'src', 'main', 'res', `mipmap-${density}`, 'ic_launcher_foreground.png'));
  await splash(shortSide, longSide, out('android', 'app', 'src', 'main', 'res', `drawable-port-${density}`, 'splash.png'));
  await splash(longSide, shortSide, out('android', 'app', 'src', 'main', 'res', `drawable-land-${density}`, 'splash.png'));
}

await splash(480, 320, out('android', 'app', 'src', 'main', 'res', 'drawable', 'splash.png'));

console.log('Generated Aether Android and PWA assets.');
