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
    { id: 'ai-assistant', label: 'AI Chat', icon: Bot, badge: 'AI' },
    { id: 'playlists', label: 'Playlists', icon: ListMusic },
    { id: 'backup', label: 'Sync', icon: RefreshCw },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 z-40 bg-zinc-950/95 backdrop-blur-2xl border-t border-white/10 px-1 flex items-center justify-around select-none">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectView(item.id)}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all relative min-w-[52px] ${
              isActive ? 'text-indigo-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
              {item.badge && (
                <span className={`absolute -top-1.5 -right-2 text-[8px] font-mono px-1 rounded-full border border-black min-w-[12px] text-center ${item.badgeColor || 'bg-indigo-600 text-white'}`}>
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
            {isActive && (
              <span className="w-1 h-1 bg-indigo-500 rounded-full mt-0.5 shadow-[0_0_6px_rgba(99,102,241,1)]" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
