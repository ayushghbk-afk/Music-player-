import React, { useState } from 'react';
import { Send, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Track, EQSettings } from '../types';
import { requestApi } from '../services/api';
interface Message { role: 'user' | 'assistant'; content: string; preset?: string; bands?: number[] }
interface Session { id: string; messages: Message[] }
export function AiAssistantView({ tracks, eqSettings, currentTrack, onApplyEQPreset }: { tracks: Track[]; eqSettings: EQSettings; currentTrack?: Track | null; onApplyEQPreset?: (name: string, bands: number[]) => void }) {
  const [sessions, setSessions] = useState<Session[]>([{ id: 'first', messages: [] }]);
  const [active, setActive] = useState('first');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const session = sessions.find(s => s.id === active)!;
  const append = (id: string, message: Message) => setSessions(all => all.map(s => s.id === id ? { ...s, messages: [...s.messages, message] } : s));
  async function send() {
    if (!text.trim() || busy || text.length > 2000) return;
    const id = active, message = text.trim();
    const history = session.messages.slice(-12).map(({ role, content }) => ({ role, content: content.slice(0, 4000) }));
    append(id, { role: 'user', content: message }); setText(''); setBusy(true); setError('');
    try {
      const result = await requestApi('/api/ai', { message, history, eqState: eqSettings, currentTrack: currentTrack ? { title: currentTrack.title, artist: currentTrack.artist, format: currentTrack.format } : null, library: { count: tracks.length, artists: [...new Set(tracks.map(t => t.artist))].slice(0, 20) } });
      append(id, { role: 'assistant', content: result.reply, preset: result.suggestedPreset, bands: result.bands });
    } catch (e) { setError(e instanceof Error ? e.message : 'Assistant unavailable'); navigator.vibrate?.(150); }
    finally { setBusy(false); }
  }
  return <section className="h-full flex flex-col rounded-2xl border border-white/10 bg-zinc-950 overflow-hidden">
    <header className="p-4 border-b border-white/10 flex flex-wrap gap-3 items-center"><Sparkles className="text-indigo-400" /><h2>Sound consultant</h2><select aria-label="Chat session" value={active} onChange={e => setActive(e.target.value)} className="bg-zinc-900 rounded p-2 ml-auto">{sessions.map((s, i) => <option key={s.id} value={s.id}>Session {i + 1}</option>)}</select><button aria-label="New session" onClick={() => { const id = crypto.randomUUID(); setSessions(s => [...s, { id, messages: [] }]); setActive(id); }}><Plus /></button><button aria-label="Clear session" disabled={busy} onClick={() => setSessions(s => s.map(x => x.id === active ? { ...x, messages: [] } : x))}><Trash2 size={18} /></button></header>
    <div className="p-5 flex-1 overflow-auto space-y-4" aria-live="polite">
      {!session.messages.length && <p className="text-zinc-400">Ask for an EQ curve, format advice, or help with your library. This optional feature sends your message and limited library context to the configured AI provider. Audio files are never uploaded.</p>}
      {session.messages.map((m, i) => <article key={i} className={m.role === 'user' ? 'p-4 rounded-xl bg-indigo-600/20 ml-8' : 'p-4 rounded-xl bg-white/5 mr-8'}><small className="text-zinc-500 uppercase">{m.role}</small><p className="whitespace-pre-wrap mt-2">{m.content}</p>{m.bands && <button className="mt-3 px-3 py-2 rounded-lg bg-indigo-600" onClick={() => onApplyEQPreset?.(m.preset || 'AI suggestion', m.bands!)}>Apply {m.preset || 'EQ preset'}</button>}</article>)}
      {busy && <p className="text-indigo-300">Consulting…</p>}{error && <p role="alert" className="text-red-300">{error}</p>}
    </div>
    <form onSubmit={e => { e.preventDefault(); void send(); }} className="p-4 border-t border-white/10 flex items-center gap-3"><textarea aria-label="Message" maxLength={2000} value={text} onChange={e => setText(e.target.value)} placeholder="How should I EQ this track?" className="bg-zinc-900 rounded-xl p-3 flex-1 min-w-0 resize-none" rows={2} /><span className="text-xs text-zinc-500">{text.length}/2000</span><button aria-label="Send message" disabled={busy || !text.trim()} className="p-3 rounded-xl bg-indigo-600 disabled:opacity-40"><Send size={20} /></button></form>
  </section>;
}
