import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileAudio, CheckCircle2, Sparkles, X, Mic, Square, Play, Pause, Save, Radio } from 'lucide-react';
import { Track, AudioFormat } from '../types';
import { saveTrack } from '../services/db';

interface ImportDropzoneProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

const extractAudioDuration = (file: File | Blob): Promise<number> => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';

    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(180);
    }, 4000);

    audio.onloadedmetadata = () => {
      clearTimeout(timer);
      const d = audio.duration;
      URL.revokeObjectURL(url);
      if (d && isFinite(d) && d > 0) {
        resolve(Math.round(d));
      } else {
        resolve(180);
      }
    };

    audio.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(180);
    };

    audio.src = url;
  });
};

export const ImportDropzone: React.FC<ImportDropzoneProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'voice'>('files');
  const [isDragging, setIsDragging] = useState(false);
  const [importingList, setImportingList] = useState<{ name: string; status: 'pending' | 'done' }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedTitle, setRecordedTitle] = useState('');
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  if (!isOpen) return null;

  const processFiles = async (files: FileList | File[]) => {
    setIsProcessing(true);
    const audioFiles = Array.from(files).filter(
      (f) => f.type.startsWith('audio/') || /\.(flac|wav|mp3|m4a|aac|ogg|alac|dsd)$/i.test(f.name)
    );

    if (audioFiles.length === 0) {
      setIsProcessing(false);
      return;
    }

    setImportingList(audioFiles.map((f) => ({ name: f.name, status: 'pending' })));

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      const ext = file.name.split('.').pop()?.toUpperCase() || 'WAV';

      let format: AudioFormat = 'WAV';
      if (['FLAC', 'WAV', 'ALAC', 'MP3', 'AAC', 'OGG', 'DSD'].includes(ext)) {
        format = ext as AudioFormat;
      } else if (ext === 'M4A') {
        format = 'ALAC';
      }

      const isHiRes = ['FLAC', 'WAV', 'ALAC', 'DSD'].includes(format);
      const bitrate = isHiRes ? '24-bit / 96kHz Lossless' : '320 kbps High Quality';

      // Remove extension for clean title
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

      // Extract accurate duration from audio file metadata
      const realDuration = await extractAudioDuration(file);

      const newTrack: Track = {
        id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: cleanTitle,
        artist: 'Local Artist',
        album: 'Imported Library',
        duration: realDuration,
        format,
        bitrate,
        isHiRes,
        addedAt: Date.now(),
        playCount: 0,
        fileSizeMB: Math.round((file.size / (1024 * 1024)) * 10) / 10,
        coverArt: 'linear-gradient(135deg, #0284c7 0%, #6366f1 50%, #a855f7 100%)',
      };

      // Save audio blob & metadata into IndexedDB
      await saveTrack(newTrack, file);

      setImportingList((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'done' } : item))
      );
    }

    setIsProcessing(false);
    onImportComplete();
  };

  const handleStartRecording = async () => {
    setRecordError(null);
    setRecordedBlob(null);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    setRecordingSeconds(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);

        // Stop all mic tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setRecordedTitle(`Voice Recording (${nowStr})`);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access denied:', err);
      setRecordError('Could not access microphone. Please check permissions.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleSaveVoiceTrack = async () => {
    if (!recordedBlob) return;

    const dur = Math.max(1, recordingSeconds);
    const newTrack: Track = {
      id: `voice-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: recordedTitle || 'Voice Recording',
      artist: 'Voice Note',
      album: 'Recorded Notes',
      duration: dur,
      format: 'WAV',
      bitrate: '24-bit / 48kHz Voice',
      isHiRes: false,
      addedAt: Date.now(),
      playCount: 0,
      fileSizeMB: Math.round((recordedBlob.size / (1024 * 1024)) * 10) / 10 || 0.5,
      coverArt: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 50%, #8b5cf6 100%)',
    };

    await saveTrack(newTrack, recordedBlob);
    onImportComplete();
    onClose();
  };

  const formatDurationStr = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fadeIn">
      <div className="bg-zinc-950 border border-white/10 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('files')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'files'
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Upload className="w-4 h-4" />
              Import Audio
            </button>
            <button
              onClick={() => setActiveTab('voice')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'voice'
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Mic className="w-4 h-4" />
              Record Voice Note
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {activeTab === 'files' ? (
          <>
            {/* Dropzone Box */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center space-y-3 transition-all cursor-pointer ${
                isDragging
                  ? 'border-sky-400 bg-sky-500/10 scale-102'
                  : 'border-white/10 bg-black/40 hover:border-white/20'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center mx-auto">
                <FileAudio className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Drag & Drop FLAC, WAV, MP3, M4A, or DSD files</p>
                <p className="text-[10px] text-zinc-400 mt-1">Automatic metadata & duration parsing</p>
              </div>

              <label className="inline-block px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs shadow-md cursor-pointer transition-transform active:scale-95">
                <span>Browse Files</span>
                <input
                  type="file"
                  multiple
                  accept="audio/*,.flac,.wav,.mp3,.m4a,.aac,.ogg,.alac,.dsd"
                  onChange={(e) => e.target.files && processFiles(e.target.files)}
                  className="hidden"
                />
              </label>
            </div>

            {/* Processing List */}
            {importingList.length > 0 && (
              <div className="bg-black/40 p-3 rounded-2xl border border-white/5 space-y-2 max-h-36 overflow-y-auto font-mono text-xs">
                <span className="text-[10px] text-zinc-500 uppercase">Processing Queue</span>
                {importingList.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-zinc-300">
                    <span className="truncate max-w-[280px]">{item.name}</span>
                    {item.status === 'done' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <span className="text-[10px] text-sky-400 animate-pulse">Saving...</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Voice Recorder View */
          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 text-center space-y-4">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              {isRecording && (
                <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping" />
              )}
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all ${
                  isRecording ? 'bg-rose-600 text-white scale-110' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                <Mic className="w-8 h-8" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-mono text-2xl font-bold tracking-wider text-white">
                {formatDurationStr(recordingSeconds)}
              </div>
              <p className="text-xs text-zinc-400">
                {isRecording ? 'Recording voice note...' : recordedBlob ? 'Recording complete!' : 'Click record to start voice note'}
              </p>
            </div>

            {recordError && (
              <div className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                {recordError}
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              {!isRecording ? (
                <button
                  onClick={handleStartRecording}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
                >
                  <Radio className="w-4 h-4 animate-pulse" />
                  Start Record
                </button>
              ) : (
                <button
                  onClick={handleStopRecording}
                  className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <Square className="w-4 h-4 text-rose-400 fill-current" />
                  Stop Recording
                </button>
              )}
            </div>

            {/* Save Recorded Voice Note Form */}
            {recordedBlob && !isRecording && (
              <div className="space-y-3 pt-3 border-t border-white/10 text-left animate-fadeIn">
                <label className="block text-[11px] font-mono text-zinc-400">Voice Note Title</label>
                <input
                  type="text"
                  value={recordedTitle}
                  onChange={(e) => setRecordedTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />

                {recordedUrl && (
                  <audio
                    ref={audioPreviewRef}
                    src={recordedUrl}
                    controls
                    className="w-full h-8 rounded-lg opacity-80"
                  />
                )}

                <button
                  onClick={handleSaveVoiceTrack}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-98 transition-all"
                >
                  <Save className="w-4 h-4" />
                  Save Voice Note ({formatDurationStr(recordingSeconds)})
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

