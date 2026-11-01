import React, { useEffect, useState } from "react";
import {
  createFullBackupPayload,
  restoreBackupPayload,
  getStorageStats,
} from "../services/db";
import { EQSettings, PlayerSettings } from "../types";
import { requestApi } from "../services/api";
import {
  ShieldCheck,
  HardDrive,
  Download,
  Upload,
  Cloud,
  Copy,
  RotateCcw,
  ArrowUpRight,
  Settings2,
  Music2,
  ListMusic,
} from "lucide-react";
export function BackupSyncCenter({
  settings,
  eqSettings,
  onRefreshData,
}: {
  settings: PlayerSettings;
  eqSettings: EQSettings;
  onRefreshData: () => void;
}) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [base, setBase] = useState(
    localStorage.getItem("aether.apiBase") || "",
  );
  const [stats, setStats] = useState({
    usedMB: 0,
    trackCount: 0,
    playlistCount: 0,
  });
  useEffect(() => {
    void getStorageStats().then(setStats);
  }, []);
  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await task();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  async function restore(value: unknown) {
    const result = await restoreBackupPayload(value as never);
    onRefreshData();
    setMessage(
      `Merged ${result.restoredTracks} new track records and ${result.restoredPlaylists} playlists. Audio must be imported separately on this device.`,
    );
    setStats(await getStorageStats());
  }
  return (
    <section className="backup-page">
      <div className="page-intro">
        <div>
          <div className="eyebrow">PEACE OF MIND, BUILT IN</div>
          <h1>Keep your collection close.</h1>
          <p>Your playlists, preferences, and favorite moments. Safely kept.</p>
        </div>
        <ShieldCheck size={25} className="page-symbol" />
      </div>
      <div className="storage-overview">
        <div className="storage-emblem">
          <HardDrive size={24} strokeWidth={1.5} />
        </div>
        <div>
          <div className="eyebrow">THIS DEVICE</div>
          <h2>Your personal music vault</h2>
          <p>Local-first. Always yours.</p>
        </div>
        <div className="storage-stats">
          <span>
            <strong>{stats.trackCount}</strong>
            <small>
              <Music2 size={11} /> Tracks
            </small>
          </span>
          <span>
            <strong>{stats.playlistCount}</strong>
            <small>
              <ListMusic size={11} /> Playlists
            </small>
          </span>
          <span>
            <strong>
              {stats.usedMB.toFixed(1)} <em>MB</em>
            </strong>
            <small>Browser storage</small>
          </span>
        </div>
      </div>
      <div className="backup-grid">
        <article className="tool-card">
          <div className="tool-card-icon">
            <Download size={20} />
          </div>
          <div className="eyebrow">NO CONNECTION REQUIRED</div>
          <h2>A little insurance for your library.</h2>
          <p>
            Export a portable backup of your tags, playlists, favorites,
            settings, and EQ. Keep your original audio files separately.
          </p>
          <button
            className="button-primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const payload = await createFullBackupPayload(
                  settings,
                  eqSettings,
                );
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(payload)], {
                    type: "application/json",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "library.aetherjson";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                setMessage(
                  "Backup exported. Keep your original audio files separately.",
                );
              })
            }
          >
            <Download size={14} /> Export .aetherjson
          </button>
          <label className="restore-file">
            <Upload size={14} /> Restore from a backup
            <input
              disabled={busy}
              aria-label="Restore backup file"
              type="file"
              accept=".aetherjson,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void run(async () => {
                    if (file.size > 5 * 1048576)
                      throw new Error("Backup exceeds 5 MB");
                    await restore(JSON.parse(await file.text()));
                  });
                e.target.value = "";
              }}
            />
          </label>
        </article>
        <article className="tool-card">
          <div className="tool-card-icon">
            <Cloud size={20} />
          </div>
          <div className="eyebrow">OPTIONAL COMPANION SYNC</div>
          <h2>A fresh start. A familiar library.</h2>
          <p>
            Save a metadata snapshot to your companion server. Private sync
            codes expire after seven days. Treat your code like a password.
          </p>
          <button
            className="button-secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const result = await requestApi(
                  "/api/backup/save",
                  await createFullBackupPayload(settings, eqSettings),
                );
                setCode(result.code);
                setMessage(
                  `Saved until ${new Date(result.expiry).toLocaleString()}`,
                );
              })
            }
          >
            <Cloud size={14} /> Create snapshot <ArrowUpRight size={14} />
          </button>
          <label className="field-label">
            YOUR SYNC CODE
            <input
              aria-label="Sync code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={35}
              placeholder="AE- followed by 32 hex characters"
            />
          </label>
          <div className="backup-code-actions">
            <button
              disabled={busy || !code}
              onClick={() =>
                void run(async () => {
                  await navigator.clipboard.writeText(code);
                  setMessage("Code copied");
                })
              }
            >
              <Copy size={13} /> Copy code
            </button>
            <button
              disabled={busy || !code}
              onClick={() =>
                void run(async () => {
                  const result = await requestApi(
                    "/api/backup/load/" + encodeURIComponent(code.trim()),
                  );
                  await restore(result.backup);
                })
              }
            >
              <RotateCcw size={13} /> Restore snapshot
            </button>
          </div>
        </article>
      </div>
      <details className="server-details">
        <summary>
          <Settings2 size={16} /> Companion server settings{" "}
          <span>Configure Android connection</span>
        </summary>
        <div>
          <label className="field-label">
            HTTPS SERVER FOR ANDROID
            <input
              value={base}
              placeholder="https://your-aether-server.example"
              onChange={(e) => setBase(e.target.value)}
            />
          </label>
          <button
            className="button-secondary"
            onClick={() => {
              try {
                const url = new URL(base);
                if (url.protocol !== "https:" || url.username || url.password)
                  throw new Error();
                localStorage.setItem("aether.apiBase", url.origin);
                setMessage("Companion server saved.");
              } catch {
                setMessage("Enter a valid HTTPS server origin.");
              }
            }}
          >
            Save server
          </button>
          <p>
            Web uses its own origin. Server CORS must allow https://localhost
            for Android.
          </p>
        </div>
      </details>
      <p className="backup-footnote">
        <ShieldCheck size={14} /> Audio never leaves your device through backup
        or sync. Native audio storage is separate from the browser estimate
        above.
      </p>
      <p role="status" className="backup-status">
        {busy ? "Taking care of your collection…" : message}
      </p>
    </section>
  );
}
