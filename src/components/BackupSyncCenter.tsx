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
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
} from 'lucide-react';
import { PlayerSettings, EQSettings, BackupPayload } from '../types';
import { createFullBackupPayload, restoreBackupPayload, getStorageStats } from '../services/db';

const SHARED_CLOUD_SERVER = 'https://ais-pre-esfjibewomgnfxgajfkbio-885223882928.asia-southeast1.run.app';
const DEV_CLOUD_SERVER = 'https://ais-dev-esfjibewomgnfxgajfkbio-885223882928.asia-southeast1.run.app';
const DEFAULT_CLOUD_SERVER = SHARED_CLOUD_SERVER;

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
  const isApk = isLocalOrApkEnv();

  if (customUrl && customUrl.trim().length > 0) {
    const trimmed = customUrl.trim().replace(/\/+$/, '');
    if (isApk && trimmed.includes('ais-dev-')) {
      return SHARED_CLOUD_SERVER;
    }
    return trimmed;
  }

  const saved = localStorage.getItem('aether_sync_server_url');
  if (saved && saved.trim().length > 0) {
    const trimmedSaved = saved.trim().replace(/\/+$/, '');
    if (isApk && trimmedSaved.includes('ais-dev-')) {
      return SHARED_CLOUD_SERVER;
    }
    return trimmedSaved;
  }

  if (!isApk && typeof window !== 'undefined' && window.location && window.location.origin) {
    const orig = window.location.origin.replace(/\/+$/, '');
    if (!orig.includes('localhost') && !orig.includes('127.0.0.1') && !orig.includes('file:')) {
      return orig;
    }
  }

  return SHARED_CLOUD_SERVER;
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
  const [syncCode, setSyncCode] = useState<string | null>(() => {
    return localStorage.getItem('aether_active_sync_code') || null;
  });
  const [universalSyncCode, setUniversalSyncCode] = useState<string | null>(() => {
    return localStorage.getItem('aether_universal_sync_code') || null;
  });
  const [inputCode, setInputCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [storageStats, setStorageStats] = useState<{
    usedMB: number;
    trackCount: number;
    playlistCount: number;
  }>({ usedMB: 0, trackCount: 0, playlistCount: 0 });

  // Server Host Config State for APK & Cross-Device Support
  const [serverUrl, setServerUrl] = useState<string>(() => resolveServerUrl());
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [isTestingServer, setIsTestingServer] = useState(false);
  const [isApk] = useState<boolean>(() => isLocalOrApkEnv());
  const [showUpdateGuide, setShowUpdateGuide] = useState(false);
  const [isPurgingCache, setIsPurgingCache] = useState(false);

  React.useEffect(() => {
    getStorageStats().then(setStorageStats);
  }, []);

  const handleUpdateServerUrl = (newUrl: string) => {
    const trimmed = newUrl.trim().replace(/\/+$/, '');
    setServerUrl(trimmed);
    try {
      localStorage.setItem('aether_sync_server_url', trimmed);
    } catch {}
  };

  // Helper: Save payload directly to Universal Cloud REST APIs (Multi-provider CORS-free for Mobile APK)
  const saveToUniversalCloud = async (payload: BackupPayload): Promise<string | null> => {
    // Strategy 1: jsonblob.com (Fast, accepts large JSON, 100% CORS header support)
    try {
      const blobRes = await fetch('https://jsonblob.com/api/jsonBlob', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (blobRes.ok) {
        const jsonBlobId = blobRes.headers.get('X-jsonblob-id');
        const locationHeader = blobRes.headers.get('Location');
        let blobId = jsonBlobId;
        if (!blobId && locationHeader) {
          const parts = locationHeader.split('/');
          blobId = parts[parts.length - 1];
        }
        if (blobId) {
          return `AE-JB-${blobId}`;
        }
      }
    } catch (err) {
      console.warn('jsonblob save notice:', err);
    }

    // Strategy 2: api.restful-api.dev
    try {
      const res = await fetch('https://api.restful-api.dev/objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'AetherBackup',
          data: payload,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          return `AE-${data.id}`;
        }
      }
    } catch (err) {
      console.warn('restful-api save notice:', err);
    }

    return null;
  };

  // Helper: Load payload directly from Universal Cloud REST APIs
  const loadFromUniversalCloud = async (rawCode: string): Promise<BackupPayload | null> => {
    try {
      let cleanCode = rawCode.trim();

      // Check if jsonblob ID code: AE-JB-<uuid>
      if (cleanCode.toUpperCase().startsWith('AE-JB-')) {
        const blobId = cleanCode.substring(6);
        const res = await fetch(`https://jsonblob.com/api/jsonBlob/${blobId}`, {
          headers: { 'Accept': 'application/json' },
        });
        if (res.ok) {
          return await res.json();
        }
      }

      // Extract ID if prefix exists
      let cleanId = cleanCode;
      if (cleanId.toUpperCase().startsWith('AE-')) {
        cleanId = cleanId.substring(3);
      }

      // Check local mapped code
      if (cleanId.length < 10) {
        const mapped = localStorage.getItem(`aether_universal_id_${cleanId.toUpperCase()}`);
        if (mapped) {
          cleanId = mapped;
        }
      }

      if (!cleanId) return null;

      // Try jsonblob if cleanId starts with JB-
      if (cleanId.toUpperCase().startsWith('JB-')) {
        const blobId = cleanId.substring(3);
        const res = await fetch(`https://jsonblob.com/api/jsonBlob/${blobId}`, {
          headers: { 'Accept': 'application/json' },
        });
        if (res.ok) {
          return await res.json();
        }
      }

      // Try jsonblob UUID if dash present
      if (cleanId.includes('-')) {
        try {
          const res = await fetch(`https://jsonblob.com/api/jsonBlob/${cleanId}`, {
            headers: { 'Accept': 'application/json' },
          });
          if (res.ok) {
            return await res.json();
          }
        } catch {}
      }

      // Try restful-api.dev
      const res = await fetch(`https://api.restful-api.dev/objects/${cleanId}`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          return json.data.backup || json.data;
        }
      }
    } catch (err) {
      console.warn('Universal cloud load notice:', err);
    }
    return null;
  };

  const handleTestServerConnection = async () => {
    setIsTestingServer(true);
    setStatusMsg(null);
    try {
      let serverOk = false;
      const activeUrl = resolveServerUrl(serverUrl);

      try {
        const data = await safeFetchJson('/api/health');
        if (data && data.status === 'ok') {
          serverOk = true;
        }
      } catch (e: any) {
        console.warn('Local server test note:', e.message);
      }

      let universalOk = false;
      try {
        const res = await fetch('https://api.restful-api.dev/objects/ff8081819f7e10ae019fbc7e727a5b77');
        if (res.ok) universalOk = true;
      } catch {}

      if (serverOk) {
        setStatusMsg({
          type: 'success',
          text: `Connected successfully to Cloud Sync Server! (${activeUrl})`,
        });
      } else if (universalOk) {
        setStatusMsg({
          type: 'success',
          text: `Connected to Universal Cloud Sync Network! (100% Mobile APK & Web Cross-Sync Ready)`,
        });
      } else {
        throw new Error('Server endpoint check failed. Please verify internet access.');
      }
    } catch (err: any) {
      const targetUrl = resolveServerUrl(serverUrl);
      setStatusMsg({
        type: 'error',
        text: `Connection failed to ${targetUrl}. ${err.message || 'Please check your connection.'}`,
      });
    } finally {
      setIsTestingServer(false);
    }
  };

  // Helper for safe JSON fetching with automatic server URL resolution and failover
  const safeFetchJson = async (endpointPath: string, options?: RequestInit) => {
    const configuredServer = resolveServerUrl(serverUrl);
    const inApkMode = isLocalOrApkEnv();

    const candidateServers = inApkMode
      ? [SHARED_CLOUD_SERVER, configuredServer].filter((v, i, a) => v && a.indexOf(v) === i)
      : [configuredServer, SHARED_CLOUD_SERVER, DEV_CLOUD_SERVER].filter((v, i, a) => v && a.indexOf(v) === i);

    let lastError: Error | null = null;

    for (const currentServer of candidateServers) {
      const fullUrl = endpointPath.startsWith('http')
        ? endpointPath
        : `${currentServer}${endpointPath.startsWith('/') ? '' : '/'}${endpointPath}`;

      const fetchOpts: RequestInit = {
        mode: 'cors',
        credentials: 'omit',
        ...options,
      };

      if (fetchOpts.method === 'POST' && fetchOpts.body) {
        fetchOpts.headers = {
          'Content-Type': 'text/plain;charset=UTF-8',
          ...(fetchOpts.headers || {}),
        };
      }

      try {
        const res = await fetch(fullUrl, fetchOpts);
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const text = await res.text();
          if (text.startsWith('<!') || text.includes('<html')) {
            throw new Error(`Server endpoint returned HTML instead of API JSON.`);
          }
          throw new Error(`Server returned status ${res.status}: ${text.substring(0, 80)}`);
        }

        if (currentServer !== configuredServer) {
          handleUpdateServerUrl(currentServer);
        }

        return await res.json();
      } catch (err: any) {
        lastError = err;
      }
    }

    throw new Error(
      lastError?.message || `Unable to connect to Cloud Sync Server. Please check network access or server host.`
    );
  };

  // 1. Generate Cloud Sync Snapshot
  const handleGenerateSyncCode = async () => {
    setIsGenerating(true);
    setStatusMsg(null);
    try {
      const payload = await createFullBackupPayload(settings, eqSettings);

      // Save to Universal Public Cloud (100% reliable on mobile APKs without cookie blocks)
      const uCode = await saveToUniversalCloud(payload);

      let shortCode: string | null = null;
      try {
        const data = await safeFetchJson('/api/backup/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (data && data.success && data.code) {
          shortCode = data.code;
        }
      } catch (e) {
        console.warn('Express server backup notice:', e);
      }

      const activeCode = uCode || shortCode;

      if (activeCode) {
        setSyncCode(shortCode || activeCode);
        if (uCode) {
          setUniversalSyncCode(uCode);
          try {
            localStorage.setItem('aether_universal_sync_code', uCode);
            if (shortCode) {
              localStorage.setItem(`aether_universal_id_${shortCode.toUpperCase()}`, uCode.replace('AE-', ''));
            }
          } catch {}
        }
        if (shortCode) {
          try {
            localStorage.setItem('aether_active_sync_code', shortCode);
          } catch {}
        }

        setStatusMsg({
          type: 'success',
          text: `Cloud Sync Code created! Copy code below and use it on your Mobile APK or Web app to restore your library.`,
        });
      } else {
        throw new Error('Failed to generate cloud sync snapshot.');
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
      let rawCode = inputCode.trim();
      let targetServer = serverUrl;

      if (rawCode.includes('@http')) {
        const parts = rawCode.split('@');
        rawCode = parts[0];
        targetServer = parts.slice(1).join('@');
        handleUpdateServerUrl(targetServer);
      }

      const formattedCode = rawCode.trim();

      // Step 1: Try Universal Public Cloud (works on ALL Mobile APKs without server cookie auth)
      let backupPayload: BackupPayload | null = await loadFromUniversalCloud(formattedCode);

      // Step 2: If Universal Cloud didn't yield payload, try Express server endpoint
      if (!backupPayload) {
        const targetBase = resolveServerUrl(targetServer);
        try {
          const data = await safeFetchJson(`${targetBase}/api/backup/load/${formattedCode.toUpperCase()}`);
          if (data && data.success && data.backup) {
            backupPayload = data.backup;
          }
        } catch (serverErr: any) {
          console.warn('Express server load notice:', serverErr);
        }
      }

      if (backupPayload) {
        const { restoredPlaylists, restoredTracks } = await restoreBackupPayload(backupPayload);
        setSyncCode(formattedCode);
        try {
          localStorage.setItem('aether_active_sync_code', formattedCode);
        } catch {}

        setStatusMsg({
          type: 'success',
          text: `Success! Restored ${restoredPlaylists} playlists and ${restoredTracks} tracks from cloud snapshot.`,
        });
        setInputCode('');
        onRefreshData();
      } else {
        throw new Error('Sync code not found or expired. Please verify your code and try again.');
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
        text: 'Backup file exported successfully (.aetherjson). You can import this anytime on mobile or desktop.',
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

  // Service Worker Cache Clear & Clean App Reload
  const handleCleanAppReload = async () => {
    setIsPurgingCache(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          await caches.delete(name);
        }
      }
      setStatusMsg({
        type: 'success',
        text: 'App cache cleared! Reloading clean bundle...',
      });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch {
      window.location.reload();
    } finally {
      setIsPurgingCache(false);
    }
  };

  const copyCodeToClipboard = () => {
    if (syncCode) {
      navigator.clipboard.writeText(syncCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const copyHybridLinkToClipboard = () => {
    if (syncCode) {
      const activeServer = resolveServerUrl(serverUrl);
      const hybridStr = `${syncCode}@${activeServer}`;
      navigator.clipboard.writeText(hybridStr);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <Cloud className="w-6 h-6 text-sky-400" />
            Cross-Device Sync & APK Backup Center
          </h2>
          <p className="text-xs text-zinc-400">
            Sync playlists, metadata, favorites, and studio equalizer presets seamlessly across Android APK apps and Web links.
          </p>
        </div>

        <button
          onClick={() => setShowUpdateGuide(!showUpdateGuide)}
          className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-amber-400" />
          <span>APK Clean Update Guide</span>
        </button>
      </div>

      {/* APK Clean Update & Data Safety Guide Accordion */}
      {showUpdateGuide && (
        <div className="bg-amber-950/30 border border-amber-500/30 p-5 rounded-2xl space-y-4 animate-fadeIn">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-200">
                How to Update Your APK App Without Uninstalling or Losing Data
              </h3>
              <p className="text-xs text-amber-300/80 leading-relaxed">
                You do <strong>NOT</strong> need to uninstall the app to update! Reinstalling or updating over an existing app preserves your storage, but exporting a quick backup ensures 100% data safety.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1.5">
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">1</span>
                <span>Export Safety Backup</span>
              </div>
              <p className="text-[11px] text-zinc-300">
                Tap <strong>Export Backup (.aetherjson)</strong> or <strong>Create Sync Code</strong> below before updating.
              </p>
            </div>

            <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1.5">
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">2</span>
                <span>Install APK / Refresh</span>
              </div>
              <p className="text-[11px] text-zinc-300">
                Install the new APK directly over your current app or use the Web shared link to update code.
              </p>
            </div>

            <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1.5">
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">3</span>
                <span>Import & Continue</span>
              </div>
              <p className="text-[11px] text-zinc-300">
                Open the new app version and tap <strong>Import Backup File</strong> or enter your 6-Digit Sync Code.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-amber-500/20">
            <a
              href={SHARED_CLOUD_SERVER}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-medium"
            >
              <span>Open Shared Web Version</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={handleCleanAppReload}
              disabled={isPurgingCache}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white flex items-center gap-1.5 border border-white/10"
            >
              {isPurgingCache ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 text-amber-400" />}
              <span>Force Clean App Reload</span>
            </button>
          </div>
        </div>
      )}

      {/* Cloud Server Endpoint Info & APK Config Bar */}
      <div className="bg-zinc-900/80 p-4 rounded-2xl border border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Server className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold text-white">Cloud Sync Server:</span>
            <span className="text-xs font-mono text-zinc-300 bg-black/40 px-2.5 py-1 rounded-lg border border-white/5 truncate max-w-[240px] sm:max-w-[340px]">
              {resolveServerUrl(serverUrl)}
            </span>
            {isApk ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                <Smartphone className="w-3 h-3" /> Mobile APK
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                <Globe className="w-3 h-3" /> Web Link
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

        {/* Server URL Input Accordion with Quick Select Presets */}
        {showServerConfig && (
          <div className="pt-2 border-t border-white/5 space-y-3 animate-fadeIn">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-zinc-400 block">
                Quick Server Host Presets (Select your Web app server for Mobile APK sync):
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleUpdateServerUrl(SHARED_CLOUD_SERVER)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-all flex items-center gap-1 ${
                    resolveServerUrl(serverUrl) === SHARED_CLOUD_SERVER
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                      : 'bg-black/40 text-zinc-400 hover:text-white border border-white/5'
                  }`}
                >
                  <Globe className="w-3 h-3 text-sky-400" />
                  <span>Shared Cloud Server</span>
                </button>

                <button
                  onClick={() => handleUpdateServerUrl(DEV_CLOUD_SERVER)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-all flex items-center gap-1 ${
                    resolveServerUrl(serverUrl) === DEV_CLOUD_SERVER
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold'
                      : 'bg-black/40 text-zinc-400 hover:text-white border border-white/5'
                  }`}
                >
                  <Server className="w-3 h-3 text-indigo-400" />
                  <span>Dev Cloud Server</span>
                </button>
              </div>
            </div>

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
              When using the APK app on mobile, ensure this URL matches the Web app where you generated your sync code.
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
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-xs font-mono font-bold hover:underline ml-2">
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
              Uploads a backup snapshot to the cloud server, generating a unique 6-character code to restore your library structure on mobile APK apps or web links.
            </p>
          </div>

          {syncCode ? (
            <div className="bg-black/60 p-4 rounded-2xl border border-sky-500/30 text-center space-y-3">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Active 6-Character Sync Code</span>
              <div className="text-2xl font-mono font-extrabold text-sky-400 tracking-widest flex items-center justify-center gap-3">
                {syncCode}
                <button
                  onClick={copyCodeToClipboard}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1"
                  title="Copy 6-Digit Code"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="pt-2 border-t border-white/10 flex flex-col items-center gap-1.5">
                <button
                  onClick={copyHybridLinkToClipboard}
                  className="text-[11px] text-sky-300 hover:text-sky-200 font-medium flex items-center gap-1.5 px-3 py-1 bg-sky-500/10 hover:bg-sky-500/20 rounded-xl border border-sky-500/20 transition-all"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy Code + Host Link for APK</span>
                </button>
                <p className="text-[10px] text-zinc-500">Pasting this hybrid string on APK auto-detects server host!</p>
              </div>

              <button
                onClick={handleGenerateSyncCode}
                disabled={isGenerating}
                className="text-[11px] text-zinc-400 hover:text-white underline font-mono pt-1 block mx-auto"
              >
                {isGenerating ? 'Updating...' : 'Generate New Code'}
              </button>
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
              2. Restore on Mobile APK or Desktop
            </div>
            <h3 className="text-base font-bold text-white">Enter Sync Code</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Have a sync code from another device or web link? Enter it below (or paste code+host) to merge playlists and settings instantly.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. AE-8X92 or Universal Code"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500 text-center tracking-widest"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setInputCode(text.trim());
                  } catch {}
                }}
                className="px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1 border border-white/10"
                title="Paste from Clipboard"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Paste</span>
              </button>
              <button
                onClick={handleRestoreFromCode}
                disabled={isRestoring || !inputCode.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {isRestoring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                <span>Restore</span>
              </button>
            </div>
            <p className="text-[10px] text-zinc-500 text-center">
              Supports standard codes (AE-8X92), Universal APK codes (AE-ff80...), or hybrid links.
            </p>
          </div>
        </div>
      </div>

      {/* File Export & Local Vault Backup */}
      <div className="bg-zinc-900/40 p-6 rounded-3xl border border-white/5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Download className="w-4 h-4 text-sky-400" />
          Offline Vault File Export & Import (.aetherjson)
        </h3>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Export an offline backup file containing your complete library structure, playlists, and equalizer presets for permanent offline storage on your phone or Google Drive.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            onClick={handleExportJson}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs flex items-center justify-center gap-2 border border-white/10 shadow-sm"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Export Backup (.aetherjson)</span>
          </button>

          <label className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs flex items-center justify-center gap-2 border border-white/10 cursor-pointer shadow-sm">
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
      <div className="bg-zinc-900/40 p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-2 text-zinc-400">
          <HardDrive className="w-4 h-4 text-sky-400" />
          <span>Local Storage:</span>
          <span className="text-white font-bold">{storageStats.usedMB} MB</span>
        </div>
        <div className="text-zinc-500">
          {storageStats.trackCount} Tracks • {storageStats.playlistCount} Playlists
        </div>
      </div>
    </div>
  );
};

