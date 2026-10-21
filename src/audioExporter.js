// audioExporter.js — Generates and exports studio-grade heavy spiritual male voice audio files (.wav)
// Uses Google Gemini gemini-3.8-flash-tts for authentic human male speech.

import { generateGeminiSpiritualSpeech, hasGeminiApiKey } from './geminiService';

/**
 * Generates an authentic heavy, spiritual male voice audio file (.wav) using Gemini.
 * @param {string} text - Thought text to convert to speech
 * @returns {Promise<Blob>} - WAV audio Blob
 */
export async function generateSpiritualVoiceWav(text) {
  if (!text || !text.trim()) {
    throw new Error('No text provided');
  }

  // Verify Gemini API key is configured
  if (!hasGeminiApiKey()) {
    const err = new Error('Gemini API key is required to generate real spiritual male voice audio.');
    err.code = 'MISSING_GEMINI_KEY';
    throw err;
  }

  // Generate real human voice with Gemini 3.8 Flash TTS
  return await generateGeminiSpiritualSpeech(text, {
    voice: 'Charon', // Deep, resonant, informative male voice
  });
}

/**
 * Triggers a download of an audio Blob file in the browser.
 */
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.wav') ? filename : `${filename}.wav`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
