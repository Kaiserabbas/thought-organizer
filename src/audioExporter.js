// audioExporter.js — Generates and exports studio-grade heavy spiritual male voice audio files (.mp3 / .wav)
// Supports Microsoft Azure Neural Voice (ur-PK-AsadNeural / en-US-GuyNeural) and Google Gemini 3.8 Flash TTS.

import { generateAzureNeuralSpeech, hasAzureSpeechKey } from './azureSpeechService';
import { generateGeminiSpiritualSpeech, hasGeminiApiKey } from './geminiService';

/**
 * Generates an authentic heavy, spiritual male voice audio file using Azure Neural Voice or Gemini.
 * @param {string} text - Thought text to convert to speech
 * @param {Object} [options]
 * @param {string} [options.engine] - 'azure' | 'gemini' | 'auto'
 * @param {string} [options.lang] - 'ur-PK' | 'en-US'
 * @param {string} [options.voice] - Custom voice name
 * @param {number} [options.rate] - Speed multiplier
 * @param {number} [options.pitch] - Pitch multiplier
 * @returns {Promise<{ blob: Blob, extension: string }>} - Audio Blob & file extension
 */
export async function generateSpiritualVoiceAudio(text, options = {}) {
  if (!text || !text.trim()) {
    throw new Error('No text provided for audio export');
  }

  const { engine = 'auto', lang, voice, rate = 0.85, pitch = 0.68 } = options;

  // 1. Try Azure Neural Voice if explicitly requested or auto-selected
  if (engine === 'azure' || (engine === 'auto' && hasAzureSpeechKey())) {
    try {
      const blob = await generateAzureNeuralSpeech(text, { lang, voice, rate, pitch });
      return { blob, extension: 'mp3' };
    } catch (azureErr) {
      console.warn('Azure TTS export failed, falling back:', azureErr);
      if (engine === 'azure') throw azureErr;
    }
  }

  // 2. Try Gemini 3.8 Flash TTS if requested or available
  if (engine === 'gemini' || (engine === 'auto' && hasGeminiApiKey())) {
    try {
      const blob = await generateGeminiSpiritualSpeech(text, {
        voice: voice || 'Charon',
      });
      return { blob, extension: 'wav' };
    } catch (geminiErr) {
      console.warn('Gemini TTS export failed, falling back:', geminiErr);
      if (engine === 'gemini') throw geminiErr;
    }
  }

  // 3. Fallback: If Azure is configured, try it as last AI resort
  if (hasAzureSpeechKey()) {
    const blob = await generateAzureNeuralSpeech(text, { lang, voice, rate, pitch });
    return { blob, extension: 'mp3' };
  }

  const err = new Error('An active Azure Speech or Gemini API key is required to export studio spiritual voice audio.');
  err.code = 'MISSING_API_KEY';
  throw err;
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
