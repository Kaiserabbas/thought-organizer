// useVoice.js — Bilingual voice recognition: auto-detects Urdu & English
// Native Web Speech API — free, no backend, works on desktop and mobile browsers.

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
 * - Auto-detects language from recognized text and switches automatically
 * - Mobile-optimized: handles browser audio focus and auto-restarts smoothly
 * - Deduplicates chunks so text never repeats
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
  const [currentLang,       setCurrentLang]       = useState(lang);
  const [error,             setError]             = useState(null);

  const recognitionRef   = useRef(null);
  const shouldRestartRef = useRef(false);
  const restartTimerRef  = useRef(null);
  const onNewChunkRef    = useRef(onNewChunk);
  const onCommandRef     = useRef(onCommand);
  const seenChunksRef    = useRef(new Set()); // dedup — prevent repeated text

  onNewChunkRef.current = onNewChunk;
  onCommandRef.current  = onCommand;

  useEffect(() => { setCurrentLang(lang); }, [lang]);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    seenChunksRef.current.clear();
  }, []);

  const startListening = useCallback((forceLang) => {
    if (!isSupported) {
      setError('Voice input not supported in this browser. Please use Chrome, Edge, or Android Chrome.');
      return;
    }

    // On mobile devices, microphone access requires a secure context (HTTPS or localhost)
    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setError('Microphone access requires HTTPS or localhost on mobile browsers.');
      return;
    }

    setError(null);

    // Abort any prior instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }

    const useLang = forceLang || currentLang;
    let recognition;
    try {
      recognition = new SpeechRecognitionAPI();
    } catch (err) {
      setError(`Cannot initialize speech recognition: ${err.message}`);
      return;
    }

    // continuous=true keeps it alive; interim gives live preview as you speak
    recognition.continuous     = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = useLang;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      let interimText = '';

      // Only process new results from resultIndex — avoids re-processing old results
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
          const isUrduMode = useLang === 'ur-PK' || currentLang === 'ur-PK';
          if (isUrduMode || isLikelyRomanUrdu(chunk)) {
            processedChunk = transliterateRomanUrduOffline(chunk);
          }

          // Dedup: skip if we sent this exact chunk already in this session
          if (seenChunksRef.current.has(processedChunk)) continue;
          seenChunksRef.current.add(processedChunk);

          // Auto-switch language display if Urdu script detected in output
          const isUrdu = isUrduMode || containsUrdu(processedChunk);
          if (isUrdu && useLang !== 'ur-PK') {
            setCurrentLang('ur-PK');
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
        const isUrduMode = useLang === 'ur-PK' || currentLang === 'ur-PK';
        const displayInterim = isUrduMode ? transliterateRomanUrduOffline(interimText) : interimText;
        setInterimTranscript(isUrduMode ? displayInterim : formatEnglishSentence(displayInterim));
      } else {
        setInterimTranscript('');
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setError('Microphone access denied. Please allow microphone permission in browser settings.');
        shouldRestartRef.current = false;
        setIsListening(false);
      } else if (event.error === 'network') {
        // Transient network error on mobile
        setError('Network error with voice engine. Retrying connection...');
      } else if (event.error === 'no-speech') {
        // Natural pause / silence — not a fatal error
        setInterimTranscript('');
      } else if (event.error === 'audio-capture') {
        setError('Microphone unavailable or in use by another app.');
        shouldRestartRef.current = false;
        setIsListening(false);
      } else if (event.error !== 'aborted') {
        setError(`Voice recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');

      // Auto-restart after pause — this enables continuous dictation on both desktop and mobile
      if (shouldRestartRef.current) {
        if (recognitionRef.current) {
          try { recognitionRef.current.abort(); } catch { /* ignore */ }
          recognitionRef.current = null;
        }

        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (!shouldRestartRef.current) return;
          try {
            startListening(useLang);
          } catch (e) {
            console.warn('Auto-restart recognition error:', e);
          }
        }, 150);
      }
    };

    recognitionRef.current   = recognition;
    shouldRestartRef.current = true;

    try {
      recognition.start();
    } catch (err) {
      setError(`Microphone error: ${err.message}`);
      shouldRestartRef.current = false;
    }
  }, [currentLang, stopListening]);

  useEffect(() => () => {
    shouldRestartRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
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
