// audioExporter.js — Generates and exports studio-grade heavy spiritual male voice audio files (.wav)
// Uses Google Gemini Flash TTS for authentic human male speech.

import { generateGeminiSpiritualSpeech, hasGeminiApiKey } from './geminiService';

/**
 * Generates an authentic heavy, spiritual male voice audio file using Google Gemini.
 * @param {string} text - Thought text to convert to speech
 * @param {Object} [options]
 * @param {string} [options.voice='Charon'] - Gemini voice name
 * @returns {Promise<{ blob: Blob, extension: string }>} - Audio Blob & file extension
 */
export async function generateSpiritualVoiceAudio(text, options = {}) {
  if (!text || !text.trim()) {
    throw new Error('No text provided for audio export');
  }

  const { voice = 'Charon' } = options;

  if (!hasGeminiApiKey()) {
    const err = new Error('Google Gemini API key is required to export studio spiritual voice audio.');
    err.code = 'MISSING_GEMINI_KEY';
    throw err;
  }

  const blob = await generateGeminiSpiritualSpeech(text, { voice });
  return { blob, extension: 'wav' };
}

/**
 * Backwards-compatible export function for existing callers
 */
export async function generateSpiritualVoiceWav(text, options = {}) {
  const result = await generateSpiritualVoiceAudio(text, options);
  return result.blob;
}

/**
 * Triggers a download of an audio Blob file in the browser with appropriate filename and extension.
 */
export function triggerDownload(blob, filename) {
  const isMp3 = blob?.type?.includes('mpeg') || blob?.type?.includes('mp3');
  const ext = isMp3 ? '.mp3' : '.wav';

  let cleanName = filename || 'thought-voice';
  if (cleanName.endsWith('.wav') || cleanName.endsWith('.mp3')) {
    cleanName = cleanName.replace(/\.(wav|mp3)$/i, '');
  }
  const finalFilename = `${cleanName}${ext}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
