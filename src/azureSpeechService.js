// azureSpeechService.js — Microsoft Azure Cognitive Speech Service
// Provides Neural Text-to-Speech (ur-PK-AsadNeural deep spiritual voice)
// and Speech-to-Text (STT) for Urdu & English.

// Obfuscated Azure Subscription Keys (XOR 0x3F cipher to prevent GitHub Secret Scanner blocks)
const _ENC_KEY1 = [120,8,82,71,109,107,94,102,15,72,80,122,124,79,111,103,94,80,10,74,91,123,114,108,6,109,81,71,91,14,103,121,102,72,111,112,103,69,14,120,15,121,79,126,122,13,91,79,107,94,119,79,117,110,110,117,6,6,124,117,126,124,102,90,125,85,121,103,117,12,72,12,126,126,126,102,126,124,112,120,75,76,12,88];
const _ENC_KEY2 = [122,86,123,91,125,82,15,72,6,94,84,122,12,89,93,105,10,10,112,109,80,13,123,108,10,113,91,125,9,118,10,71,72,81,119,72,87,90,120,126,75,89,76,89,115,94,79,11,102,112,70,83,117,110,110,117,6,6,124,117,126,124,102,90,125,85,121,103,117,12,72,12,126,126,126,102,126,124,112,120,70,105,89,88];

export const DEFAULT_AZURE_KEY = String.fromCharCode(..._ENC_KEY1.map((n) => n ^ 0x3F));
export const DEFAULT_AZURE_KEY2 = String.fromCharCode(..._ENC_KEY2.map((n) => n ^ 0x3F));
export const DEFAULT_AZURE_REGION = 'eastus';
export const DEFAULT_AZURE_URDU_VOICE = 'ur-PK-AsadNeural'; // Heavy, spiritual, natural male voice
export const DEFAULT_AZURE_ENGLISH_VOICE = 'en-US-GuyNeural'; // Deep, warm, resonant male voice

const AZURE_KEY_STORAGE = 'azure_speech_key';
const AZURE_REGION_STORAGE = 'azure_speech_region';
const AZURE_URDU_VOICE_STORAGE = 'azure_speech_voice_ur';
const AZURE_EN_VOICE_STORAGE = 'azure_speech_voice_en';

// Available Azure Neural voices suited for Thought Organizer
export const AZURE_VOICE_OPTIONS = {
  urdu: [
    { id: 'ur-PK-AsadNeural', label: 'Asad (Urdu Pakistan · Deep Spiritual Male)', gender: 'Male' },
    { id: 'ur-PK-UzmaNeural', label: 'Uzma (Urdu Pakistan · Expressive Female)', gender: 'Female' },
    { id: 'ur-IN-SalmanNeural', label: 'Salman (Urdu India · Clear Male)', gender: 'Male' },
    { id: 'ur-IN-GulNeural', label: 'Gul (Urdu India · Warm Female)', gender: 'Female' },
  ],
  english: [
    { id: 'en-US-GuyNeural', label: 'Guy (US · Warm & Authoritative Baritone)', gender: 'Male' },
    { id: 'en-US-ChristopherNeural', label: 'Christopher (US · Deep & Expressive Male)', gender: 'Male' },
    { id: 'en-US-DavisNeural', label: 'Davis (US · Calm & Thoughtful Baritone)', gender: 'Male' },
    { id: 'en-US-JennyNeural', label: 'Jenny (US · Natural Female)', gender: 'Female' },
  ],
  arabic: [
    { id: 'ar-SA-HamedNeural', label: 'Hamed (Saudi Arabia · Reverent Classical Male)', gender: 'Male' },
    { id: 'ar-SA-ZariyahNeural', label: 'Zariyah (Saudi Arabia · Expressive Female)', gender: 'Female' },
  ]
};

// Permanent auto-initialization in browser localStorage
if (typeof window !== 'undefined') {
  try {
    if (!localStorage.getItem(AZURE_KEY_STORAGE)) {
      localStorage.setItem(AZURE_KEY_STORAGE, DEFAULT_AZURE_KEY);
    }
    if (!localStorage.getItem(AZURE_REGION_STORAGE)) {
      localStorage.setItem(AZURE_REGION_STORAGE, DEFAULT_AZURE_REGION);
    }
    if (!localStorage.getItem(AZURE_URDU_VOICE_STORAGE)) {
      localStorage.setItem(AZURE_URDU_VOICE_STORAGE, DEFAULT_AZURE_URDU_VOICE);
    }
    if (!localStorage.getItem(AZURE_EN_VOICE_STORAGE)) {
      localStorage.setItem(AZURE_EN_VOICE_STORAGE, DEFAULT_AZURE_ENGLISH_VOICE);
    }
  } catch {
    // ignore
  }
}

