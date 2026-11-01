import React from "react";
import {
  Library,
  AudioLines,
  Disc3,
  ListMusic,
  SlidersHorizontal,
  Sparkles,
  Database,
} from "lucide-react";
import { NavView } from "./Sidebar";
interface MobileBottomNavProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  onTriggerImport: () => void;
  hiResCount: number;
  totalTrackCount: number;
  eqEnabled?: boolean;
}
export function MobileBottomNav({
  currentView,
  onSelectView,
}: MobileBottomNavProps) {
  const items = [
    { id: "songs", label: "Library", icon: Library },
    { id: "hires", label: "Hi-res", icon: AudioLines },
    { id: "albums", label: "Albums", icon: Disc3 },
    { id: "playlists", label: "Playlists", icon: ListMusic },
    { id: "equalizer", label: "Studio", icon: SlidersHorizontal },
    { id: "ai-assistant", label: "Assistant", icon: Sparkles },
    { id: "backup", label: "Backup", icon: Database },
  ];
  return (
    <nav className="mobile-navigation" aria-label="Main navigation">
      {items.map((item) => (
        <button
          key={item.id}
          className={currentView === item.id ? "active" : ""}
          onClick={() => onSelectView(item.id as NavView)}
          aria-current={currentView === item.id ? "page" : undefined}
        >
          <item.icon size={19} strokeWidth={1.7} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
