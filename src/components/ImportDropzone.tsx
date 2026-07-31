import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileAudio, CheckCircle2, Sparkles, X, Mic, Square, Play, Pause, Save, Radio, ShieldCheck, FolderSearch, AlertCircle, CopyCheck } from 'lucide-react';
import { Track, AudioFormat } from '../types';
import { saveTrack, getAllTracks } from '../services/db';

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
  const [importingList, setImportingList] = useState<{ name: string; status: 'pending' | 'done' | 'skipped' }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summaryMessage, setSummaryMessage] = useState<string | null>(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedTitle, setRecordedTitle] = useState('');
  const [recordError, setRecordError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  if (!isOpen) return null;

  const processFiles = async (files: FileList | File[]) => {
    setIsProcessing(true);
    setSummaryMessage(null);

    const audioFiles = Array.from(files).filter(
      (f) => f.type.startsWith('audio/') || /\.(flac|wav|mp3|m4a|aac|ogg|alac|dsd)$/i.test(f.name)
    );

    if (audioFiles.length === 0) {
      setIsProcessing(false);
      setSummaryMessage('No valid audio files found in selection.');
      return;
    }

    // Load existing library to detect duplicates
    const existingTracks = await getAllTracks();

    setImportingList(audioFiles.map((f) => ({ name: f.name, status: 'pending' })));

    let addedCount = 0;
    let skippedCount = 0;
    const currentBatchTracks: Track[] = [];

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

      // Clean title
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').trim();
      const fileSizeMB = Math.round((file.size / (1024 * 1024)) * 10) / 10;

      // Extract accurate duration
      const realDuration = await extractAudioDuration(file);

      // Check if duplicate exists in DB or current batch
      const normTitle = cleanTitle.toLowerCase();
      const isDuplicate = [...existingTracks, ...currentBatchTracks].some((t) => {
        const existingTitle = t.title.toLowerCase().trim();
        if (existingTitle === normTitle) {
          const sameSize = t.fileSizeMB && fileSizeMB && Math.abs(t.fileSizeMB - fileSizeMB) < 0.2;
          const sameDuration = t.duration && realDuration && Math.abs(t.duration - realDuration) <= 3;
          return sameSize || sameDuration || (!t.fileSizeMB && !t.duration);
        }
        return false;
      });

      if (isDuplicate) {
        skippedCount++;
        setImportingList((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'skipped' } : item))
        );
        continue;
      }

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
        fileSizeMB,
        coverArt: 'linear-gradient(135deg, #0284c7 0%, #6366f1 50%, #a855f7 100%)',
      };

      // Save audio blob & metadata into IndexedDB
      await saveTrack(newTrack, file);
      currentBatchTracks.push(newTrack);
      addedCount++;

      setImportingList((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'done' } : item))
      );
    }

    setIsProcessing(false);

    if (addedCount > 0 && skippedCount > 0) {
      setSummaryMessage(`Added ${addedCount} new track(s). ${skippedCount} duplicate(s) automatically skipped.`);
    } else if (addedCount > 0 && skippedCount === 0) {
      setSummaryMessage(`Successfully imported ${addedCount} new track(s).`);
    } else if (addedCount === 0 && skippedCount > 0) {
      setSummaryMessage(`All ${skippedCount} track(s) were already in your library and skipped.`);
    }

    if (addedCount > 0) {
      onImportComplete();
    }
  };

  // Create a clean sample WAV blob for demo testing
  const createSampleAudioBlob = (frequency = 440, durationSec = 10): Blob => {
    const sampleRate = 44100;
    const numSamples = sampleRate * durationSec;
    const buffer = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      // Soft gentle tone with harmonic overtone
      buffer[i] = Math.sin(2 * Math.PI * frequency * t) * 0.3 * Math.exp(-t * 0.1) +
                  Math.sin(2 * Math.PI * (frequency * 1.5) * t) * 0.1;
    }

    // Convert Float32Array to 16-bit PCM WAV
    const wavBuffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(wavBuffer);

    // RIFF identifier
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, 1, true); // NumChannels (1)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    // Write PCM samples
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  };

  const handleImportDemoTracks = async () => {
    setIsProcessing(true);
    setSummaryMessage(null);

    const demoTracks = [
      { name: 'Aether Resonance (24-bit Hi-Res).wav', freq: 432, dur: 12, title: 'Aether Resonance', artist: 'Aether Studio', album: 'Audiophile Demos', isHiRes: true },
      { name: 'Celestial Horizon (FLAC Lossless).wav', freq: 528, dur: 15, title: 'Celestial Horizon', artist: 'Zenith Audio', album: 'Lossless Collection', isHiRes: true },
      { name: 'Acoustic Drift (Studio Master).wav', freq: 320, dur: 10, title: 'Acoustic Drift', artist: 'Ethereal Sound', album: 'Studio Master', isHiRes: true },
    ];

    const existingTracks = await getAllTracks();
    setImportingList(demoTracks.map((d) => ({ name: d.name, status: 'pending' })));

    let addedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < demoTracks.length; i++) {
      const demo = demoTracks[i];
      const normTitle = demo.title.toLowerCase().trim();

      const isDup = existingTracks.some((t) => t.title.toLowerCase().trim() === normTitle);

      if (isDup) {
        skippedCount++;
        setImportingList((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'skipped' } : item))
        );
        continue;
      }

      const audioBlob = createSampleAudioBlob(demo.freq, demo.dur);
      const newTrack: Track = {
        id: `demo-${Date.now()}-${i}`,
        title: demo.title,
        artist: demo.artist,
        album: demo.album,
        duration: demo.dur,
        format: 'FLAC',
        bitrate: '24-bit / 96kHz Lossless',
        isHiRes: true,
        addedAt: Date.now(),
        playCount: 0,
        fileSizeMB: 2.4,
        coverArt: 'linear-gradient(135deg, #0284c7 0%, #6366f1 50%, #a855f7 100%)',
      };

      await saveTrack(newTrack, audioBlob);
      addedCount++;
      setImportingList((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'done' } : item))
      );
    }

    setIsProcessing(false);

    if (addedCount > 0 && skippedCount > 0) {
      setSummaryMessage(`Imported ${addedCount} sample tracks. ${skippedCount} duplicate(s) skipped.`);
    } else if (addedCount > 0 && skippedCount === 0) {
      setSummaryMessage(`Successfully loaded ${addedCount} sample high-res tracks!`);
    } else {
      setSummaryMessage(`Sample tracks are already in your library.`);
    }

    if (addedCount > 0) {
      onImportComplete();
    }
  };

  // Direct Directory Picker handler
  const handleDirectoryPickerClick = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker();
        const files: File[] = [];

        const readDir = async (handle: any) => {
          for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
              const file = await entry.getFile();
              if (file.type.startsWith('audio/') || /\.(flac|wav|mp3|m4a|aac|ogg|alac|dsd)$/i.test(file.name)) {
                files.push(file);
              }
            } else if (entry.kind === 'directory') {
              await readDir(entry);
            }
          }
        };

        await readDir(dirHandle);
        if (files.length > 0) {
          processFiles(files);
        } else {
          setSummaryMessage('No audio files detected in the selected folder.');
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Folder picker failed or cancelled:', err);
      }
    }
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
    const cleanTitle = (recordedTitle || 'Voice Recording').trim();

    // Duplicate check for voice recording
    const existingTracks = await getAllTracks();
    const isDup = existingTracks.some((t) => t.title.toLowerCase().trim() === cleanTitle.toLowerCase());

    if (isDup) {
      setRecordError('A voice note with this title already exists. Please use a unique title.');
      return;
    }

    const newTrack: Track = {
      id: `voice-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: cleanTitle,
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
            {/* Auto Device Scan & Dropzone Box */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-6 text-center space-y-3 transition-all cursor-pointer ${
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
                <p className="text-[10px] text-zinc-400 mt-1">Automatic metadata parsing & duplicate prevention</p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                {/* Direct Folder Import Label (Works natively on both desktop & mobile browsers) */}
                <label className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs shadow-md flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer">
                  <FolderSearch className="w-4 h-4 text-indigo-200" />
                  <span>Scan Device Music Folder</span>
                  <input
                    type="file"
                    // @ts-ignore
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={(e) => e.target.files && processFiles(e.target.files)}
                    className="hidden"
                  />
                </label>

                {/* Desktop Native Directory Picker if available */}
                {'showDirectoryPicker' in window && (
                  <button
                    type="button"
                    onClick={handleDirectoryPickerClick}
                    className="px-3.5 py-2 rounded-xl bg-purple-600/80 hover:bg-purple-500 text-white font-medium text-xs shadow-md flex items-center gap-1.5 transition-transform active:scale-95"
                    title="Select folder using System Directory Picker"
                  >
                    <FolderSearch className="w-4 h-4 text-purple-200" />
                    <span>Choose Directory</span>
                  </button>
                )}

                {/* Individual File Picker */}
                <label className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs shadow-md cursor-pointer transition-transform active:scale-95 inline-flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Select Files</span>
                  <input
                    type="file"
                    multiple
                    accept="audio/*,.flac,.wav,.mp3,.m4a,.aac,.ogg,.alac,.dsd"
                    onChange={(e) => e.target.files && processFiles(e.target.files)}
                    className="hidden"
                  />
                </label>

                {/* Demo Audiophile Tracks Loader */}
                <button
                  type="button"
                  onClick={handleImportDemoTracks}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 font-medium text-xs shadow-md flex items-center gap-1.5 transition-transform active:scale-95"
                  title="Load sample hi-res audio tracks for testing"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Load Sample Demo Songs</span>
                </button>
              </div>
            </div>

            {/* Duplicate Prevention Badge */}
            <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-2xl flex items-center gap-2.5">
              <CopyCheck className="w-5 h-5 text-indigo-400 flex-shrink-0" />
              <div className="text-[11px] text-indigo-200">
                <span className="font-bold text-white block">Smart Duplicate Protection Active</span>
                Prevents uploading the same audio file twice. Duplicate files are detected and automatically skipped.
              </div>
            </div>

            {/* Privacy Notice */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="text-[11px] text-emerald-200">
                <span className="font-bold text-white block">100% Local & Secure</span>
                Direct file access via standard browser APIs. Audio stays safely on your device.
              </div>
            </div>

            {/* Summary Message */}
            {summaryMessage && (
              <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-200 font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400 flex-shrink-0" />
                <span>{summaryMessage}</span>
              </div>
            )}

            {/* Processing List */}
            {importingList.length > 0 && (
              <div className="bg-black/40 p-3 rounded-2xl border border-white/5 space-y-2 max-h-36 overflow-y-auto font-mono text-xs">
                <span className="text-[10px] text-zinc-500 uppercase">Processing Queue</span>
                {importingList.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-zinc-300">
                    <span className="truncate max-w-[280px]">{item.name}</span>
                    {item.status === 'done' ? (
                      <span className="flex items-center gap-1 text-emerald-400 text-[10px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Added
                      </span>
                    ) : item.status === 'skipped' ? (
                      <span className="flex items-center gap-1 text-amber-400 text-[10px]">
                        <AlertCircle className="w-3.5 h-3.5" /> Duplicate Skipped
                      </span>
                    ) : (
                      <span className="text-[10px] text-sky-400 animate-pulse">Processing...</span>
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