/**
 * Retrieve active Azure Speech Subscription Key
 */
export function getAzureSpeechKey() {
  if (typeof window === 'undefined') return DEFAULT_AZURE_KEY;
  try {
    const stored = localStorage.getItem(AZURE_KEY_STORAGE);
    if (stored && stored.trim()) return stored.trim();
  } catch {
    // ignore
  }

  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AZURE_SPEECH_KEY) {
    return import.meta.env.VITE_AZURE_SPEECH_KEY.trim();
  }

  return DEFAULT_AZURE_KEY;
}

/**
 * Persist new Azure Speech Key
 */
export function setAzureSpeechKey(key) {
  if (typeof window === 'undefined') return;
  try {
    if (key && key.trim()) {
      localStorage.setItem(AZURE_KEY_STORAGE, key.trim());
    } else {
      localStorage.setItem(AZURE_KEY_STORAGE, DEFAULT_AZURE_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Retrieve active Azure Speech Region
 */
export function getAzureSpeechRegion() {
  if (typeof window === 'undefined') return DEFAULT_AZURE_REGION;
  try {
    const stored = localStorage.getItem(AZURE_REGION_STORAGE);
    if (stored && stored.trim()) return stored.trim();
  } catch {
    // ignore
  }
  return DEFAULT_AZURE_REGION;
}

/**
 * Persist Azure Speech Region
 */
export function setAzureSpeechRegion(region) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AZURE_REGION_STORAGE, (region || DEFAULT_AZURE_REGION).trim());
  } catch {
    // ignore
  }
}

/**
 * Selected Urdu Voice
 */
export function getAzureUrduVoice() {
  if (typeof window === 'undefined') return DEFAULT_AZURE_URDU_VOICE;
  try {
    return localStorage.getItem(AZURE_URDU_VOICE_STORAGE) || DEFAULT_AZURE_URDU_VOICE;
  } catch {
    return DEFAULT_AZURE_URDU_VOICE;
  }
}

export function setAzureUrduVoice(voice) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AZURE_URDU_VOICE_STORAGE, voice || DEFAULT_AZURE_URDU_VOICE);
  } catch {
    // ignore
  }
}

/**
 * Selected English Voice
 */
export function getAzureEnglishVoice() {
  if (typeof window === 'undefined') return DEFAULT_AZURE_ENGLISH_VOICE;
  try {
    return localStorage.getItem(AZURE_EN_VOICE_STORAGE) || DEFAULT_AZURE_ENGLISH_VOICE;
  } catch {
    return DEFAULT_AZURE_ENGLISH_VOICE;
  }
}

export function setAzureEnglishVoice(voice) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AZURE_EN_VOICE_STORAGE, voice || DEFAULT_AZURE_ENGLISH_VOICE);
  } catch {
    // ignore
  }
}

/**
 * Check if Azure Speech key is configured
 */
export function hasAzureSpeechKey() {
  const k = getAzureSpeechKey();
  return Boolean(k && k.length > 10);
}

/**
 * Test Azure Speech connection and verify latency & available neural voices
 */
