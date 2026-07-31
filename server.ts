import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

interface BackupData {
  code: string;
  timestamp: string;
  name?: string;
  playlists: any[];
  favorites: string[];
  trackMetadata: any[];
  settings: any;
}

const syncStore = new Map<string, BackupData>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Global CORS Middleware for PWABuilder, Bubblewrap, and external clients
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));

  const publicDir = path.join(process.cwd(), "public");
  const distDir = path.join(process.cwd(), "dist");

  const sendPwaAsset = (res: express.Response, fileName: string, contentType: string) => {
    const pubFile = path.join(publicDir, fileName);
    const distFile = path.join(distDir, fileName);
    const targetFile = fs.existsSync(pubFile) ? pubFile : (fs.existsSync(distFile) ? distFile : null);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Cache-Control", "public, max-age=86400");

    if (targetFile) {
      return res.sendFile(targetFile);
    } else {
      return res.status(404).setHeader("Content-Type", "text/plain").send(`File ${fileName} not found`);
    }
  };

  // Explicit PWA Static Asset Handlers with explicit Content-Type & CORS
  app.get("/pwa-192.png", (_req, res) => sendPwaAsset(res, "pwa-192.png", "image/png"));
  app.get("/pwa-512.png", (_req, res) => sendPwaAsset(res, "pwa-512.png", "image/png"));
  app.get("/apple-touch-icon.png", (_req, res) => sendPwaAsset(res, "apple-touch-icon.png", "image/png"));

  // PWA Manifest and Service Worker routes
  app.get("/sw.js", (_req, res) => {
    res.setHeader("Service-Worker-Allowed", "/");
    sendPwaAsset(res, "sw.js", "application/javascript; charset=utf-8");
  });

  app.get("/manifest.json", (_req, res) => sendPwaAsset(res, "manifest.json", "application/manifest+json; charset=utf-8"));

  // Serve static assets from public folder
  app.use(express.static(publicDir, {
    maxAge: "1d",
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
  }));

  // API Routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
  });

  // Save Backup Snapshot for Cross-Device Sync
  app.post("/api/backup/save", (req, res) => {
    try {
      const { playlists, favorites, trackMetadata, settings, name } = req.body;
      if (!playlists && !trackMetadata) {
        return res.status(400).json({ error: "Invalid backup payload" });
      }

      // Generate 6-char alphanumeric code (e.g. AE-8X92)
      const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `AE-${randomChars}`;

      const backup: BackupData = {
        code,
        timestamp: new Date().toISOString(),
        name: name || "Library Backup",
        playlists: playlists || [],
        favorites: favorites || [],
        trackMetadata: trackMetadata || [],
        settings: settings || {}
      };

      syncStore.set(code, backup);

      res.json({
        success: true,
        code,
        timestamp: backup.timestamp,
        message: "Backup saved to sync cloud. Use this code on any device to restore."
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to save backup" });
    }
  });

  // Load Backup Snapshot by Code
  app.get("/api/backup/load/:code", (req, res) => {
    const code = req.params.code.toUpperCase().trim();
    const backup = syncStore.get(code);

    if (!backup) {
      return res.status(404).json({
        error: "Sync code not found or expired. Please verify your 6-character code."
      });
    }

    res.json({
      success: true,
      backup
    });
  });

  // Guard middleware: prevent returning HTML for missing static assets (.png, .json, etc)
  app.use((req, res, next) => {
    if (req.path.match(/\.(png|jpe?g|gif|svg|ico|json|js|css|map|woff2?)$/i)) {
      const pubFile = path.join(publicDir, req.path);
      const distFile = path.join(distDir, req.path);
      if (!fs.existsSync(pubFile) && !fs.existsSync(distFile)) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        return res.status(404).setHeader("Content-Type", "text/plain").send(`404 Not Found: ${req.path}`);
      }
    }
    next();
  });

  // Vite middleware in Development mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get("*", (req, res) => {
      if (req.path.match(/\.(png|jpe?g|gif|svg|ico|json|js|css|map|woff2?)$/i)) {
        return res.status(404).setHeader("Content-Type", "text/plain").send("404 Not Found");
      }
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Aether Audio] Server active at http://localhost:${PORT}`);
  });
}

startServer();
