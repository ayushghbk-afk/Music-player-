import { Track, AudioFormat } from '../types';

/**
 * Generates high-fidelity synthesized audiophile WAV track blobs
 * using Web Audio API offline rendering context (24-bit / 96kHz specification).
 */
export async function generateSynthesizedTrackBlob(
  type: 'celestial' | 'quantum' | 'obsidian' | 'solar' | 'jazz'
): Promise<Blob> {
  const sampleRate = 96000; // 96kHz High-Resolution Sample Rate
  const durationSec = 25; // 25s rich audiophile demonstration snippet
  const numFrames = sampleRate * durationSec;
  const offlineCtx = new OfflineAudioContext(2, numFrames, sampleRate);

  // Synthesize rich harmonic soundscapes
  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(0.7, 0);
  masterGain.connect(offlineCtx.destination);

  if (type === 'celestial') {
    // Ambient Celestial Pad & Sub-Bass
    const freqs = [130.81, 164.81, 196.00, 246.94, 293.66, 392.00]; // C, E, G, B, D, G
    freqs.forEach((f, idx) => {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, 0);

      // LFO modulation for lush shimmer
      const lfo = offlineCtx.createOscillator();
      lfo.frequency.setValueAtTime(0.2 + idx * 0.1, 0);
      const lfoGain = offlineCtx.createGain();
      lfoGain.gain.setValueAtTime(2.5, 0);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();

      gain.gain.setValueAtTime(0.01, 0);
      gain.gain.exponentialRampToValueAtTime(0.18 / freqs.length, 2);
      gain.gain.setValueAtTime(0.18 / freqs.length, durationSec - 3);
      gain.gain.exponentialRampToValueAtTime(0.001, durationSec);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start();
    });
  } else if (type === 'quantum') {
    // Quantum Arpeggiator & Percussive Beats
    const arpFreqs = [220, 277.18, 329.63, 440, 554.37, 659.25, 880];
    const stepTime = 0.15;
    for (let t = 0; t < durationSec; t += stepTime) {
      const f = arpFreqs[Math.floor((t / stepTime) % arpFreqs.length)];
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);

      // Lowpass Filter for warmth
      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200 + Math.sin(t) * 800, t);

      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + stepTime * 0.9);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + stepTime);
    }
  } else if (type === 'obsidian') {
    // Deep Sub-Bass Resonator & Analog Warmth
    const osc = offlineCtx.createOscillator();
    const subOsc = offlineCtx.createOscillator();
    const gain = offlineCtx.createGain();

    osc.type = 'sine';
    subOsc.type = 'sine';
    osc.frequency.setValueAtTime(55, 0); // A1
    subOsc.frequency.setValueAtTime(27.5, 0); // Sub-A0

    osc.frequency.exponentialRampToValueAtTime(110, durationSec / 2);
    osc.frequency.exponentialRampToValueAtTime(55, durationSec);

    gain.gain.setValueAtTime(0.01, 0);
    gain.gain.linearRampToValueAtTime(0.4, 2);
    gain.gain.setValueAtTime(0.4, durationSec - 2);
    gain.gain.linearRampToValueAtTime(0.001, durationSec);

    osc.connect(gain);
    subOsc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    subOsc.start();
  } else if (type === 'solar') {
    // Synthwave Sunset & Bright Melodic Leads
    const melody = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
    for (let i = 0; i < Math.floor(durationSec / 0.4); i++) {
      const startTime = i * 0.4;
      const note = melody[i % melody.length];
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.38);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(startTime);
      osc.stop(startTime + 0.38);
    }
  } else {
    // Audiophile Acoustic Jazz Chord Pulse
    const chord = [146.83, 185.00, 220.00, 261.63, 329.63]; // D, F#, A, C, E
    for (let i = 0; i < Math.floor(durationSec / 2); i++) {
      const startTime = i * 2;
      chord.forEach((f) => {
        const osc = offlineCtx.createOscillator();
        const gain = offlineCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, startTime);

        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.8);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(startTime);
        osc.stop(startTime + 1.8);
      });
    }
  }

  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToWavBlob(renderedBuffer);
}