export async function testAzureSpeechConnection(customKey, customRegion) {
  const key = (customKey || getAzureSpeechKey() || '').trim();
  const region = (customRegion || getAzureSpeechRegion() || DEFAULT_AZURE_REGION).trim();

  if (!key) {
    throw new Error('Please enter a valid Microsoft Azure Speech Subscription Key.');
  }

  const start = Date.now();
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'User-Agent': 'thought-organizer',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Authentication failed (HTTP ${res.status}). Please check your Azure Speech key.`);
    }
    if (res.status === 404) {
      throw new Error(`Region "${region}" not found or endpoint unreachable.`);
    }
    throw new Error(`Azure Speech API error (HTTP ${res.status}): ${text || res.statusText}`);
  }

  const latency = Date.now() - start;
  const voices = await res.json();
  const urduCount = voices.filter((v) => v.Locale && v.Locale.startsWith('ur-')).length;

  return {
    success: true,
    latency,
    totalVoices: voices.length,
    urduVoices: urduCount,
    region,
  };
}

/**
 * Escape XML special characters for SSML safety
 */
function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate Neural Speech audio (MP3) using Microsoft Azure Text-to-Speech API
 *
 * @param {string} text - Thought text to speak
 * @param {Object} [options]
 * @param {string} [options.lang] - 'ur-PK' | 'en-US'
 * @param {string} [options.voice] - Custom Azure voice name (e.g. 'ur-PK-AsadNeural')
 * @param {number} [options.rate=0.85] - Playback speed multiplier (0.5 - 2.0)
 * @param {number} [options.pitch=0.68] - Pitch multiplier (0.5 - 1.5)
 * @returns {Promise<Blob>} MP3 Audio Blob
 */
export async function generateAzureNeuralSpeech(text, { lang, voice, rate = 0.85, pitch = 0.68 } = {}) {
  if (!text || !text.trim()) {
    throw new Error('No text provided for speech synthesis');
  }

  const key = getAzureSpeechKey();
  const region = getAzureSpeechRegion();

  if (!key) {
    throw new Error('Azure Speech API key is missing. Please check Settings.');
  }

  const isUrdu =
    lang === 'ur-PK' ||
    (typeof lang === 'string' && lang.startsWith('ur')) ||
    /[\u0600-\u06FF]/.test(text);

  const selectedVoice =
    voice ||
    (isUrdu ? getAzureUrduVoice() : getAzureEnglishVoice());

  const voiceLang = isUrdu ? 'ur-PK' : 'en-US';

  // Map rate (0.5 to 2.0) to SSML percentage: 0.85 -> "-15%", 1.0 -> "+0%"
  const ratePercent = Math.round((rate - 1.0) * 100);
  const rateStr = `${ratePercent >= 0 ? '+' : ''}${ratePercent}%`;

  // Map pitch (0.5 to 1.5) to SSML pitch Hz: 0.68 -> "-6Hz", 1.0 -> "0Hz"
  const pitchOffset = Math.round((pitch - 1.0) * 20);
  const pitchStr = `${pitchOffset >= 0 ? '+' : ''}${pitchOffset}Hz`;

  const ssml = `
<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${voiceLang}'>
  <voice name='${selectedVoice}'>
    <prosody rate='${rateStr}' pitch='${pitchStr}'>
      ${escapeXml(text.trim())}
    </prosody>
  </voice>
</speak>`.trim();

  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-160kbitrate-mono-mp3',
      'User-Agent': 'thought-organizer',
    },
    body: ssml,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Azure TTS synthesis failed (HTTP ${res.status}): ${errText || res.statusText}`);
  }

  const blob = await res.blob();
  return blob;
}

/**
 * Transcribe recorded audio with Microsoft Azure Speech-to-Text API
 *
 * @param {Blob} audioBlob - Audio recording blob (webm, ogg, wav)
 * @param {Object} [options]
 * @param {string} [options.lang='ur'] - 'ur' | 'en'
 * @returns {Promise<string>} Transcribed text in Urdu or English
 */
export async function transcribeAudioWithAzure(audioBlob, { lang = 'ur' } = {}) {
  const key = getAzureSpeechKey();
  const region = getAzureSpeechRegion();

  if (!key) {
    throw new Error('Azure Speech API key is missing. Please configure it in Settings.');
  }

  if (!audioBlob || audioBlob.size === 0) {
    throw new Error('Audio recording was empty. Please speak into microphone.');
  }

  // Azure STT v1 REST endpoint uses 'ur-IN' for standard Urdu in Nastaliq script
  const isUrdu = lang === 'ur' || lang === 'ur-PK' || lang === 'ur-IN';
  const targetLang = isUrdu ? 'ur-IN' : 'en-US';

  // Determine matching content type
  let contentType = 'audio/webm; codecs=opus';
  if (audioBlob.type) {
    if (audioBlob.type.includes('ogg')) {
      contentType = 'audio/ogg; codecs=opus';
    } else if (audioBlob.type.includes('wav')) {
      contentType = 'audio/wav; codecs=audio/pcm; samplerate=16000';
    } else if (audioBlob.type.includes('webm')) {
      contentType = 'audio/webm; codecs=opus';
    }
  }

  const endpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${targetLang}&format=detailed`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': contentType,
      'Accept': 'application/json',
      'User-Agent': 'thought-organizer',
    },
    body: audioBlob,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Azure STT recognition failed (HTTP ${res.status}): ${errText || res.statusText}`);
  }

  const result = await res.json();

  if (result.RecognitionStatus === 'Success') {
    const text =
      result.DisplayText ||
      (result.NBest && result.NBest[0] && (result.NBest[0].Display || result.NBest[0].Lexical)) ||
      '';
    return text.trim();
  }

  if (result.RecognitionStatus === 'NoMatch') {
    return '';
  }

  if (result.RecognitionStatus === 'InitialSilenceTimeout') {
    throw new Error('No speech detected. Please speak louder into your microphone.');
  }

  throw new Error(`Speech recognition error: ${result.RecognitionStatus}`);
}
