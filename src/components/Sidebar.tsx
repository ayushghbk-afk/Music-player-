import React from "react";
import {
  AudioLines,
  Library,
  Disc3,
  ListMusic,
  SlidersHorizontal,
  ArrowUpFromLine,
  Sparkles,
  Database,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  ShieldCheck,
  Heart,
} from "lucide-react";
import { ThemeOption } from "../types";
export type NavView =
  | "songs"
  | "hires"
  | "albums"
  | "playlists"
  | "equalizer"
  | "backup"
  | "import"
  | "admin"
  | "ai-assistant";
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
  isAdmin?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}
export function Sidebar(p: SidebarProps) {
  const groups = [
    {
      label: "YOUR COLLECTION",
      items: [
        {
          id: "songs",
          label: "Music library",
          icon: Library,
          count: p.totalTrackCount,
        },
        {
          id: "hires",
          label: "Hi-res collection",
          icon: AudioLines,
          count: p.hiResCount,
        },
        { id: "albums", label: "Albums & artists", icon: Disc3 },
        {
          id: "playlists",
          label: "Playlists",
          icon: ListMusic,
          count: p.playlistCount,
        },
      ],
    },
    {
      label: "YOUR STUDIO",
      items: [
        {
          id: "equalizer",
          label: "Equalizer",
          icon: SlidersHorizontal,
          count: p.eqEnabled ? "ON" : undefined,
        },
        { id: "ai-assistant", label: "Sound assistant", icon: Sparkles },
        { id: "backup", label: "Backup & sync", icon: Database },
        ...(p.isAdmin ? [{ id: "admin", label: "Admin dashboard", icon: ShieldCheck }] : []),
      ],
    },
  ];
  return (
    <aside className={`studio-sidebar ${p.isCollapsed ? "collapsed" : ""}`}>
      <div className="brand">
        <div className="brand-icon">
          <AudioLines size={25} strokeWidth={1.8} />
        </div>
        {!p.isCollapsed && (
          <div>
            <strong>
              aether<span>®</span>
            </strong>
            <small>THE ART OF LISTENING</small>
          </div>
        )}
        <button
          className="collapse-button icon-button"
          onClick={p.onToggleCollapse}
          aria-label={p.isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {p.isCollapsed ? (
            <ChevronRight size={14} />
          ) : (
            <ChevronLeft size={14} />
          )}
        </button>
      </div>
      <div className="sidebar-scroll">
        {groups.map((group) => (
          <div className="nav-group" key={group.label}>
            {!p.isCollapsed && <p className="eyebrow">{group.label}</p>}
            {group.items.map((item) => (
              <button
                key={item.id}
                title={item.label}
                onClick={() => p.onSelectView(item.id as NavView)}
                className={`nav-item ${p.currentView === item.id ? "active" : ""}`}
                aria-current={p.currentView === item.id ? "page" : undefined}
              >
                <item.icon size={18} strokeWidth={1.6} />
                {!p.isCollapsed && (
                  <>
                    <span>{item.label}</span>
                    {item.count !== undefined && <small>{item.count}</small>}
                  </>
                )}
              </button>
            ))}
          </div>
        ))}
        {!p.isCollapsed && (
          <div className="sidebar-note">
            <Heart size={16} />
            <p>
              Made for music.
              <br />
              <span>Not for the algorithm.</span>
            </p>
          </div>
        )}
      </div>
      <div className="sidebar-footer">
        <button
          className="import-button"
          onClick={p.onTriggerImport}
          title="Import music"
        >
          <ArrowUpFromLine size={17} />
          {!p.isCollapsed && "Import music"}
        </button>
        {!p.isCollapsed && (
          <>
            <div className="storage-heading">
              <span>
                <HardDrive size={13} /> Local storage
              </span>
              <span>{p.storageUsedMB.toFixed(1)} MB</span>
            </div>
            <div className="storage-meter">
              <i
                style={{
                  width: `${Math.min(100, Math.max(3, p.storageUsedMB / 20))}%`,
                }}
              />
            </div>
            <p className="storage-caption">
              <ShieldCheck size={12} /> Your music stays yours.
            </p>
            <div className="theme-picker">
              <span>Appearance</span>
              {(
                [
                  "obsidian",
                  "sapphire",
                  "cyberpunk",
                  "studio-gold",
                  "slate",
                ] as ThemeOption[]
              ).map((t) => (
                <button
                  key={t}
                  className={`theme-dot ${t} ${p.theme === t ? "selected" : ""}`}
                  title={t}
                  aria-label={`${t} theme`}
                  aria-pressed={p.theme === t}
                  onClick={() => p.onSelectTheme(t)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
