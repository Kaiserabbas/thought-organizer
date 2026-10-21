// useVoice.js — Bilingual voice recognition: auto-detects Urdu & English
// Native Web Speech API — free, zero audio conflicts, loop-proof dictation.

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
 * - Loop-proof: immune to rapid on/off restarts, mic collisions, or unmount leaks
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

  const recognitionRef       = useRef(null);
  const shouldRestartRef     = useRef(false);
  const restartTimerRef      = useRef(null);
  const consecutiveErrorsRef = useRef(0);
  const currentLangRef       = useRef(lang);
  const onNewChunkRef        = useRef(onNewChunk);
  const onCommandRef         = useRef(onCommand);
  const seenChunksRef        = useRef(new Set()); // dedup — prevent repeated text

  onNewChunkRef.current = onNewChunk;
  onCommandRef.current  = onCommand;

  useEffect(() => {
    setCurrentLang(lang);
    currentLangRef.current = lang;
  }, [lang]);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    consecutiveErrorsRef.current = 0;

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (recognitionRef.current) {
      const oldRec = recognitionRef.current;
      recognitionRef.current = null;
      // Strip listeners first so abort() does NOT fire onend and trigger restart
      oldRec.onend = null;
      oldRec.onerror = null;
      oldRec.onresult = null;
      oldRec.onstart = null;
      try { oldRec.abort(); } catch { /* ignore */ }
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

    // Cancel any pending restart timers
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    // Cleanly unbind and abort any previous recognition instance
    if (recognitionRef.current) {
      const oldRec = recognitionRef.current;
      recognitionRef.current = null;
      oldRec.onend = null;
      oldRec.onerror = null;
      oldRec.onresult = null;
      oldRec.onstart = null;
      try { oldRec.abort(); } catch { /* ignore */ }
    }

    const useLang = forceLang || currentLangRef.current || 'ur-PK';
    let recognition;
    try {
      recognition = new SpeechRecognitionAPI();
    } catch (err) {
      setError(`Cannot initialize speech recognition: ${err.message}`);
      return;
    }

    recognition.continuous     = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = useLang;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      consecutiveErrorsRef.current = 0;
    };

    recognition.onresult = (event) => {
      consecutiveErrorsRef.current = 0;
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
          const isUrduMode = useLang === 'ur-PK' || currentLangRef.current === 'ur-PK';
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
        const isUrduMode = useLang === 'ur-PK' || currentLangRef.current === 'ur-PK';
        const displayInterim = isUrduMode ? transliterateRomanUrduOffline(interimText) : interimText;
        setInterimTranscript(isUrduMode ? displayInterim : formatEnglishSentence(displayInterim));
      } else {
        setInterimTranscript('');
      }
    };

    recognition.onerror = (event) => {
      // Abort is a normal event when user stops listening or resets
      if (event.error === 'aborted') {
        return;
      }

      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setError('Microphone access denied. Please allow microphone permission in browser settings.');
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

      // Track consecutive errors to prevent rapid infinite restart loops
      consecutiveErrorsRef.current += 1;
      if (consecutiveErrorsRef.current >= 2) {
        shouldRestartRef.current = false;
        setIsListening(false);
        setError('Microphone disconnected or interrupted. Tap mic to restart.');
        return;
      }

      if (event.error === 'network') {
        setError('Voice connection interrupted.');
      } else if (event.error === 'no-speech') {
        setInterimTranscript('');
      } else {
        setError(`Voice error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // If this instance is not the currently active one, ignore completely
      if (recognitionRef.current !== recognition) {
        return;
      }

      recognitionRef.current = null;

      // Only restart if the user intentionally has listening turned on and no fatal error occurred
      if (shouldRestartRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        // Safe 600ms cooldown prevents rapid mic on/off cycling
        restartTimerRef.current = setTimeout(() => {
          if (!shouldRestartRef.current) return;
          try {
            startListening(useLang);
          } catch (e) {
            console.warn('Auto-restart recognition error:', e);
            shouldRestartRef.current = false;
            setIsListening(false);
          }
        }, 600);
      } else {
        setIsListening(false);
        setInterimTranscript('');
      }
    };

    recognitionRef.current   = recognition;
    shouldRestartRef.current = true;

    try {
      recognition.start();
    } catch (err) {
      setError(`Microphone error: ${err.message}`);
      shouldRestartRef.current = false;
      setIsListening(false);
    }
  }, [stopListening]);

  useEffect(() => () => {
    shouldRestartRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (recognitionRef.current) {
      const oldRec = recognitionRef.current;
      recognitionRef.current = null;
      oldRec.onend = null;
      oldRec.onerror = null;
      oldRec.onresult = null;
      oldRec.onstart = null;
      try { oldRec.abort(); } catch { /* ignore */ }
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
