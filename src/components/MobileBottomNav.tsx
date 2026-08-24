import React from 'react';
import {
  Music,
  Sparkles,
  Disc,
  ListMusic,
  Sliders,
  RefreshCw,
  Upload,
  Bot
} from 'lucide-react';
import { NavView } from './Sidebar';

interface MobileBottomNavProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  onTriggerImport: () => void;
  hiResCount: number;
  totalTrackCount: number;
  eqEnabled?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onSelectView,
  onTriggerImport,
  hiResCount,
  totalTrackCount,
  eqEnabled,
}) => {
  const items: { id: NavView; label: string; icon: React.ElementType; badge?: string; badgeColor?: string }[] = [
    { id: 'songs', label: 'Library', icon: Music, badge: totalTrackCount ? `${totalTrackCount}` : undefined },
    { id: 'hires', label: 'Hi-Res', icon: Sparkles, badge: hiResCount ? `${hiResCount}` : undefined },
    {
      id: 'equalizer',
      label: 'EQ',
      icon: Sliders,
      badge: eqEnabled ? 'ON' : 'OFF',
      badgeColor: eqEnabled ? 'bg-emerald-500 text-black font-bold' : 'bg-zinc-800 text-zinc-400',
    },
    { id: 'ai-assistant', label: 'Sound', icon: Bot, badge: 'EQ' },
    { id: 'playlists', label: 'Playlists', icon: ListMusic },
    { id: 'backup', label: 'Sync', icon: RefreshCw },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/92 backdrop-blur-2xl border-t border-white/10 px-2 pt-1.5 pb-[calc(0.35rem+env(safe-area-inset-bottom,0px))] flex items-center gap-1 overflow-x-auto no-scrollbar select-none shadow-[0_-18px_50px_rgba(0,0,0,0.55)]">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectView(item.id)}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all relative min-w-[56px] min-h-[48px] active:scale-95 flex-shrink-0 ${
              isActive
                ? 'text-white font-bold bg-white/10 border border-white/10 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110 text-indigo-300' : ''} transition-transform`} />
              {item.badge && (
                <span className={`absolute -top-1.5 -right-2 text-[8px] font-mono px-1 rounded-full border border-black min-w-[12px] text-center ${item.badgeColor || 'bg-indigo-600 text-white'}`}>
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            {isActive && (
              <span className="w-1 h-1 bg-indigo-500 rounded-full mt-0.5 shadow-[0_0_6px_rgba(99,102,241,1)]" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
