// geminiService.js — Gemini AI Service for Studio-Grade Spiritual Male TTS and Authentic Urdu Voice Typing
// Uses official Google Gemini models:
// - gemini-3.8-flash-tts: Real human-quality heavy, spiritual male voice generation
// - gemini-3.8-flash: Multimodal audio transcription & Roman Urdu -> Urdu script conversion

import { transliterateRomanUrduOffline, isLikelyRomanUrdu } from './urduTransliterator';

const GEMINI_API_STORAGE_KEY = 'gemini_api_key';

/**
 * Retrieve Gemini API key from localStorage or Vite environment variable
 */
export function getGeminiApiKey() {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem(GEMINI_API_STORAGE_KEY);
  if (stored && stored.trim()) return stored.trim();
  if (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY.trim();
  }
  return '';
}

/**
 * Persist Gemini API key to localStorage
 */
export function setGeminiApiKey(key) {
  if (typeof window === 'undefined') return;
  if (key && key.trim()) {
    localStorage.setItem(GEMINI_API_STORAGE_KEY, key.trim());
  } else {
    localStorage.removeItem(GEMINI_API_STORAGE_KEY);
  }
}

/**
 * Check if a valid API key is present
 */
export function hasGeminiApiKey() {
  return Boolean(getGeminiApiKey());
}

/**
 * Test a Gemini API key with a fast ping
 */
export async function testGeminiApiKey(keyToTest) {
  const apiKey = keyToTest || getGeminiApiKey();
  if (!apiKey) throw new Error('API key is empty');

  const start = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'ping' }] }],
      generationConfig: { maxOutputTokens: 5 },
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `HTTP error ${res.status}`);
  }

  const latency = Date.now() - start;
  return { success: true, latency };
}

/**
 * Converts Roman Urdu or mixed voice text into authentic Urdu script (حروفِ تہجی)
 * Uses Gemini if API key is configured, otherwise uses the offline phonetic engine.
 */
export async function ensureUrduScript(text) {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  const apiKey = getGeminiApiKey();

  // If Gemini API is available and text contains Latin/Roman letters that look like Roman Urdu
  if (apiKey && isLikelyRomanUrdu(trimmed)) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are an expert Urdu linguist. Convert the following spoken/dictated text into authentic Urdu script (نستعلیق / حروفِ تہجی). 
For example: 'aap kaise hain' -> 'آپ کیسے ہیں', 'kya haal hai' -> 'کیا حال ہے', 'shukriya' -> 'شکریہ', 'subha bakhair' -> 'صبح بخیر'.
If words are genuinely English terms (like 'computer', 'mobile'), you may keep them in English or Urdu script as appropriate.
Do NOT output Roman Urdu. Return ONLY the final converted text with no quotes, explanations, or notes.

Input text:
${trimmed}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText && candidateText.trim()) {
          return candidateText.trim();
        }
      }
    } catch (err) {
      console.warn('Gemini Urdu conversion failed, falling back to offline:', err);
    }
  }

  // Offline fallback
  return transliterateRomanUrduOffline(trimmed);
}

/**
 * Transcribe raw audio recorded from microphone using Gemini Multimodal Audio
 */
export async function transcribeAudioWithGemini(audioBlob, lang = 'ur-PK') {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('Gemini API key is required for direct AI audio transcription');

  // Convert audio blob to base64
  const arrayBuffer = await audioBlob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Audio = btoa(binary);

  const isUrdu = lang.startsWith('ur') || lang === 'ur-PK';
  const prompt = isUrdu
    ? 'Transcribe this audio file accurately. Write strictly in authentic Urdu script (نستعلیق / حروفِ تہجی, for example: آپ کیسے ہیں). Do NOT write in Roman Urdu (no Latin letters for Urdu words). If words are English, write in English. Output ONLY the transcribed text, nothing else.'
    : 'Transcribe this audio file accurately. Output ONLY the transcribed text, nothing else.';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: audioBlob.type || 'audio/webm',
                data: base64Audio,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
      },
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Transcription failed with HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No transcription returned by Gemini');
  return text.trim();
}

/**
 * Generates real, heavy, spiritual, resonant male speech audio using Gemini 3.8 Flash TTS
 * Returns a downloadable/playable audio Blob (audio/wav)
 */
export async function generateGeminiSpiritualSpeech(text, { voice = 'Charon' } = {}) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const err = new Error('Gemini API key is required');
    err.code = 'MISSING_GEMINI_KEY';
    throw err;
  }

  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Text cannot be empty');
  }

  // Method 1: Google Gemini Models API with AUDIO response modality (gemini-2.5-flash / gemini-2.0-flash)
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Read the following text aloud with a deep, heavy, spiritual, resonant, and calm male voice. Read only the words:\n\n${cleanText}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice || 'Charon',
              },
            },
          },
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const part = data?.candidates?.[0]?.content?.parts?.find(
          (p) => p.inlineData && p.inlineData.data
        );
        if (part && part.inlineData.data) {
          const mimeType = part.inlineData.mimeType || 'audio/wav';
          const byteCharacters = atob(part.inlineData.data);
          const byteNumbers = new Uint8Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          return new Blob([byteNumbers], { type: mimeType });
        }
      }
    } catch {
      // try next model or fallback
    }
  }

  // Method 2: Interactions API fallback
  try {
    const styleInstruction = 'deep, heavy, spiritual, resonant, solemn male baritone voice with calm, reverent cadence';
    const payload = {
      model: 'gemini-3.8-flash-tts',
      input: [
        {
          type: 'user_input',
          content: [
            {
              type: 'text',
              text: cleanText,
              annotations: [
                {
                  type: 'speech_metadata',
                  style: styleInstruction,
                },
              ],
            },
          ],
        },
      ],
      response_format: {
        type: 'audio',
        mime_type: 'audio/wav',
      },
      generation_config: {
        speech_config: [
          {
            voice: voice || 'Charon',
          },
        ],
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      let base64Audio = null;
      if (data?.output_audio?.data) {
        base64Audio = data.output_audio.data;
      } else if (data?.steps) {
        for (const step of data.steps) {
          if (step.type === 'model_output' && Array.isArray(step.content)) {
            for (const item of step.content) {
              if (item.type === 'audio' && item.data) {
                base64Audio = item.data;
                break;
              }
            }
          }
          if (base64Audio) break;
        }
      }

      if (base64Audio) {
        const byteCharacters = atob(base64Audio);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        return new Blob([byteNumbers], { type: 'audio/wav' });
      }
    }
  } catch {
    // fallback
  }

  throw new Error('Gemini TTS was unable to generate audio for this post.');
}

// In-memory cache for generated spiritual speech audio Blobs
const spiritualAudioCache = new Map();

/**
 * Get or generate spiritual speech audio Blob (cached in memory)
 */
export async function getOrGenerateSpiritualSpeech(text, options = {}) {
  const cacheKey = text.trim();
  if (spiritualAudioCache.has(cacheKey)) {
    return spiritualAudioCache.get(cacheKey);
  }
  const blob = await generateGeminiSpiritualSpeech(text, options);
  spiritualAudioCache.set(cacheKey, blob);
  return blob;
}
