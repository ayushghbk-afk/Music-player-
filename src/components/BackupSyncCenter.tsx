import React, { useState } from 'react';
import {
  Cloud,
  Download,
  Upload,
  Copy,
  Check,
  RefreshCw,
  HardDrive,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Server,
  Globe,
  Wifi,
  Smartphone,
  Settings2,
} from 'lucide-react';
import { PlayerSettings, EQSettings, BackupPayload } from '../types';
import { createFullBackupPayload, restoreBackupPayload, getStorageStats } from '../services/db';

const DEFAULT_CLOUD_SERVER = 'https://ais-dev-esfjibewomgnfxgajfkbio-885223882928.asia-southeast1.run.app';

// Detect if running inside an APK, WebView, or local file environment
const isLocalOrApkEnv = (): boolean => {
  if (typeof window === 'undefined' || !window.location) return true;
  const origin = window.location.origin || '';
  const protocol = window.location.protocol || '';
  return (
    protocol === 'file:' ||
    protocol === 'capacitor:' ||
    protocol === 'ionic:' ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.includes('10.0.2.2')
  );
};

// Auto-resolve active Cloud Sync Server base URL
const resolveServerUrl = (customUrl?: string): string => {
  if (customUrl && customUrl.trim().length > 0) {
    return customUrl.trim().replace(/\/+$/, '');
  }
  const saved = localStorage.getItem('aether_sync_server_url');
  if (saved && saved.trim().length > 0) {
    return saved.trim().replace(/\/+$/, '');
  }
  if (!isLocalOrApkEnv() && window.location.origin) {
    try {
      localStorage.setItem('aether_sync_server_url', window.location.origin);
    } catch {}
    return window.location.origin.replace(/\/+$/, '');
  }
  return DEFAULT_CLOUD_SERVER;
};

interface BackupSyncCenterProps {
  settings: PlayerSettings;
  eqSettings: EQSettings;
  onRefreshData: () => void;
}

