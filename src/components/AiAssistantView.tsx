import React, { useState } from "react";
import {
  Send,
  Plus,
  Sparkles,
  Trash2,
  ArrowUpRight,
  AudioLines,
  ShieldCheck,
  SlidersHorizontal,
  Disc3,
} from "lucide-react";
import { Track, EQSettings } from "../types";
import { requestApi } from "../services/api";
interface Message {
  role: "user" | "assistant";
  content: string;
  preset?: string;
  bands?: number[];
}
interface Session {
  id: string;
  messages: Message[];
}
export function AiAssistantView({
  tracks,
  eqSettings,
  currentTrack,
  onApplyEQPreset,
}: {
  tracks: Track[];
  eqSettings: EQSettings;
  currentTrack?: Track | null;
  onApplyEQPreset?: (name: string, bands: number[]) => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([
    { id: "first", messages: [] },
  ]);
  const [active, setActive] = useState("first");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const session = sessions.find((s) => s.id === active)!;
  const append = (id: string, message: Message) =>
    setSessions((all) =>
      all.map((s) =>
        s.id === id ? { ...s, messages: [...s.messages, message] } : s,
      ),
    );
  async function send() {
    if (!text.trim() || busy || text.length > 2000) return;
    const id = active,
      message = text.trim();
    const history = session.messages
      .slice(-12)
      .map(({ role, content }) => ({ role, content: content.slice(0, 4000) }));
    append(id, { role: "user", content: message });
    setText("");
    setBusy(true);
    setError("");
    try {
      const result = await requestApi("/api/ai", {
        message,
        history,
        eqState: eqSettings,
        currentTrack: currentTrack
          ? {
              title: currentTrack.title,
              artist: currentTrack.artist,
              format: currentTrack.format,
            }
          : null,
        library: {
          count: tracks.length,
          artists: [...new Set(tracks.map((t) => t.artist))].slice(0, 20),
        },
      });
      append(id, {
        role: "assistant",
        content: result.reply,
        preset: result.suggestedPreset,
        bands: result.bands,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assistant unavailable");
      navigator.vibrate?.(150);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="assistant-page">
      <div className="page-intro">
        <div>
          <div className="eyebrow">YOUR PERSONAL SOUND CONSULTANT</div>
          <h1>Good sound is personal.</h1>
          <p>A little guidance. A whole new way to hear your music.</p>
        </div>
        <Sparkles size={24} className="page-symbol" />
      </div>
      <div className="assistant-chat">
        <header className="chat-header">
          <div>
            <span className="assistant-icon">
              <AudioLines size={20} />
            </span>
            <div>
              <strong>Aether sound assistant</strong>
              <small>Thoughtful advice. Tuned to you.</small>
            </div>
          </div>
          <div className="chat-actions">
            <select
              aria-label="Chat session"
              value={active}
              onChange={(e) => setActive(e.target.value)}
            >
              {sessions.map((s, i) => (
                <option key={s.id} value={s.id}>
                  Session {i + 1}
                </option>
              ))}
            </select>
            <button
              className="icon-button"
              aria-label="New session"
              onClick={() => {
                const id = crypto.randomUUID();
                setSessions((s) => [...s, { id, messages: [] }]);
                setActive(id);
              }}
            >
              <Plus size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Clear session"
              disabled={busy}
              onClick={() =>
                setSessions((s) =>
                  s.map((x) => (x.id === active ? { ...x, messages: [] } : x)),
                )
              }
            >
              <Trash2 size={15} />
            </button>
          </div>
        </header>
        <div className="chat-messages" aria-live="polite">
          {!session.messages.length && (
            <div className="assistant-welcome">
              <span className="welcome-orbit">
                <Sparkles size={30} strokeWidth={1} />
              </span>
              <div className="eyebrow">A BETTER LISTEN STARTS HERE</div>
              <h2>Find your kind of perfect.</h2>
              <p>
                Shape your sound, understand your audio,
                <br />
                or find a fresh perspective on your collection.
              </p>
              <div className="prompt-grid">
                {[
                  {
                    icon: SlidersHorizontal,
                    title: "Shape my sound",
                    text: "Suggest a warm, detailed EQ curve for my headphones.",
                  },
                  {
                    icon: Disc3,
                    title: "Understand hi-res",
                    text: "What do bit depth and sample rate mean for my music?",
                  },
                  {
                    icon: AudioLines,
                    title: "Fine-tune this track",
                    text: "What EQ adjustments would suit the current track and why?",
                  },
                ].map((prompt) => (
                  <button
                    key={prompt.title}
                    onClick={() => setText(prompt.text)}
                  >
                    <prompt.icon size={18} />
                    <strong>{prompt.title}</strong>
                    <span>{prompt.text}</span>
                    <ArrowUpRight size={13} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {session.messages.map((m, i) => (
            <article key={i} className={`chat-bubble ${m.role}`}>
              <small>{m.role === "user" ? "YOU" : "AETHER"}</small>
              <p>{m.content}</p>
              {m.bands && (
                <button
                  className="button-primary"
                  onClick={() =>
                    onApplyEQPreset?.(m.preset || "AI suggestion", m.bands!)
                  }
                >
                  <SlidersHorizontal size={14} /> Apply{" "}
                  {m.preset || "EQ preset"}
                </button>
              )}
            </article>
          ))}
          {busy && (
            <p className="chat-pending">
              <span className="status-dot" /> Finding your frequency…
            </p>
          )}
          {error && (
            <p role="alert" className="chat-error">
              {error}
            </p>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="chat-composer"
        >
          <textarea
            aria-label="Message"
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tell me how you like to listen…"
            rows={2}
          />
          <span>{text.length}/2000</span>
          <button aria-label="Send message" disabled={busy || !text.trim()}>
            <Send size={17} />
          </button>
        </form>
        <p className="chat-privacy">
          <ShieldCheck size={12} /> Optional online feature. Messages and
          limited library context go to your configured AI provider. Never your
          audio.
        </p>
      </div>
    </section>
  );
}
