import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  X,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Copy,
  Check,
  ShieldAlert,
  Layers,
  Terminal,
  Play
} from 'lucide-react';

interface AndroidApkModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onTriggerPwaInstall: () => void;
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onTriggerPwaInstall,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [activeTab, setActiveTab] = useState<'pwa' | 'pwabuilder' | 'capacitor'>('pwa');

  if (!isOpen) return null;

  const appUrl = window.location.href;
  const pwabuilderUrl = `https://www.pwabuilder.com/?url=${encodeURIComponent(appUrl)}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(appUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-indigo-500/30 rounded-3xl shadow-[0_0_50px_rgba(99,102,241,0.2)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-950/80 via-zinc-900 to-zinc-950 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/20 border border-indigo-500/40 rounded-2xl text-indigo-400">
              <Smartphone className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-white tracking-wide">
                  Android APK & Native App Center
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ANDROID
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Install as a full standalone Android App with background audio support
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-black/40 px-6 pt-3 gap-2 flex-shrink-0">
          <button
            onClick={() => setActiveTab('pwa')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'pwa'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            1. WebAPK Install (Instant)
          </button>
          <button
            onClick={() => setActiveTab('pwabuilder')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'pwabuilder'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            2. PWABuilder (.APK Download)
          </button>
          <button
            onClick={() => setActiveTab('capacitor')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'capacitor'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            3. Capacitor Native Build
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* TAB 1: Instant WebAPK PWA */}
          {activeTab === 'pwa' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Recommended for Android (No Sideloading Required)
                  </h4>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Android Chrome automatically wraps this app into an official <strong className="text-indigo-300">WebAPK</strong>. Once installed, it behaves 100% like a native APK: it creates a launcher icon in your Android app drawer, operates offline, supports full lockscreen media controls, and runs in fullscreen standalone mode.
                  </p>
                </div>
              </div>

              {deferredPrompt ? (
                <button
                  onClick={onTriggerPwaInstall}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-sky-500 hover:from-indigo-500 hover:to-sky-400 text-white font-bold text-sm flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/25 transition-all active:scale-98"
                >
                  <Smartphone className="w-5 h-5" />
                  <span>TAP HERE TO INSTALL ANDROID APP NOW</span>
                </button>
              ) : (
                <div className="bg-zinc-900/80 p-5 rounded-2xl border border-white/10 space-y-4">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    How to Install on Chrome / Android Browser:
                  </h4>
                  <ol className="space-y-2.5 text-xs text-zinc-300 list-decimal list-inside font-medium leading-relaxed">
                    <li>Open this page in <strong className="text-white">Google Chrome</strong> on your Android phone.</li>
                    <li>Tap the <strong className="text-white">three dots menu (⋮)</strong> at the top right of Chrome.</li>
                    <li>Tap <strong className="text-indigo-300">"Add to Home screen"</strong> or <strong className="text-indigo-300">"Install app"</strong>.</li>
                    <li>Confirm installation. The app will generate a native Android APK wrapper icon on your home screen!</li>
                  </ol>
                </div>
              )}

              <div className="bg-black/40 p-4 rounded-xl border border-white/5 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400 truncate max-w-[320px]">{appUrl}</span>
                <button
                  onClick={handleCopyUrl}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-sans text-xs transition-colors"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'Copied' : 'Copy URL'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: PWABuilder (.APK Download) */}
          {activeTab === 'pwabuilder' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 bg-sky-500/10 border border-sky-500/20 rounded-2xl space-y-2">
                <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Convert to Signed Android APK File (.apk / .aab)
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  You can generate a downloadable <strong className="text-white font-semibold">.APK file</strong> or <strong className="text-white font-semibold">Google Play .AAB bundle</strong> using PWABuilder (Microsoft's official open-source PWA-to-APK tool).
                </p>
              </div>

              <div className="bg-zinc-900/80 p-5 rounded-2xl border border-white/10 space-y-3">
                <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                  Steps to download your .APK file:
                </h5>
                <ol className="space-y-2 text-xs text-zinc-300 list-decimal list-inside leading-relaxed">
                  <li>Click the button below to open <strong className="text-sky-300">PWABuilder.com</strong> with your app preloaded.</li>
                  <li>Click <strong className="text-white">"Package for Store"</strong> or <strong className="text-white">"Generate Android App"</strong>.</li>
                  <li>Select <strong className="text-emerald-400">Android APK / WebAPK</strong> and click Download.</li>
                  <li>Install the downloaded <code className="bg-black px-1.5 py-0.5 rounded text-sky-300 font-mono">.apk</code> file directly on your Android phone!</li>
                </ol>

                <div className="pt-2">
                  <a
                    href={pwabuilderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all active:scale-98"
                  >
                    <span>OPEN PWABUILDER TO DOWNLOAD .APK FILE</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Capacitor Native Build */}
          {activeTab === 'capacitor' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl space-y-2">
                <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Full Capacitor Android Studio Native Build
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  This project includes pre-configured <code className="bg-black px-1 py-0.5 rounded text-purple-300 font-mono">capacitor.config.json</code> and Capacitor dependencies. You can export this project to build a custom native Android Studio app.
                </p>
              </div>

              <div className="bg-black/60 p-4 rounded-2xl border border-white/10 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-zinc-400 border-b border-white/10 pb-2">
                  <span className="flex items-center gap-1.5 font-bold text-indigo-400">
                    <Terminal className="w-4 h-4" />
                    Android Build Commands:
                  </span>
                </div>
                <div className="space-y-1.5 text-zinc-300">
                  <p className="text-zinc-500"># 1. Export or clone codebase, then install dependencies:</p>
                  <p className="text-emerald-400">npm install</p>
                  <p className="text-zinc-500 mt-2"># 2. Build web assets & sync with Capacitor Android:</p>
                  <p className="text-emerald-400">npm run build:android</p>
                  <p className="text-zinc-500 mt-2"># 3. Add Android platform & launch in Android Studio:</p>
                  <p className="text-emerald-400">npx cap add android</p>
                  <p className="text-emerald-400">npx cap open android</p>
                  <p className="text-zinc-500 mt-2"># 4. In Android Studio: Build -&gt; Build APK / Bundle</p>
                </div>
              </div>

              <div className="p-3 bg-zinc-900 rounded-xl border border-white/5 text-[11px] text-zinc-400 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>To export the project files, open the Settings menu in AI Studio and select <strong>Export to ZIP</strong> or <strong>Push to GitHub</strong>.</span>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-black/60 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400 flex-shrink-0">
          <span className="flex items-center gap-1.5 text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Supports Background Audio, Equalizer & Offline Storage
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