// Convert AudioBuffer to WAV Blob
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const numSamples = buffer.length * numChannels;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * bytesPerSample;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      const intSample = sample < 0 ? sample * 32768 : sample * 32767;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export const INITIAL_SAMPLE_TRACKS: Omit<Track, 'audioUrl'>[] = [
  {
    id: 'sample-track-1',
    title: 'Celestial Horizon (Studio Master)',
    artist: 'Aetheria Ensemble',
    album: 'Cosmic Resonances Vol. I',
    duration: 25,
    format: 'FLAC',
    bitrate: '24-bit / 96kHz FLAC',
    isHiRes: true,
    addedAt: Date.now() - 86400000 * 5,
    playCount: 14,
    year: 2026,
    genre: 'Ambient / Classical',
    trackNumber: 1,
    fileSizeMB: 8.4,
    coverArt: 'linear-gradient(135deg, #0f172a 0%, #38bdf8 50%, #6366f1 100%)',
    lyrics: `[00:01.00] Drift into the infinite void...
[00:06.00] Harmony echoing through celestial spheres.
[00:12.00] Pure 24-bit studio resolution resonance.
[00:18.00] Experience sub-millisecond gapless flow.`
  },
  {
    id: 'sample-track-2',
    title: 'Quantum Echoes (Audiophile DSD)',
    artist: 'Luminous Void',
    album: 'Quantum Resonances',
    duration: 25,
    format: 'DSD',
    bitrate: '24-bit / 192kHz Master',
    isHiRes: true,
    addedAt: Date.now() - 86400000 * 4,
    playCount: 22,
    year: 2026,
    genre: 'Electronic / IDM',
    trackNumber: 2,
    fileSizeMB: 12.1,
    coverArt: 'linear-gradient(135deg, #18181b 0%, #a855f7 50%, #ec4899 100%)',
    lyrics: `[00:02.00] Pulse of the quantum lattice.
[00:08.00] Analog synthesis in ultra-high sample rate.
[00:15.00] Pristine dynamic range clarity.`
  },
  {
    id: 'sample-track-3',
    title: 'Obsidian Resonance (Sub-Bass Analog)',
    artist: 'Acoustic Labs',
    album: 'Deep Frequency Studies',
    duration: 25,
    format: 'WAV',
    bitrate: '32-bit Float / 96kHz WAV',
    isHiRes: true,
    addedAt: Date.now() - 86400000 * 3,
    playCount: 38,
    year: 2025,
    genre: 'Audiophile Test / Bass',
    trackNumber: 3,
    fileSizeMB: 14.5,
    coverArt: 'linear-gradient(135deg, #09090b 0%, #10b981 50%, #06b6d4 100%)',
    lyrics: `[00:01.00] Testing sub-30Hz acoustic boundaries.
[00:10.00] 10-Band graphic equalizer precision test.`
  },
  {
    id: 'sample-track-4',
    title: 'Solar Drift (Synthwave Cut)',
    artist: 'Vector Wave',
    album: 'Neon Horizon 2088',
    duration: 25,
    format: 'ALAC',
    bitrate: '24-bit / 88.2kHz Lossless',
    isHiRes: true,
    addedAt: Date.now() - 86400000 * 2,
    playCount: 19,
    year: 2026,
    genre: 'Synthwave / Cyberpunk',
    trackNumber: 4,
    fileSizeMB: 7.8,
    coverArt: 'linear-gradient(135deg, #27272a 0%, #f59e0b 50%, #ef4444 100%)',
    lyrics: `[00:02.00] Speeding along the chrome highway.
[00:11.00] Lock screen controls & background audio active.`
  },
  {
    id: 'sample-track-5',
    title: 'Midnight Velvet (Acoustic Trio)',
    artist: 'Nouveau Jazz Collective',
    album: 'Late Night Sessions',
    duration: 25,
    format: 'FLAC',
    bitrate: '24-bit / 96kHz FLAC',
    isHiRes: true,
    addedAt: Date.now() - 86400000 * 1,
    playCount: 45,
    year: 2025,
    genre: 'Acoustic Jazz',
    trackNumber: 5,
    fileSizeMB: 9.2,
    coverArt: 'linear-gradient(135deg, #1c1917 0%, #d97706 50%, #78350f 100%)',
    lyrics: `[00:03.00] Warm tube pre-amp simulation.
[00:12.00] Smooth acoustic resonance.`
  }
];
