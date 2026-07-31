import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, User, AlertTriangle, Trash2, Plus, Volume2, Sliders, Check, Copy } from 'lucide-react';
import { Track, EQSettings } from '../types';

interface Message {
  id: string;
  sender: 'user' | 'assistant' | 'system' | 'error';
  text: string;
  timestamp: string;
  eqPresetSuggestion?: {
    name: string;
    bands: number[];
  };
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: Message[];
}

interface AiAssistantViewProps {
  tracks: Track[];
  eqSettings: EQSettings;
  onApplyEQPreset?: (presetName: string, bands: number[]) => void;
  currentTrack?: Track | null;
}

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({
  tracks,
  eqSettings,
  onApplyEQPreset,
  currentTrack,
}) => {
  // Session State
  const [sessions, setSessions] = useState<ChatSession[]>(() => [
    {
      id: 'session-default-1',
      title: 'Studio Sound & EQ Consultant',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      messages: [
        {
          id: 'msg-welcome',
          sender: 'assistant',
          text: `Welcome to Aether AI Studio Sound Engineer! 🎧\n\nI can help you with:\n• 10-Band Parametric EQ presets tailored for your music genres\n• FLAC/DSD/ALAC audio format comparisons and Bitrate analysis\n• Room acoustics & Spatial Audio tuning tips\n• Track mastering recommendations\n\nHow can I enhance your listening experience today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    },
  ]);

  const [currentSessionId, setCurrentSessionId] = useState<string>('session-default-1');
  const [inputText, setInputText] = useState('');
  const [sendInFlight, setSendInFlight] = useState(false);
  const [appliedPresetNotice, setAppliedPresetNotice] = useState<string | null>(null);

  // Input element ref for direct style manipulation as requested
  const userInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll messages to bottom
  const currentSession = sessions.find((s) => s.id === currentSessionId) || sessions[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  // Create New Session
  const createNewSession = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: `Audio Session ${sessions.length + 1}`,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      messages: [
        {
          id: `msg-welcome-${newId}`,
          sender: 'assistant',
          text: `New audio engineering consultation session started. Ask me anything about audio processing, EQ profiles, or high-resolution codecs!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newId);
  };

  // Helper to append error UI message
  const appendErrorUI = (errorMsg: string) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: [
              ...session.messages,
              {
                id: `err-${Date.now()}`,
                sender: 'error',
                text: errorMsg,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ],
          };
        }
        return session;
      })
    );
  };

  // Delete current session
  const deleteSession = (id: string) => {
    if (sessions.length <= 1) return;
    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);
    if (currentSessionId === id) {
      setCurrentSessionId(remaining[0].id);
    }
  };

  // Core sendMessage function strictly matching user specification
  async function sendMessage() {
    const userInput = userInputRef.current;
    const text = (userInput ? userInput.value : inputText).trim();

    if (!text || !currentSessionId) return;

    // ✅ CHECK MESSAGE SIZE (MAX 2000 CHARACTERS)
    const MAX_MESSAGE_LENGTH = 2000; // Set max length
    if (text.length > MAX_MESSAGE_LENGTH) {
      const errorMsg = `⚠️ Message is too long (${text.length} characters). Maximum is ${MAX_MESSAGE_LENGTH} characters.`;
      appendErrorUI(errorMsg);

      // Highlight the input if DOM element exists
      if (userInput) {
        userInput.style.borderColor = '#ff6b6b';
        userInput.style.borderWidth = '2px';
        userInput.style.borderStyle = 'solid';

        // Reset after 3 seconds
        setTimeout(() => {
          if (userInput) {
            userInput.style.borderColor = '';
            userInput.style.borderWidth = '';
            userInput.style.borderStyle = '';
          }
        }, 3000);
      }

      // Vibrate on mobile (if supported)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(100);
      }

      return;
    }

    if (sendInFlight) return;

    // Execute sending
    setSendInFlight(true);
    setInputText('');
    if (userInput) userInput.value = '';

    // Append User Message to session
    const userMsgId = `usr-${Date.now()}`;
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === currentSessionId) {
          // Update title on first message if default title
          const isFirstUserMsg = s.messages.filter((m) => m.sender === 'user').length === 0;
          const updatedTitle = isFirstUserMsg
            ? text.slice(0, 28) + (text.length > 28 ? '...' : '')
            : s.title;

          return {
            ...s,
            title: updatedTitle,
            messages: [
              ...s.messages,
              {
                id: userMsgId,
                sender: 'user',
                text,
                timestamp: timestampStr,
              },
            ],
          };
        }
        return s;
      })
    );

    // Simulate AI Engineer Response after a brief processing delay
    setTimeout(() => {
      const response = generateAiAudioResponse(text, currentTrack, eqSettings, tracks);

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === currentSessionId) {
            return {
              ...s,
              messages: [
                ...s.messages,
                {
                  id: `ai-${Date.now()}`,
                  sender: 'assistant',
                  text: response.reply,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  eqPresetSuggestion: response.eqPreset,
                },
              ],
            };
          }
          return s;
        })
      );

      setSendInFlight(false);
    }, 700);
  }

  // Handle key press (Enter to send, Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Preset Prompt triggers
  const handleQuickPrompt = (prompt: string) => {
    setInputText(prompt);
    if (userInputRef.current) {
      userInputRef.current.value = prompt;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-zinc-950/80 rounded-2xl border border-white/10 overflow-hidden text-zinc-100 shadow-2xl">
      {/* Mobile-Only Compact Session TopBar (md:hidden) */}
      <div className="md:hidden bg-zinc-900 border-b border-white/10 p-2.5 space-y-2 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          {/* Session Switcher Dropdown */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <select
              value={currentSessionId}
              onChange={(e) => setCurrentSessionId(e.target.value)}
              className="bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-indigo-500 min-w-0 flex-1 truncate"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id} className="bg-zinc-900 text-white">
                  {s.title} ({s.createdAt})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={createNewSession}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1 shadow-md active:scale-95 transition-all"
              title="New Session"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>

            {sessions.length > 1 && (
              <button
                onClick={() => deleteSession(currentSessionId)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Delete Session"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Active Audio Stream Mini-Banner for Mobile */}
        {currentTrack && (
          <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px]">
            <span className="text-indigo-300 font-bold uppercase font-mono truncate">
              STREAM: {currentTrack.title}
            </span>
            <span className="font-mono text-amber-300 bg-amber-500/20 px-1.5 rounded border border-amber-500/30 flex-shrink-0">
              {currentTrack.bitrate || currentTrack.format}
            </span>
          </div>
        )}
      </div>

      {/* Desktop Session Sidebar (hidden on phone) */}
      <div className="hidden md:flex md:w-64 bg-black/40 border-r border-white/5 p-4 flex-col justify-between flex-shrink-0">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                AI Studio Engineer
              </h2>
            </div>
            <button
              onClick={createNewSession}
              className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/40 border border-indigo-500/30 transition-all text-xs flex items-center gap-1"
              title="New Consultation Session"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>

          <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
            {sessions.map((s) => {
              const isActive = s.id === currentSessionId;
              return (
                <div
                  key={s.id}
                  onClick={() => setCurrentSessionId(s.id)}
                  className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-all ${
                    isActive
                      ? 'bg-indigo-600/20 text-white border border-indigo-500/40 font-medium'
                      : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                >
                  <div className="truncate flex-1 pr-2">
                    <p className="truncate text-xs">{s.title}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">{s.createdAt}</p>
                  </div>
                  {sessions.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(s.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Active Track Status */}
        {currentTrack && (
          <div className="p-3 rounded-xl bg-white/5 border border-white/5 mt-4 text-xs space-y-1">
            <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
              Active Audio Stream
            </p>
            <p className="font-semibold text-white truncate">{currentTrack.title}</p>
            <p className="text-[10px] text-zinc-400 truncate">{currentTrack.artist}</p>
            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 mt-1">
              {currentTrack.bitrate || currentTrack.format}
            </span>
          </div>
        )}
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-black/20">
        {/* Chat Header */}
        <div className="p-3 sm:p-4 border-b border-white/5 bg-black/30 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-semibold text-white truncate">
                {currentSession?.title || 'Aether AI Master Engineer'}
              </h3>
              <p className="text-[10px] sm:text-[11px] text-zinc-400 truncate">
                Parametric EQ Optimization • Codec Advisor • Spatial Tuning
              </p>
            </div>
          </div>

          {appliedPresetNotice && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] sm:text-xs animate-fade-in flex-shrink-0">
              <Check className="w-3 h-3" />
              <span>{appliedPresetNotice}</span>
            </div>
          )}
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 sm:space-y-4">
          {currentSession?.messages.map((msg) => {
            if (msg.sender === 'error') {
              return (
                <div
                  key={msg.id}
                  className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-center gap-2 max-w-xl mx-auto shadow-lg"
                >
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{msg.text}</span>
                </div>
              );
            }

            const isUser = msg.sender === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 sm:gap-3 max-w-[92%] sm:max-w-2xl ${
                  isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                <div
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-xl flex items-center justify-center text-xs flex-shrink-0 mt-0.5 ${
                    isUser
                      ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                      : 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                  }`}
                >
                  {isUser ? <User className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                </div>

                <div className="space-y-1.5 min-w-0 flex-1">
                  <div
                    className={`p-3 sm:p-4 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? 'bg-purple-600/20 text-purple-50 border border-purple-500/30 rounded-tr-none'
                        : 'bg-zinc-900/80 text-zinc-200 border border-white/10 rounded-tl-none whitespace-pre-wrap'
                    }`}
                  >
                    {msg.text}

                    {/* Apply Suggested EQ Preset Box */}
                    {msg.eqPresetSuggestion && onApplyEQPreset && (
                      <div className="mt-3 p-2.5 sm:p-3 rounded-xl bg-black/60 border border-indigo-500/30 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="font-bold text-indigo-300 text-[11px] flex items-center gap-1 truncate">
                            <Sliders className="w-3.5 h-3.5 flex-shrink-0" />
                            Suggested: {msg.eqPresetSuggestion.name}
                          </span>
                          <button
                            onClick={() => {
                              onApplyEQPreset(
                                msg.eqPresetSuggestion!.name,
                                msg.eqPresetSuggestion!.bands
                              );
                              setAppliedPresetNotice(`Applied ${msg.eqPresetSuggestion!.name} EQ`);
                              setTimeout(() => setAppliedPresetNotice(null), 3000);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[10px] shadow transition-all active:scale-95 self-start sm:self-auto"
                          >
                            Apply EQ Now
                          </button>
                        </div>
                        <div className="flex gap-1 h-6 items-end pt-1">
                          {msg.eqPresetSuggestion.bands.map((gain, i) => {
                            const normalized = Math.max(10, Math.min(100, ((gain + 12) / 24) * 100));
                            return (
                              <div
                                key={i}
                                className="flex-1 bg-indigo-500/50 rounded-t"
                                style={{ height: `${normalized}%` }}
                                title={`${gain > 0 ? '+' : ''}${gain}dB`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <p
                    className={`text-[9px] font-mono text-zinc-500 ${
                      isUser ? 'text-right' : 'text-left'
                    }`}
                  >
                    {msg.timestamp}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Sample Suggestions */}
        <div className="px-3 sm:px-4 py-2 border-t border-white/5 bg-black/30 flex gap-2 overflow-x-auto text-[10px] sm:text-[11px] flex-shrink-0">
          <span className="text-zinc-500 font-mono self-center text-[10px] uppercase flex-shrink-0 hidden sm:inline">
            Quick Prompts:
          </span>
          {[
            'Optimize EQ for Jazz & Acoustic Vocals',
            'FLAC vs DSD 256: What is the audible difference?',
            'How to tune 10-band EQ for heavy bass without clipping?',
            'Spatial Sound stage enhancement tips',
          ].map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickPrompt(prompt)}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 whitespace-nowrap text-[10px] sm:text-[11px] transition-all flex-shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Chat Input Section */}
        <div className="p-3 sm:p-4 border-t border-white/5 bg-black/50 space-y-2 flex-shrink-0">
          <div className="relative flex items-center">
            <textarea
              ref={userInputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your AI Sound Engineer (max 2000 chars)..."
              rows={2}
              className="w-full bg-zinc-900 text-white text-xs p-2.5 sm:p-3 pr-12 rounded-xl border border-white/10 focus:outline-none focus:border-indigo-500 resize-none transition-all placeholder:text-zinc-500"
            />
            <button
              onClick={sendMessage}
              disabled={sendInFlight || !inputText.trim()}
              className="absolute right-2.5 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-all active:scale-95 shadow-md shadow-indigo-600/20"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Character counter */}
          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono px-1">
            <span className="hidden sm:inline">Press Enter to send, Shift+Enter for newline</span>
            <span className="sm:hidden text-zinc-500 font-mono">AI Studio Assistant</span>
            <span
              className={
                inputText.length > 2000
                  ? 'text-red-400 font-bold'
                  : inputText.length > 1800
                  ? 'text-amber-400'
                  : 'text-zinc-500'
              }
            >
              {inputText.length} / 2000
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Generates intelligent AI Sound Engineer answers
function generateAiAudioResponse(
  prompt: string,
  currentTrack: Track | null,
  eqSettings: EQSettings,
  library: Track[]
): { reply: string; eqPreset?: { name: string; bands: number[] } } {
  const p = prompt.toLowerCase();

  if (p.includes('jazz') || p.includes('acoustic') || p.includes('vocal')) {
    return {
      reply: `For Jazz & Acoustic vocals, we want to gently boost the mid-range presence around 1kHz-2.5kHz for vocal clarity, while preserving warmth in the upper-bass (250Hz) and adding air above 8kHz.\n\nHere is a custom "Acoustic Warmth" EQ profile recommended for your setup:`,
      eqPreset: {
        name: 'Acoustic Warmth',
        bands: [2, 1, 2, 0, 1, 3, 2, 1, 2, 3],
      },
    };
  }

  if (p.includes('bass') || p.includes('sub') || p.includes('edm') || p.includes('hiphop')) {
    return {
      reply: `To get deep, punchy sub-bass without distortion or muddying the mids:\n1. Keep 31Hz and 63Hz around +5dB to +7dB.\n2. Apply a small dip at 250Hz (-2dB) to prevent boxy bass build-up.\n3. Lower overall preamp by -2dB to eliminate digital clipping (intersample peaks).\n\nTry this "Punchy Sub-Bass" profile:`,
      eqPreset: {
        name: 'Punchy Sub-Bass',
        bands: [6, 5, 3, -2, -1, 0, 1, 2, 1, 0],
      },
    };
  }

  if (p.includes('flac') || p.includes('dsd') || p.includes('bitrate') || p.includes('format')) {
    return {
      reply: `High-Resolution Audio Codecs Breakdown:\n\n• FLAC (Free Lossless Audio Codec): Compressed losslessly. 24-bit / 96kHz offers a dynamic range of up to 144dB, compared to 96dB on 16-bit CDs.\n• DSD (Direct Stream Digital): Uses 1-bit delta-sigma modulation at ultra-high sampling rates (2.8MHz - 11.2MHz). Delivers ultra-smooth analog-like high frequencies.\n• ALAC (Apple Lossless): Equivalent to FLAC, optimized for Apple ecosystems.\n\nYour library currently contains ${library.filter((t) => t.isHiRes).length} Hi-Res lossless masters!`,
    };
  }

  if (p.includes('spatial') || p.includes('width') || p.includes('stage')) {
    return {
      reply: `To widen your soundstage in Aether Audio Studio:\n1. Increase the Stereo Width slider in Studio EQ & FX to ~130%.\n2. Add subtle treble boost (+2dB at 8kHz and 16kHz) to improve spatial cue localization.\n3. Ensure your DAC or output headphones have a flat frequency response.`,
    };
  }

  return {
    reply: `Analysis complete for your request: "${prompt}".\n\nTo optimize your studio sound:\n• Current EQ Preset: ${
      eqSettings.preset
    }\n• Bass Boost Level: +${eqSettings.bassBoost}%\n• Treble Boost Level: +${
      eqSettings.trebleBoost
    }%\n\nYou can ask me for genre-specific 10-band EQ profiles, audio format advice, or mastering recommendations anytime!`,
  };
}
