#!/usr/bin/env node
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ASSETS_DIR = path.join(
  process.cwd(),
  "android",
  "app",
  "src",
  "main",
  "res",
);
const LOGO_PATH = path.join(process.cwd(), "public", "aether-mark.svg");

async function generate() {
  console.log("Generating Android assets from logo...");

  const sizes = [
    { dir: "mipmap-mdpi", size: 48 },
    { dir: "mipmap-hdpi", size: 72 },
    { dir: "mipmap-xhdpi", size: 96 },
    { dir: "mipmap-xxhdpi", size: 144 },
    { dir: "mipmap-xxxhdpi", size: 192 },
  ];

  for (const s of sizes) {
    const dirPath = path.join(ASSETS_DIR, s.dir);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

    await sharp(LOGO_PATH)
      .resize(s.size, s.size)
      .toFile(path.join(dirPath, "ic_launcher.png"));

    await sharp(LOGO_PATH)
      .resize(s.size, s.size)
      .toFile(path.join(dirPath, "ic_launcher_round.png"));
  }

  // Splash screen
  const splashDir = path.join(ASSETS_DIR, "drawable");
  if (!fs.existsSync(splashDir)) fs.mkdirSync(splashDir, { recursive: true });
  await sharp(LOGO_PATH)
    .resize(1024, 1024)
    .toFile(path.join(splashDir, "splash.png"));

  for (const [name, size] of [
    ["pwa-192.png", 192],
    ["pwa-512.png", 512],
    ["apple-touch-icon.png", 180],
  ]) {
    await sharp(LOGO_PATH)
      .resize(size, size)
      .png()
      .toFile(path.join(process.cwd(), "public", name));
  }
  console.log("Android and PWA assets generated successfully.");
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
