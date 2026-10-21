// useVoice.js — Custom hook for Speech Recognition (STT)
// Uses browser-native Web Speech API. 100% free & offline compatible.

import { useState, useEffect, useRef, useCallback } from 'react';

const isSupported =
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

/** Detect whether text contains Urdu script characters */
export function containsUrdu(text) {
  return /[\u0600-\u06FF]/.test(text);
}

/**
 * useVoice — STT hook
 * @param {Object} options
 * @param {string} [options.lang='en-US'] — 'en-US' or 'ur-PK'
 * @param {function} [options.onCommand] — callback(command) for voice commands
 */
export function useVoice({ lang = 'en-US', onCommand } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const langRef = useRef(lang);
  langRef.current = lang;

  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    setError(null);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = langRef.current;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      let final = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        // Check for hands-free voice commands
        const lower = final.trim().toLowerCase();
        if (onCommandRef.current) {
          if (lower.includes('save') || lower.includes('محفوظ')) {
            onCommandRef.current('save');
            return;
          }
          if (lower.includes('clear') || lower.includes('صاف')) {
            onCommandRef.current('clear');
            return;
          }
          if (lower.includes('stop') || lower.includes('بند')) {
            onCommandRef.current('stop');
            stopListening();
            return;
          }
        }

        setTranscript((prev) => (prev ? `${prev} ${final.trim()}` : final.trim()));
        setInterimTranscript('');
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setError('Microphone permission denied. Please allow microphone access in browser settings.');
      } else if (event.error === 'network') {
        setError('Network unavailable for voice model. Android speech recognition works offline once downloaded.');
      } else if (event.error === 'no-speech') {
        setInterimTranscript('');
      } else {
        setError(`Speech recognition notice: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      setError(`Could not activate microphone: ${err.message}`);
    }
  }, [stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    error,
    isSupported,
  };
}