export const BackupSyncCenter: React.FC<BackupSyncCenterProps> = ({
  settings,
  eqSettings,
  onRefreshData,
}) => {
  const [syncCode, setSyncCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const [storageStats, setStorageStats] = useState<{
    usedMB: number;
    trackCount: number;
    playlistCount: number;
  }>({ usedMB: 0, trackCount: 0, playlistCount: 0 });

  // Server Host Config State for APK Support
  const [serverUrl, setServerUrl] = useState<string>(() => resolveServerUrl());
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [isTestingServer, setIsTestingServer] = useState(false);
  const [isApk] = useState<boolean>(() => isLocalOrApkEnv());

  React.useEffect(() => {
    getStorageStats().then(setStorageStats);
  }, []);

  const handleUpdateServerUrl = (newUrl: string) => {
    setServerUrl(newUrl);
    try {
      localStorage.setItem('aether_sync_server_url', newUrl.trim());
    } catch {}
  };

  const handleTestServerConnection = async () => {
    setIsTestingServer(true);
    const targetUrl = resolveServerUrl(serverUrl);
    try {
      const res = await fetch(`${targetUrl}/api/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      if (data && data.status === 'ok') {
        setStatusMsg({
          type: 'success',
          text: `Connected successfully to Cloud Sync Server! (${targetUrl})`,
        });
      } else {
        throw new Error('Server responded but health check failed.');
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: `Connection failed to ${targetUrl}. Please verify your internet connection or URL.`,
      });
    } finally {
      setIsTestingServer(false);
    }
  };

  // Helper for safe JSON fetching with automatic server URL resolution for APKs
  const safeFetchJson = async (endpointPath: string, options?: RequestInit) => {
    const targetBase = resolveServerUrl(serverUrl);
    const fullUrl = endpointPath.startsWith('http')
      ? endpointPath
      : `${targetBase}${endpointPath.startsWith('/') ? '' : '/'}${endpointPath}`;

    let res: Response;
    try {
      res = await fetch(fullUrl, options);
    } catch (networkErr: any) {
      throw new Error(
        `Unable to connect to Cloud Sync Server at ${targetBase}. In APK / Mobile mode, ensure internet access is active.`
      );
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      if (text.startsWith('<!') || text.includes('<html')) {
        throw new Error(`Server endpoint ${endpointPath} unavailable or returned HTML.`);
      }
      throw new Error(`Server returned unexpected response (${res.status}): ${text.substring(0, 100)}`);
    }
    return res.json();
  };

  // 1. Generate Cloud Sync Snapshot
  const handleGenerateSyncCode = async () => {
    setIsGenerating(true);
    setStatusMsg(null);
    try {
      const payload = await createFullBackupPayload(settings, eqSettings);
      const data = await safeFetchJson('/api/backup/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (data.success && data.code) {
        setSyncCode(data.code);
        setStatusMsg({
          type: 'success',
          text: `Sync code created! Use code ${data.code} on your mobile APK or other device to sync your playlists and library.`,
        });
      } else {
        throw new Error(data.error || 'Failed to generate sync code');
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Sync failed.' });
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Restore Snapshot using Sync Code
  const handleRestoreFromCode = async () => {
    if (!inputCode.trim()) return;
    setIsRestoring(true);
    setStatusMsg(null);

    try {
      const formattedCode = inputCode.trim().toUpperCase();
      const data = await safeFetchJson(`/api/backup/load/${formattedCode}`);

      if (data.success && data.backup) {
        const { restoredPlaylists, restoredTracks } = await restoreBackupPayload(data.backup);
        setStatusMsg({
          type: 'success',
          text: `Success! Restored ${restoredPlaylists} playlists and ${restoredTracks} tracks from cloud snapshot.`,
        });
        setInputCode('');
        onRefreshData();
      } else {
        throw new Error(data.error || 'Sync code not found or expired.');
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to restore sync payload.' });
    } finally {
      setIsRestoring(false);
    }
  };

  // 3. Export JSON File
  const handleExportJson = async () => {
    try {
      const payload = await createFullBackupPayload(settings, eqSettings);
      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `Aether_Library_Backup_${new Date().toISOString().split('T')[0]}.aetherjson`;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMsg({
        type: 'success',
        text: 'Backup file exported successfully (.aetherjson)',
      });
    } catch {
      setStatusMsg({ type: 'error', text: 'Failed to generate JSON backup file' });
    }
  };

  // 4. Import JSON File
  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const payload: BackupPayload = JSON.parse(content);

        const { restoredPlaylists, restoredTracks } = await restoreBackupPayload(payload);
        setStatusMsg({
          type: 'success',
          text: `Restored ${restoredPlaylists} playlists and ${restoredTracks} track metadata items from backup file.`,
        });
        onRefreshData();
      } catch (err: any) {
        setStatusMsg({
          type: 'error',
          text: 'Invalid .aetherjson backup file format.',
        });
      }
    };
    reader.readAsText(file);
  };

  const copyCodeToClipboard = () => {
    if (syncCode) {
      navigator.clipboard.writeText(syncCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
          <Cloud className="w-6 h-6 text-sky-400" />
          Cross-Device Sync & Backup Center
        </h2>
        <p className="text-xs text-zinc-400">
          Sync your playlists, track metadata, favorites, and studio equalizer presets seamlessly across mobile APK apps and web links.
        </p>
      </div>

      {/* Cloud Server Endpoint Info & APK Config Bar */}
      <div className="bg-zinc-900/80 p-4 rounded-2xl border border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Server className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold text-white">Cloud Sync Server:</span>
            <span className="text-xs font-mono text-zinc-300 bg-black/40 px-2.5 py-1 rounded-lg border border-white/5 truncate max-w-[240px] sm:max-w-[360px]">
              {resolveServerUrl(serverUrl)}
            </span>
            {isApk ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                <Smartphone className="w-3 h-3" /> Mobile APK Mode
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                <Globe className="w-3 h-3" /> Web Link Mode
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTestServerConnection}
              disabled={isTestingServer}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white flex items-center gap-1.5 border border-white/10 disabled:opacity-50"
              title="Test API Health Connection"
            >
              {isTestingServer ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" /> : <Wifi className="w-3.5 h-3.5 text-emerald-400" />}
              <span>Test Connection</span>
            </button>

            <button
              onClick={() => setShowServerConfig(!showServerConfig)}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 flex items-center gap-1 border border-white/10"
              title="Configure Server Endpoint"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{showServerConfig ? 'Close' : 'Config'}</span>
            </button>
          </div>
        </div>

        {/* Server URL Input Accordion */}
        {showServerConfig && (
          <div className="pt-2 border-t border-white/5 space-y-2 animate-fadeIn">
            <label className="text-[11px] font-medium text-zinc-400 block">
              Cloud Sync Host URL (For Android APK & Mobile Cross-Device Sync)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => handleUpdateServerUrl(e.target.value)}
                placeholder="https://your-cloud-app.run.app"
                className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={() => handleUpdateServerUrl(DEFAULT_CLOUD_SERVER)}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 font-medium"
              >
                Reset Default
              </button>
            </div>
            <p className="text-[10px] text-zinc-500">
              When installed as an APK app, mobile requests target this Cloud Server to save and retrieve sync codes across web browsers and phones.
            </p>
          </div>
        )}
      </div>

      {/* Status Alert Banner */}
      {statusMsg && (
        <div
          className={`p-4 rounded-2xl border text-xs font-medium flex items-center justify-between animate-fadeIn ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
          }`}
        >
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)} className="text-xs font-mono font-bold">
            DISMISS
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Cloud Sync Code Generator */}
        <div className="bg-zinc-900/60 p-6 rounded-3xl border border-white/5 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
              <Cloud className="w-4 h-4" />
              1. Cloud Sync Snapshot
            </div>
            <h3 className="text-base font-bold text-white">Generate Sync Code</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Uploads a lightweight backup snapshot to the server, generating a unique 6-character code to restore your playlists on any mobile or desktop device.
            </p>
          </div>

          {syncCode ? (
            <div className="bg-black/60 p-4 rounded-2xl border border-sky-500/30 text-center space-y-2">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Your 6-Character Sync Code</span>
              <div className="text-2xl font-mono font-extrabold text-sky-400 tracking-widest flex items-center justify-center gap-3">
                {syncCode}
                <button
                  onClick={copyCodeToClipboard}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs"
                  title="Copy Sync Code"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-zinc-500">Valid for 24 hours across all devices.</p>
            </div>
          ) : (
            <button
              onClick={handleGenerateSyncCode}
              disabled={isGenerating}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{isGenerating ? 'Generating Code...' : 'Create 6-Digit Sync Code'}</span>
            </button>
          )}
        </div>

        {/* Card 2: Restore from Sync Code */}
        <div className="bg-zinc-900/60 p-6 rounded-3xl border border-white/5 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              2. Restore from Another Device
            </div>
            <h3 className="text-base font-bold text-white">Enter Sync Code</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Have a 6-character sync code from another device? Enter it below to merge playlists and settings into this device.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. AE-9821"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500 uppercase tracking-widest text-center"
              />
              <button
                onClick={handleRestoreFromCode}
                disabled={isRestoring || !inputCode.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {isRestoring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                <span>Restore</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* File Export & Local Vault Backup */}
      <div className="bg-zinc-900/40 p-6 rounded-3xl border border-white/5 space-y-4">
        <h3 className="text-sm font-bold text-white">Local Vault File Export & Import (.aetherjson)</h3>
        <p className="text-xs text-zinc-400">
          Export an offline backup file containing your complete library structure, playlists, and equalizer presets for permanent offline storage.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            onClick={handleExportJson}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs flex items-center justify-center gap-2 border border-white/10"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Export Backup (.aetherjson)</span>
          </button>

          <label className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs flex items-center justify-center gap-2 border border-white/10 cursor-pointer">
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>Import Backup File</span>
            <input
              type="file"
              accept=".aetherjson,.json"
              onChange={handleImportJsonFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Storage Meter Stats */}
      <div className="bg-zinc-900/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 text-zinc-400">
          <HardDrive className="w-4 h-4 text-sky-400" />
          <span>Local Vault Storage:</span>
          <span className="text-white font-bold">{storageStats.usedMB} MB</span>
        </div>
        <div className="text-zinc-500">
          {storageStats.trackCount} Tracks • {storageStats.playlistCount} Playlists
        </div>
      </div>
    </div>
  );
};
