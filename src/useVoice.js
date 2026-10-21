// useVoice.js — Bilingual voice recognition: auto-detects Urdu & English
// Rock-solid Web Speech API engine: continuous dictation, live typing, zero dropped chunks.

import { useState, useEffect, useRef, useCallback } from 'react';
import { transliterateRomanUrduOffline, isLikelyRomanUrdu } from './urduTransliterator';

const isSupported =
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

/** Detect whether text contains Urdu/Arabic script characters */
export function containsUrdu(text) {
  if (!text || typeof text !== 'string') return false;
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Capitalizes the first letter of English sentences and standalone pronoun 'I'
 * Examples:
 * "hello how are you. i am fine." -> "Hello how are you. I am fine."
 * "i think i'm good" -> "I think I'm good"
 */
export function formatEnglishSentence(text) {
  if (!text || typeof text !== 'string') return text;
  if (containsUrdu(text)) return text;

  let formatted = text;

  // 1. Capitalize first letter at start of string or after sentence delimiters (. ! ?) or newlines
  formatted = formatted.replace(/(^|[.!?]\s+|\n\s*)([a-z])/g, (_, prefix, char) => {
    return prefix + char.toUpperCase();
  });

  // 2. Capitalize standalone pronoun "i" and contractions like "i'm", "i've", "i'll", "i'd"
  formatted = formatted.replace(/\b(i)\b/g, 'I');
  formatted = formatted.replace(/\b(i)('m|'ve|'ll|'d)\b/gi, (_, _i, contraction) => {
    return 'I' + contraction.toLowerCase();
  });

  return formatted;
}

/**
 * useVoice — Bilingual STT hook
 * - 'ur-PK' → outputs native Urdu Unicode script (not Roman transliteration)
 * - 'en-US' → outputs English text with capitalized first words
 * - Continuous live transcription without chunk dropping or looping
 *
 * @param {Object}   options
 * @param {string}   options.lang       — initial lang 'en-US' | 'ur-PK'
 * @param {function} options.onNewChunk — called with each NEW final chunk only
 * @param {function} options.onCommand  — called with recognized command string
 */
export function useVoice({ lang = 'ur-PK', onNewChunk, onCommand } = {}) {
  const [isListening,       setIsListening]       = useState(false);
  const [transcript,        setTranscript]        = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [currentLang,       setCurrentLangState]  = useState(lang);
  const [error,             setError]             = useState(null);

  const recognitionRef       = useRef(null);
  const shouldRestartRef     = useRef(false);
  const restartTimerRef      = useRef(null);
  const currentLangRef       = useRef(lang);
  const lastChunkRef         = useRef(''); // guards against immediate duplicate echo only
  const onNewChunkRef        = useRef(onNewChunk);
  const onCommandRef         = useRef(onCommand);

  onNewChunkRef.current = onNewChunk;
  onCommandRef.current  = onCommand;

  const setCurrentLang = useCallback((newLang) => {
    setCurrentLangState(newLang);
    currentLangRef.current = newLang;
    // If actively listening, seamlessly switch to new language
    if (shouldRestartRef.current && recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    setCurrentLangState(lang);
    currentLangRef.current = lang;
  }, [lang]);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    lastChunkRef.current = '';

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      rec.onend = null;
      rec.onerror = null;
      rec.onresult = null;
      rec.onstart = null;
      try { rec.abort(); } catch { /* ignore */ }
    }

    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    lastChunkRef.current = '';
  }, []);

  // ── Result Handler ─────────────────────────────────────────────────
  const handleResult = useCallback((event) => {
    let interimText = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const rawText = result[0].transcript;

      if (result.isFinal) {
        const chunk = rawText.trim();
        if (!chunk) continue;

        // Voice commands
        const lower = chunk.toLowerCase();
        if (onCommandRef.current) {
          if (lower === 'save'    || lower === 'محفوظ')   { onCommandRef.current('save');  continue; }
          if (lower === 'clear'   || lower === 'صاف کرو') { onCommandRef.current('clear'); continue; }
          if (lower === 'stop'    || lower === 'بند کرو') { onCommandRef.current('stop'); stopListening(); continue; }
        }

        // Convert to Urdu script if in Urdu mode or if text is recognized as Roman Urdu
        let processedChunk = chunk;
        const activeLang = currentLangRef.current || 'ur-PK';
        const isUrduMode = activeLang === 'ur-PK';
        if (isUrduMode || isLikelyRomanUrdu(chunk)) {
          processedChunk = transliterateRomanUrduOffline(chunk);
        }

        // Skip exact duplicate from same recognition packet
        if (lastChunkRef.current === processedChunk) continue;
        lastChunkRef.current = processedChunk;

        // Auto-switch language display if Urdu script detected in output
        const isUrdu = isUrduMode || containsUrdu(processedChunk);
        if (isUrdu && activeLang !== 'ur-PK') {
          setCurrentLangState('ur-PK');
          currentLangRef.current = 'ur-PK';
        }

        // Format English capitalization if English
        if (!isUrdu) {
          processedChunk = formatEnglishSentence(processedChunk);
        }

        // For every pause: add a space and "۔" for Urdu and "." for English
        const pausePunctuation = isUrdu ? '۔' : '.';
        const hasCustomPunctuation = /[؟?!]$/.test(processedChunk.trim());
        const cleanChunk = processedChunk.replace(/[.۔!?؟\s]+$/, '').trim();
        let finalChunk = processedChunk;
        if (hasCustomPunctuation) {
          finalChunk = processedChunk.trim();
        } else if (cleanChunk) {
          finalChunk = `${cleanChunk}${pausePunctuation}`;
        }

        if (!isUrdu) {
          finalChunk = formatEnglishSentence(finalChunk);
        }

        // Append to local transcript with space and format
        setTranscript((prev) => {
          if (!prev) return finalChunk;
          const combined = `${prev.trim()} ${finalChunk}`;
          return isUrdu ? combined : formatEnglishSentence(combined);
        });
        setInterimTranscript('');

        // Fire parent callback with ONLY this new chunk
        if (onNewChunkRef.current) onNewChunkRef.current(finalChunk);

      } else {
        interimText += rawText;
      }
    }

    if (interimText) {
      const activeLang = currentLangRef.current || 'ur-PK';
      const isUrduMode = activeLang === 'ur-PK';
      const displayInterim = isUrduMode ? transliterateRomanUrduOffline(interimText) : interimText;
      setInterimTranscript(isUrduMode ? displayInterim : formatEnglishSentence(displayInterim));
    } else {
      setInterimTranscript('');
    }
  }, [stopListening]);

  // ── Error Handler ──────────────────────────────────────────────────
  const handleError = useCallback((event) => {
    // Normal abort when recycling or stopping
    if (event.error === 'aborted') {
      return;
    }

    // Silence timeout is normal when pausing to think
    if (event.error === 'no-speech') {
      setInterimTranscript('');
      return;
    }

    if (event.error === 'not-allowed' || event.error === 'permission-denied') {
      setError('Microphone permission blocked. Please allow mic in browser settings.');
      shouldRestartRef.current = false;
      setIsListening(false);
      return;
    }

    if (event.error === 'audio-capture') {
      setError('Microphone unavailable or in use by another app.');
      shouldRestartRef.current = false;
      setIsListening(false);
      return;
    }

    if (event.error === 'network') {
      // Non-fatal momentary disconnect: speech server will auto-reconnect
      setInterimTranscript('');
    }
  }, []);

  // ── Internal Spawn / Lifecycle ────────────────────────────────────
  const spawnRecognition = useCallback(() => {
    if (!shouldRestartRef.current || !SpeechRecognitionAPI) return;

    try {
      const rec = new SpeechRecognitionAPI();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = currentLangRef.current || 'ur-PK';

      rec.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      rec.onresult = handleResult;
      rec.onerror = handleError;

      rec.onend = () => {
        if (recognitionRef.current !== rec) {
          return;
        }
        recognitionRef.current = null;

        if (!shouldRestartRef.current) {
          setIsListening(false);
          setInterimTranscript('');
          return;
        }

        // Seamless background recycling between phrases
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (!shouldRestartRef.current) return;
          spawnRecognition();
        }, 80);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.warn('Spawn recognition error:', err);
      if (shouldRestartRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (shouldRestartRef.current) spawnRecognition();
        }, 200);
      }
    }
  }, [handleResult, handleError]);

  // ── Start Listening ────────────────────────────────────────────────
  const startListening = useCallback((forceLang) => {
    if (!isSupported) {
      setError('Voice input not supported in this browser. Please use Chrome, Edge, or Android Chrome.');
      return;
    }

    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setError('Microphone access requires HTTPS or localhost on mobile browsers.');
      return;
    }

    setError(null);
    lastChunkRef.current = '';

    if (forceLang) {
      setCurrentLangState(forceLang);
      currentLangRef.current = forceLang;
    }

    shouldRestartRef.current = true;
    setIsListening(true);

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (recognitionRef.current) {
      const oldRec = recognitionRef.current;
      recognitionRef.current = null;
      oldRec.onend = null;
      oldRec.onerror = null;
      oldRec.onresult = null;
      oldRec.onstart = null;
      try { oldRec.abort(); } catch { /* ignore */ }
    }

    spawnRecognition();
  }, [spawnRecognition]);

  // Clean up on unmount
  useEffect(() => () => {
    shouldRestartRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      rec.onend = null;
      rec.onerror = null;
      rec.onresult = null;
      rec.onstart = null;
      try { rec.abort(); } catch { /* ignore */ }
    }
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    currentLang,
    setCurrentLang,
    startListening,
    stopListening,
    resetTranscript,
    error,
    isSupported,
  };
}
