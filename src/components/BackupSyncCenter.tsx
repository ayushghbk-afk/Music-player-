import React, { useEffect, useState } from 'react';
import { createFullBackupPayload, restoreBackupPayload, getStorageStats } from '../services/db';
import { EQSettings, PlayerSettings } from '../types';
import { requestApi } from '../services/api';
export function BackupSyncCenter({ settings, eqSettings, onRefreshData }: { settings: PlayerSettings; eqSettings: EQSettings; onRefreshData: () => void }) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [base, setBase] = useState(localStorage.getItem('aether.apiBase') || '');
  const [stats, setStats] = useState({ usedMB: 0, trackCount: 0, playlistCount: 0 });
  useEffect(() => { void getStorageStats().then(setStats); }, []);
  async function run(task: () => Promise<void>) { if (busy) return; setBusy(true); setMessage(''); try { await task(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Operation failed'); } finally { setBusy(false); } }
  async function restore(value: unknown) {
    const result = await restoreBackupPayload(value as never);
    onRefreshData(); setMessage(`Merged ${result.restoredTracks} new track records and ${result.restoredPlaylists} playlists. Audio must be imported separately on this device.`);
    setStats(await getStorageStats());
  }
  const button = 'px-4 py-3 rounded-xl bg-indigo-600 disabled:opacity-40 text-sm';
  return <section className="max-w-3xl mx-auto space-y-6">
    <h2 className="text-2xl font-semibold">Backup & Sync</h2>
    <p className="text-zinc-400 text-sm">Metadata only: playlists, favorites, tags, settings and EQ. Audio files stay private on your device. Sync codes are bearer secrets and expire after seven days.</p>
    <div className="p-5 border border-white/10 rounded-2xl bg-white/5"><h3 className="mb-4">Device storage</h3><p>{stats.trackCount} tracks · {stats.playlistCount} playlists · {stats.usedMB.toFixed(1)} MB browser storage</p><p className="text-xs text-zinc-500 mt-2">Native audio lives separately in app-private storage and is not included in this browser estimate.</p></div>
    <div className="p-5 border border-white/10 rounded-2xl space-y-4"><h3>Offline backup file</h3><button className={button} disabled={busy} onClick={() => void run(async () => { const payload = await createFullBackupPayload(settings, eqSettings); const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'library.aetherjson'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage('Backup exported. Keep your original audio files separately.'); })}>Export .aetherjson</button>
      <label className="block text-sm">Restore .aetherjson<input disabled={busy} type="file" accept=".aetherjson,application/json" className="block mt-2 max-w-full" onChange={e => { const file = e.target.files?.[0]; if (file) void run(async () => { if (file.size > 5 * 1048576) throw new Error('Backup exceeds 5 MB'); await restore(JSON.parse(await file.text())); }); e.target.value = ''; }} /></label></div>
    <div className="p-5 border border-white/10 rounded-2xl space-y-4"><h3>Companion server (optional)</h3><label className="block text-sm">HTTPS server for Android<input className="block w-full bg-zinc-900 rounded-lg p-3 mt-2" value={base} placeholder="https://your-aether-server.example" onChange={e => setBase(e.target.value)} /></label><button className={button} onClick={() => { try { const url = new URL(base); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); localStorage.setItem('aether.apiBase', url.origin); setMessage('Companion server saved.'); } catch { setMessage('Enter a valid HTTPS server origin.'); } }}>Save server</button>
      <p className="text-xs text-zinc-500">Web uses its own origin. Server CORS must allow https://localhost for Android.</p>
      <button className={button} disabled={busy} onClick={() => void run(async () => { const result = await requestApi('/api/backup/save', await createFullBackupPayload(settings, eqSettings)); setCode(result.code); setMessage(`Saved until ${new Date(result.expiry).toLocaleString()}`); })}>Save snapshot</button>
      <label className="block text-sm">Sync code<input aria-label="Sync code" className="block w-full bg-zinc-900 rounded-lg p-3 font-mono mt-2" value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={35} placeholder="AE- followed by 32 hex characters" /></label>
      <div className="flex gap-3"><button className={button} disabled={busy || !code} onClick={() => void run(async () => { await navigator.clipboard.writeText(code); setMessage('Code copied'); })}>Copy code</button><button className={button} disabled={busy || !code} onClick={() => void run(async () => { const result = await requestApi('/api/backup/load/' + encodeURIComponent(code.trim())); await restore(result.backup); })}>Restore snapshot</button></div>
    </div><p role="status" className="text-indigo-300 whitespace-pre-wrap break-words">{busy ? 'Working…' : message}</p>
  </section>;
}
