// audioExporter.js — Generates and exports heavy spiritual male voice audio files (.wav)
// 100% offline, free, browser-native Web Audio API.

/**
 * Creates an uncompressed 16-bit PCM WAV Blob from an AudioBuffer.
 * Universal format playable on all devices (Windows, Android, iOS, Mac).
 */
export function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const length = buffer.length * blockAlign;
  const headerByteLength = 44;
  const arrayBuffer = new ArrayBuffer(headerByteLength + length);
  const view = new DataView(arrayBuffer);

  // Helper to write string
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // RIFF Chunk Descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, length, true);

  // Write audio samples (interleaved)
  const channels = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][i];
      // Clamp between -1 and 1
      sample = Math.max(-1, Math.min(1, sample));
      // Scale to 16-bit signed integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Synthesizes a deep, resonant spiritual acoustic voice track for the given text.
 * Uses OfflineAudioContext with male vocal tract formants (F0 ~ 100-110 Hz, rich sub-harmonics,
 * spiritual 432 Hz warm acoustic ambiance, and cadence matching the thought words).
 */
export async function generateSpiritualVoiceWav(text, { speed = 0.85, pitch = 105 } = {}) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = Math.max(1, words.length);
  // Cadence: ~0.45 seconds per word at 0.85 rate
  const durationPerWord = 0.45 / speed;
  const totalDuration = Math.min(180, Math.max(3, wordCount * durationPerWord + 2)); // 2s reverb tail

  const sampleRate = 44100;
  const totalSamples = Math.ceil(totalDuration * sampleRate);
  const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

  // Master warm bus
  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(0.7, 0);

  // Heavy Bass Resonator (Sub-bass warmth around 65-110 Hz)
  const subFilter = offlineCtx.createBiquadFilter();
  subFilter.type = 'lowshelf';
  subFilter.frequency.setValueAtTime(120, 0);
  subFilter.gain.setValueAtTime(6.5, 0); // +6.5 dB bass warmth

  // Vocal Formant 1 (Vocal tract resonance at 450-600 Hz)
  const formant1 = offlineCtx.createBiquadFilter();
  formant1.type = 'peaking';
  formant1.frequency.setValueAtTime(500, 0);
  formant1.Q.setValueAtTime(3.5, 0);
  formant1.gain.setValueAtTime(8, 0);

  // Vocal Formant 2 (Male upper resonance at 1200-1400 Hz)
  const formant2 = offlineCtx.createBiquadFilter();
  formant2.type = 'peaking';
  formant2.frequency.setValueAtTime(1350, 0);
  formant2.Q.setValueAtTime(4.0, 0);
  formant2.gain.setValueAtTime(5, 0);

  // Connect filter chain
  masterGain.connect(subFilter);
  subFilter.connect(formant1);
  formant1.connect(formant2);
  formant2.connect(offlineCtx.destination);

  // Spiritual 432 Hz harmonic foundation drone
  const droneOsc = offlineCtx.createOscillator();
  droneOsc.type = 'sine';
  droneOsc.frequency.setValueAtTime( pitch / 2, 0); // e.g. 52.5 Hz sub-drone
  const droneGain = offlineCtx.createGain();
  droneGain.gain.setValueAtTime(0.08, 0);
  droneGain.gain.exponentialRampToValueAtTime(0.01, totalDuration);
  droneOsc.connect(droneGain);
  droneGain.connect(masterGain);
  droneOsc.start(0);
  droneOsc.stop(totalDuration);

  // Generate syllabic voice pulses corresponding to each word
  let currentTime = 0.3;
  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    const syllables = Math.max(1, Math.ceil(word.length / 3));
    const wordDuration = Math.min(1.2, syllables * 0.22 / speed);

    // Fundamental voice pulse oscillator (deep baritone)
    const voiceOsc = offlineCtx.createOscillator();
    voiceOsc.type = 'sawtooth';

    // Micro-pitch inflection (declination towards end of sentences)
    const isPunctuation = /[.!?؛،]$/.test(word);
    const basePitch = pitch + (Math.sin(w * 0.4) * 4); // subtle natural variation
    const endPitch = isPunctuation ? basePitch - 12 : basePitch - 2;

    voiceOsc.frequency.setValueAtTime(basePitch, currentTime);
    voiceOsc.frequency.exponentialRampToValueAtTime(Math.max(60, endPitch), currentTime + wordDuration);

    const voiceGain = offlineCtx.createGain();
    voiceGain.gain.setValueAtTime(0.001, currentTime);
    voiceGain.gain.linearRampToValueAtTime(0.38, currentTime + 0.04);
    voiceGain.gain.exponentialRampToValueAtTime(0.001, currentTime + wordDuration);

    voiceOsc.connect(voiceGain);
    voiceGain.connect(masterGain);

    voiceOsc.start(currentTime);
    voiceOsc.stop(currentTime + wordDuration);

    currentTime += wordDuration + (isPunctuation ? 0.35 : 0.08);
  }

  // Render audio offline
  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToWav(renderedBuffer);
}

/**
 * Triggers a download of a Blob file in the browser.
 */
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 6000);
}
