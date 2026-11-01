import React, { useEffect } from "react";
import {
  Library,
  AudioLines,
  Disc3,
  ListMusic,
  SlidersHorizontal,
  Sparkles,
  Database,
  Ellipsis,
  ChevronRight,
  Upload,
  Settings2,
  X,
  ShieldCheck,
  Check,
  Palette,
} from "lucide-react";
import { NavView } from "./Sidebar";
import { ThemeOption } from "../types";
import { useDialogFocus } from "./useDialogFocus";
interface MobileBottomNavProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  onTriggerImport: () => void;
  hiResCount: number;
  totalTrackCount: number;
  eqEnabled?: boolean;
  isMoreOpen: boolean;
  onMoreOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
  theme: ThemeOption;
  onSelectTheme: (theme: ThemeOption) => void;
}
export function MobileBottomNav(p: MobileBottomNavProps) {
  useEffect(() => {
    const desktop = window.matchMedia(
      "(min-width: 768px) and (hover: hover), (min-width: 1024px)",
    );
    const close = () => {
      if (desktop.matches) p.onMoreOpenChange(false);
    };
    desktop.addEventListener("change", close);
    return () => desktop.removeEventListener("change", close);
  }, [p.onMoreOpenChange]);
  const ref = useDialogFocus(p.isMoreOpen, () => p.onMoreOpenChange(false));
  const items = [
    { id: "songs", label: "Library", icon: Library },
    { id: "albums", label: "Albums", icon: Disc3 },
    { id: "playlists", label: "Playlists", icon: ListMusic },
    { id: "equalizer", label: "Studio", icon: SlidersHorizontal },
  ];
  const moreActive = !items.some((item) => item.id === p.currentView);
  const go = (view: NavView) => {
    p.onMoreOpenChange(false);
    p.onSelectView(view);
  };
  const themes: { id: ThemeOption; name: string }[] = [
    { id: "obsidian", name: "Copper" },
    { id: "sapphire", name: "Sapphire" },
    { id: "cyberpunk", name: "Rose" },
    { id: "studio-gold", name: "Gold" },
    { id: "slate", name: "Sage" },
  ];
  return (
    <>
      <nav className="mobile-navigation" aria-label="Main navigation">
        {items.map((item) => (
          <button
            key={item.id}
            className={p.currentView === item.id ? "active" : ""}
            onClick={() => go(item.id as NavView)}
            aria-current={p.currentView === item.id ? "page" : undefined}
          >
            <span className="mobile-tab-icon">
              <item.icon size={21} strokeWidth={1.65} />
            </span>
            <span>{item.label}</span>
          </button>
        ))}
        <button
          className={moreActive || p.isMoreOpen ? "active" : ""}
          aria-label="More options"
          aria-expanded={p.isMoreOpen}
          aria-controls="mobile-more-sheet"
          onClick={() => p.onMoreOpenChange(!p.isMoreOpen)}
        >
          <span className="mobile-tab-icon">
            <Ellipsis size={23} />
          </span>
          <span>More</span>
        </button>
      </nav>
      {p.isMoreOpen && (
        <div
          className="mobile-sheet-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) p.onMoreOpenChange(false);
          }}
        >
          <section
            ref={ref}
            id="mobile-more-sheet"
            className="mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Your listening space"
          >
            <div className="sheet-grabber" />
            <header>
              <div>
                <div className="eyebrow">MAKE IT YOURS</div>
                <h2>
                  Your listening space<span>.</span>
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close more options"
                onClick={() => p.onMoreOpenChange(false)}
              >
                <X size={20} />
              </button>
            </header>
            <button
              className="mobile-import-card"
              onClick={() => {
                p.onMoreOpenChange(false);
                p.onTriggerImport();
              }}
            >
              <span>
                <Upload size={21} />
              </span>
              <div>
                <strong>Bring your music</strong>
                <small>Your files. Your collection. All offline.</small>
              </div>
              <ChevronRight size={18} />
            </button>
            <div className="mobile-more-links">
              <button onClick={() => go("hires")}>
                <AudioLines size={20} />
                <div>
                  <strong>Hi-res collection</strong>
                  <small>Every detail in your recordings</small>
                </div>
                <span>{p.hiResCount}</span>
                <ChevronRight size={16} />
              </button>
              <button onClick={() => go("ai-assistant")}>
                <Sparkles size={20} />
                <div>
                  <strong>Sound assistant</strong>
                  <small>A little guidance, tuned to you</small>
                </div>
                <ChevronRight size={16} />
              </button>
              <button onClick={() => go("backup")}>
                <Database size={20} />
                <div>
                  <strong>Backup & sync</strong>
                  <small>Keep your collection close</small>
                </div>
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => {
                  p.onMoreOpenChange(false);
                  p.onOpenSettings();
                }}
              >
                <Settings2 size={20} />
                <div>
                  <strong>Playback preferences</strong>
                  <small>Speed, autoplay & listening options</small>
                </div>
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="mobile-theme-heading">
              <span>
                <Palette size={14} /> Set the mood
              </span>
              <small>Appearance</small>
            </div>
            <div className="mobile-themes">
              {themes.map((theme) => (
                <button
                  aria-label={`${theme.name} appearance`}
                  aria-pressed={p.theme === theme.id}
                  key={theme.id}
                  onClick={() => p.onSelectTheme(theme.id)}
                >
                  <span className={`theme-swatch ${theme.id}`}>
                    {p.theme === theme.id && <Check size={15} />}
                  </span>
                  <small>{theme.name}</small>
                </button>
              ))}
            </div>
            <p className="mobile-sheet-footer">
              <ShieldCheck size={13} /> {p.totalTrackCount} tracks on this
              device. Your music stays yours.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
