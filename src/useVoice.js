// useVoice.js — Bilingual voice recognition: auto-detects Urdu & English
// Native Web Speech API — free, no backend, no paid APIs.

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
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * useVoice — Bilingual STT hook
 * - 'ur-PK' → outputs native Urdu Unicode script (not Roman transliteration)
 * - 'en-US' → outputs English text
 * - Auto-detects language from recognized text and switches automatically
 * - Auto-restarts after natural pauses (continuous dictation)
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
  const onNewChunkRef    = useRef(onNewChunk);
  const onCommandRef     = useRef(onCommand);
  const seenChunksRef    = useRef(new Set()); // dedup — prevent repeated text

  onNewChunkRef.current = onNewChunk;
  onCommandRef.current  = onCommand;

  useEffect(() => { setCurrentLang(lang); }, [lang]);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
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
      setError('Voice input not supported. Please use Chrome or Edge.');
      return;
    }

    setError(null);

    // Abort any prior instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }

    const useLang = forceLang || currentLang;
    const recognition = new SpeechRecognitionAPI();

    // continuous=true keeps it alive; interim gives live preview as you speak
    recognition.continuous     = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    // This setting tells Chrome to output Urdu script (Unicode) not Roman letters
    recognition.lang = useLang;

    recognition.onstart = () => { setIsListening(true); setError(null); };

    recognition.onresult = (event) => {
      let interimText = '';

      // Only process new results from resultIndex — avoids processing old results
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
          if (containsUrdu(processedChunk) && useLang !== 'ur-PK') {
            setCurrentLang('ur-PK');
          }

          // Append to local transcript
          setTranscript((prev) => prev ? `${prev} ${processedChunk}` : processedChunk);
          setInterimTranscript('');

          // Fire parent callback with ONLY this new chunk
          if (onNewChunkRef.current) onNewChunkRef.current(processedChunk);

        } else {
          interimText += rawText;
        }
      }

      if (interimText) {
        const isUrduMode = useLang === 'ur-PK' || currentLang === 'ur-PK';
        const displayInterim = isUrduMode ? transliterateRomanUrduOffline(interimText) : interimText;
        setInterimTranscript(displayInterim);
      } else {
        setInterimTranscript('');
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setError('Microphone access denied. Allow mic permission in browser settings.');
        shouldRestartRef.current = false;
      } else if (event.error === 'network') {
        setError('Network error. For Urdu offline: download Urdu voice in Android language settings.');
      } else if (event.error === 'no-speech') {
        setInterimTranscript(''); // silence — not an error
      } else if (event.error !== 'aborted') {
        setError(`Voice recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');

      // Auto-restart after pause — this enables true continuous dictation
      if (shouldRestartRef.current && recognitionRef.current === recognition) {
        setTimeout(() => {
          if (!shouldRestartRef.current) return;
          if (recognitionRef.current !== recognition) return;
          try {
            recognition.start();
            setIsListening(true);
          } catch {
            // Browser won't let us restart the same instance; create fresh one
            recognitionRef.current = null;
            if (shouldRestartRef.current) startListening(useLang);
          }
        }, 200);
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
