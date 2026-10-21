// useTTS.js — Text-to-Speech + Audio Export Hook
// Uses Gemini 3.8 Flash TTS for authentic spiritual male voice when API key is present.
// Automatically falls back to browser-native Web Speech API + Web Audio API. 100% free.

import { useState, useEffect, useRef, useCallback } from 'react';
import { generateSpiritualVoiceWav, triggerDownload } from './audioExporter';
import { getOrGenerateSpiritualSpeech, hasGeminiApiKey } from './geminiService';
import { containsUrdu } from './useVoice';

const isSupported =
  typeof window !== 'undefined' && ('speechSynthesis' in window || typeof Audio !== 'undefined');

/** Pick a preferred deep, heavy, spiritual male voice */
export function pickDeepMaleVoice(voices, lang) {
  if (!voices || voices.length === 0) return null;

  const isUrdu = lang === 'ur-PK' || (typeof lang === 'string' && lang.startsWith('ur'));

  // If Urdu is requested, look ONLY for genuine Urdu voices — NEVER Arabic!
  // Arabic speech synthesis ruins Urdu pronunciation with foreign accent.
  if (isUrdu) {
    const urduVoice = voices.find(
      (v) =>
        v.lang.startsWith('ur') ||
        v.lang.toLowerCase().includes('urdu') ||
        v.name.toLowerCase().includes('urdu')
    );
    if (urduVoice) return urduVoice;
  }

  // Preferred deep male English voices across Windows, Chrome, Android, macOS
  const PREFERRED_MALE = [
    'Microsoft David',
    'Microsoft Mark',
    'Microsoft George',
    'Google UK English Male',
    'Google US English',
    'Daniel',
    'Oliver',
    'Guy',
    'en-GB',
    'en-US',
  ];

  for (const name of PREFERRED_MALE) {
    const found = voices.find(
      (v) =>
        (v.name.includes(name) || v.lang === name) &&
        !v.name.toLowerCase().includes('female') &&
        !v.name.toLowerCase().includes('zira')
    );
    if (found) return found;
  }

  // Any English voice that doesn't say female
  const maleLike = voices.find(
    (v) =>
      v.lang.startsWith('en') &&
      !v.name.toLowerCase().includes('female') &&
      !v.name.toLowerCase().includes('zira') &&
      !v.name.toLowerCase().includes('susan')
  );
  if (maleLike) return maleLike;

  return voices.find((v) => v.lang.startsWith('en')) || voices[0];
}

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [voices, setVoices] = useState([]);

  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const utteranceRef = useRef(null);
  const audioRef = useRef(null);
  const currentBlobUrlRef = useRef(null);

  // Load voices asynchronously for offline browser fallback
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const synth = synthRef.current;
    if (!synth) return;

    const updateVoices = () => {
      const available = synth.getVoices();
      if (available && available.length) {
        setVoices(available);
      }
    };

    updateVoices();
    synth.onvoiceschanged = updateVoices;

    return () => {
      if (synth) synth.onvoiceschanged = null;
    };
  }, []);

  const stop = useCallback(() => {
    // 1. Stop HTML5 audio (Gemini TTS)
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    }

    if (currentBlobUrlRef.current) {
      try {
        URL.revokeObjectURL(currentBlobUrlRef.current);
      } catch {
        /* ignore */
      }
      currentBlobUrlRef.current = null;
    }

    // 2. Stop browser speechSynthesis
    if (synthRef.current) {
      try {
        synthRef.current.cancel();
      } catch {
        /* ignore */
      }
      utteranceRef.current = null;
    }

    setIsSpeaking(false);
    setIsPaused(false);
    setIsLoadingAudio(false);
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current && isSpeaking) {
      try {
        audioRef.current.pause();
      } catch {
        /* ignore */
      }
      setIsPaused(true);
      return;
    }

    if (synthRef.current && isSpeaking) {
      try {
        synthRef.current.pause();
      } catch {
        /* ignore */
      }
      setIsPaused(true);
    }
  }, [isSpeaking]);

  const resume = useCallback(() => {
    if (audioRef.current && isPaused) {
      try {
        audioRef.current.play();
      } catch {
        /* ignore */
      }
      setIsPaused(false);
      return;
    }

    if (synthRef.current && isPaused) {
      try {
        synthRef.current.resume();
      } catch {
        /* ignore */
      }
      setIsPaused(false);
    }
  }, [isPaused]);

  // Clean up playback on unmount
  useEffect(() => {
    const synth = synthRef.current;
    return () => {
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch { /* ignore */ }
        audioRef.current = null;
      }
      if (currentBlobUrlRef.current) {
        try { URL.revokeObjectURL(currentBlobUrlRef.current); } catch { /* ignore */ }
      }
      if (synth) {
        try { synth.cancel(); } catch { /* ignore */ }
      }
    };
  }, []);

  /**
   * speak(text, options)
   * Uses Gemini 3.8 Flash TTS for heavy spiritual male voice when API key is present.
   * Seamlessly falls back to deep male browser voice if offline or no key.
   */
  const speak = useCallback(
    async (text, options = {}) => {
      if (!text || !text.trim()) return;

      // Stop any current playback
      stop();

      const {
        lang = 'en-US',
        rate = 0.85,
        pitch = 0.68,
        wordCount = false,
        useGemini = true,
        onEnd,
        onError,
      } = options;

      let spokenContent = text.trim();
      if (wordCount) {
        const count = spokenContent.split(/\s+/).filter(Boolean).length;
        spokenContent = `${count} words. ${spokenContent}`;
      }

      const isUrduText =
        containsUrdu(spokenContent) ||
        lang === 'ur-PK' ||
        (typeof lang === 'string' && lang.startsWith('ur'));

      // Use Gemini TTS when:
      // 1. Gemini API key is available and useGemini is enabled (Default)
      // 2. OR text is Urdu and Gemini API key is available (authentic Urdu speech)
      const shouldTryGemini = hasGeminiApiKey() && (useGemini || isUrduText);

      // ── Option A: Gemini 3.8 Flash TTS (Real Human Spiritual Male Voice) ──
      if (shouldTryGemini) {
        setIsLoadingAudio(true);
        try {
          const audioBlob = await getOrGenerateSpiritualSpeech(spokenContent, {
            voice: 'Charon', // Heavy, resonant spiritual male baritone
          });

          const blobUrl = URL.createObjectURL(audioBlob);
          currentBlobUrlRef.current = blobUrl;

          const audio = new Audio(blobUrl);
          audioRef.current = audio;

          // Apply slight rate scaling if specified
          if (rate && rate !== 1.0) {
            audio.playbackRate = Math.min(2.0, Math.max(0.6, rate));
          }

          audio.onplay = () => {
            setIsSpeaking(true);
            setIsPaused(false);
            setIsLoadingAudio(false);
          };

          audio.onended = () => {
            setIsSpeaking(false);
            setIsPaused(false);
            setIsLoadingAudio(false);
            audioRef.current = null;
            if (currentBlobUrlRef.current) {
              URL.revokeObjectURL(currentBlobUrlRef.current);
              currentBlobUrlRef.current = null;
            }
            if (onEnd) onEnd();
          };

          audio.onerror = (e) => {
            console.warn('Audio element error:', e);
            setIsSpeaking(false);
            setIsPaused(false);
            setIsLoadingAudio(false);
            audioRef.current = null;
            if (onError) onError(e);
          };

          await audio.play();
          return;
        } catch (err) {
          console.warn('Gemini TTS playback failed, falling back to browser speech:', err);
          setIsLoadingAudio(false);
          // Fall through to browser SpeechSynthesis
        }
      }

      // ── Option B: Browser SpeechSynthesis Fallback ──
      if (!synthRef.current) {
        if (onError) onError(new Error('Speech synthesis not available'));
        return;
      }

      const synth = synthRef.current;
      synth.cancel();

      const currentVoices = synth.getVoices().length ? synth.getVoices() : voices;
      const voice = pickDeepMaleVoice(currentVoices, lang);

      const utterance = new SpeechSynthesisUtterance(spokenContent);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = 1;
      if (voice) utterance.voice = voice;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
        setIsLoadingAudio(false);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setIsLoadingAudio(false);
        utteranceRef.current = null;
        if (onEnd) onEnd();
      };

      utterance.onerror = (e) => {
        setIsSpeaking(false);
        setIsPaused(false);
        setIsLoadingAudio(false);
        utteranceRef.current = null;
        if (onError) onError(e);
      };

      utteranceRef.current = utterance;
      synth.speak(utterance);
    },
    [voices, stop]
  );

  /**
   * exportAudio(text, langOrOptions, filename)
   * Generates a downloadable .wav audio file in heavy spiritual male voice.
   */
  const exportAudio = useCallback(
    async (text, langOrOptions = 'en-US', filenameArg = 'thought') => {
      if (!text || !text.trim()) return { success: false, error: 'Empty text' };
      setIsExporting(true);

      const filename =
        typeof langOrOptions === 'object'
          ? (langOrOptions.filename || filenameArg)
          : filenameArg;

      try {
        const cleanName = (filename || 'thought')
          .replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '_')
          .slice(0, 50);

        const wavBlob = await generateSpiritualVoiceWav(text);
        triggerDownload(wavBlob, `${cleanName}-spiritual-voice.wav`);
        return { success: true };
      } catch (err) {
        console.error('Audio export error:', err);
        return { success: false, error: err.message, code: err.code };
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    isPaused,
    isLoadingAudio,
    isExporting,
    voices,
    exportAudio,
    isSupported,
  };
}
