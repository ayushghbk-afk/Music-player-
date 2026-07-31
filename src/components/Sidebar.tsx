import React from 'react';
import {
  Music,
  Disc,
  Radio,
  Sliders,
  RefreshCw,
  Upload,
  Sparkles,
  ListMusic,
  HardDrive,
  Layers,
  Palette,
  Volume2,
  Bot,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ThemeOption } from '../types';

export type NavView =
  | 'songs'
  | 'hires'
  | 'albums'
  | 'playlists'
  | 'equalizer'
  | 'backup'
  | 'import'
  | 'ai-assistant';

interface SidebarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  hiResCount: number;
  totalTrackCount: number;
  playlistCount: number;
  storageUsedMB: number;
  theme: ThemeOption;
  onSelectTheme: (theme: ThemeOption) => void;
  onTriggerImport: () => void;
  eqEnabled?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  hiResCount,
  totalTrackCount,
  playlistCount,
  storageUsedMB,
  theme,
  onSelectTheme,
  onTriggerImport,
  eqEnabled,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const navItems = [
    {
      id: 'songs' as NavView,
      label: 'All Tracks',
      icon: Music,
      badge: totalTrackCount > 0 ? `${totalTrackCount}` : undefined,
    },
    {
      id: 'hires' as NavView,
      label: 'Hi-Res Masters',
      icon: Sparkles,
      badge: hiResCount > 0 ? `${hiResCount}` : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'albums' as NavView,
      label: 'Albums & Artists',
      icon: Disc,
    },
    {
      id: 'playlists' as NavView,
      label: 'Playlists',
      icon: ListMusic,
      badge: playlistCount > 0 ? `${playlistCount}` : undefined,
    },
    {
      id: 'equalizer' as NavView,
      label: 'Studio EQ & FX',
      icon: Sliders,
      badge: eqEnabled ? 'ON' : undefined,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold shadow-sm',
    },
    {
      id: 'ai-assistant' as NavView,
      label: 'AI Audio Engineer',
      icon: Bot,
      badge: 'AI',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    },
    {
      id: 'backup' as NavView,
      label: 'Cloud Sync & Backup',
      icon: RefreshCw,
    },
  ];

  const themeOptions: { id: ThemeOption; label: string; color: string }[] = [
    { id: 'obsidian', label: 'Obsidian', color: 'bg-zinc-900 border-sky-500' },
    { id: 'sapphire', label: 'Sapphire', color: 'bg-slate-900 border-indigo-500' },
    { id: 'cyberpunk', label: 'Cyberpunk', color: 'bg-zinc-950 border-pink-500' },
    { id: 'studio-gold', label: 'Studio Gold', color: 'bg-amber-950/80 border-amber-500' },
    { id: 'slate', label: 'Dark Slate', color: 'bg-slate-800 border-teal-500' },
  ];

  return (
    <aside
      className={`hidden md:flex flex-shrink-0 bg-black/40 backdrop-blur-2xl border-r border-white/5 flex-col justify-between h-full select-none bg-gradient-to-b from-transparent via-black/20 to-black/40 transition-all duration-300 ${
        isCollapsed ? 'w-16 p-3 items-center' : 'w-64 p-5'
      }`}
    >
      <div className="space-y-5 w-full">
        {/* Brand Header & Collapse Toggle */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-1 py-1`}>
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 bg-indigo-500 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.8)] flex-shrink-0 animate-pulse" />
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-bold text-white text-sm tracking-tight">AETHER AUDIO</h1>
                  <span className="text-[9px] uppercase font-mono font-bold tracking-widest px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    24-BIT
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 font-mono">Hi-Res Lossless Studio</p>
              </div>
            </div>
          )}

          {isCollapsed && (
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs shadow-md">
              A
            </div>
          )}

          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors hidden lg:flex"
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Quick Import Button */}
        <button
          onClick={onTriggerImport}
          className={`w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all duration-200 active:scale-[0.98] ${
            isCollapsed ? 'p-2.5' : 'py-2.5 px-3'
          }`}
          title="Import Local Music"
        >
          <Upload className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span>Import Music</span>}
        </button>

        {/* Main Navigation */}
        <div className="space-y-1 w-full">
          {!isCollapsed && (
            <p className="px-3 text-[10px] font-bold text-white/30 tracking-[0.2em] uppercase mb-3">
              Offline Library
            </p>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                title={item.label}
                className={`w-full flex items-center rounded-xl text-xs font-medium transition-all duration-150 ${
                  isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-white/10 text-white shadow-sm border border-white/10'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-indigo-400' : 'text-zinc-400'}`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>
                {!isCollapsed && item.badge && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      item.badgeColor || 'bg-zinc-800 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer & Storage Meter */}
      {!isCollapsed && (
        <div className="space-y-4 pt-4 border-t border-white/5 w-full">
          {/* Theme Picker */}
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-zinc-400" />
                Theme Mode
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/5">
              {themeOptions.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelectTheme(t.id)}
                  title={t.label}
                  className={`h-6 rounded-lg ${t.color} border transition-all ${
                    theme === t.id ? 'scale-110 shadow-md ring-2 ring-indigo-400' : 'opacity-60 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Offline Storage Meter */}
          <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 text-[11px] flex items-center gap-1.5 font-medium">
                <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                Offline Vault
              </span>
              <span className="text-zinc-300 font-mono text-[11px]">{storageUsedMB} MB</span>
            </div>
            <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
              <div
                className="bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, (storageUsedMB / 2000) * 100))}%` }}
              />
            </div>
            <p className="text-[10px] text-white/40 text-right">IndexedDB Storage</p>
          </div>
        </div>
      )}
    </aside>
  );
};

