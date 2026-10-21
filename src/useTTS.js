// useTTS.js — Text-to-Speech + Audio Export Hook
// Uses browser-native Web Speech API + Web Audio API. 100% free & offline.

import { useState, useEffect, useRef, useCallback } from 'react';
import { generateSpiritualVoiceWav, triggerDownload } from './audioExporter';

const isSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Pick a preferred deep, heavy, spiritual male voice */
export function pickDeepMaleVoice(voices, lang) {
  if (!voices || voices.length === 0) return null;

  const isUrdu = lang === 'ur-PK' || (typeof lang === 'string' && lang.startsWith('ur'));

  // If Urdu is requested, look for Urdu or Arabic native voices first
  if (isUrdu) {
    const urduVoice = voices.find(
      (v) => v.lang.startsWith('ur') || v.lang.includes('Urdu')
    );
    if (urduVoice) return urduVoice;

    const arabicVoice = voices.find(
      (v) => v.lang.startsWith('ar') || v.lang.includes('Arabic')
    );
    if (arabicVoice) return arabicVoice;
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
  const [isExporting, setIsExporting] = useState(false);
  const [voices, setVoices] = useState([]);
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const utteranceRef = useRef(null);

  // Load voices asynchronously
  useEffect(() => {
    if (!isSupported) return;
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
    if (!isSupported || !synthRef.current) return;
    synthRef.current.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    utteranceRef.current = null;
  }, []);

  const pause = useCallback(() => {
    if (!isSupported || !synthRef.current || !isSpeaking) return;
    synthRef.current.pause();
    setIsPaused(true);
  }, [isSpeaking]);

  const resume = useCallback(() => {
    if (!isSupported || !synthRef.current || !isPaused) return;
    synthRef.current.resume();
    setIsPaused(false);
  }, [isPaused]);

  /**
   * speak(text, options)
   * Plays the text with deep, heavy, spiritual male characteristics
   */
  const speak = useCallback(
    (text, options = {}) => {
      if (!isSupported || !synthRef.current || !text) return;

      const synth = synthRef.current;
      synth.cancel();

      const {
        lang = 'en-US',
        rate = 0.82,     // Calmer, spiritual cadence
        pitch = 0.68,    // Deep, heavy baritone
        wordCount = false,
        onEnd,
      } = options;

      const currentVoices = synth.getVoices().length ? synth.getVoices() : voices;
      const voice = pickDeepMaleVoice(currentVoices, lang);

      let spokenContent = text;
      if (wordCount) {
        const count = text.trim().split(/\s+/).filter(Boolean).length;
        spokenContent = `${count} words. ${text}`;
      }

      const utterance = new SpeechSynthesisUtterance(spokenContent);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = 1;
      if (voice) utterance.voice = voice;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        utteranceRef.current = null;
        if (onEnd) onEnd();
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        utteranceRef.current = null;
      };

      utteranceRef.current = utterance;
      synth.speak(utterance);
    },
    [voices]
  );

  /**
   * exportAudio(text, lang, filename)
   * Generates a downloadable .wav audio file using deep male acoustic resonance.
   */
  const exportAudio = useCallback(
    async (text, lang = 'en-US', filename = 'thought') => {
      if (!text || !text.trim()) return false;
      setIsExporting(true);

      try {
        const cleanName = (filename || 'thought')
          .replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '_')
          .slice(0, 40);

        // Generate heavy spiritual male voice WAV via Web Audio API
        const wavBlob = await generateSpiritualVoiceWav(text, { speed: 0.85, pitch: 105 });
        triggerDownload(wavBlob, `${cleanName}-spiritual-voice.wav`);
        return true;
      } catch (err) {
        console.error('Audio export error:', err);
        return false;
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
    isExporting,
    voices,
    exportAudio,
    isSupported,
  };
}
