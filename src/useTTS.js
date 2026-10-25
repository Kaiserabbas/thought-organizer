// useTTS.js — Text-to-Speech + Audio Export Hook
// Powered exclusively by Google Gemini Studio Voice (Charon spiritual male voice).

import { useState, useEffect, useRef, useCallback } from 'react';
import { generateSpiritualVoiceWav, triggerDownload } from './audioExporter';
import { getOrGenerateSpiritualSpeech, hasGeminiApiKey } from './geminiService';

const isSupported = typeof window !== 'undefined' && typeof Audio !== 'undefined';

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const audioRef = useRef(null);
  const currentBlobUrlRef = useRef(null);

  const stop = useCallback(() => {
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
    }
  }, [isPaused]);

  // Clean up playback on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch { /* ignore */ }
        audioRef.current = null;
      }
      if (currentBlobUrlRef.current) {
        try { URL.revokeObjectURL(currentBlobUrlRef.current); } catch { /* ignore */ }
      }
    };
  }, []);

  /**
   * Helper to play an audio Blob with HTML5 Audio element
   */
  const playAudioBlob = useCallback(
    async (blob, rate = 1.0, onEnd, onError) => {
      const blobUrl = URL.createObjectURL(blob);
      currentBlobUrlRef.current = blobUrl;

      const audio = new Audio(blobUrl);
      audioRef.current = audio;

      if (rate && rate !== 1.0) {
        audio.playbackRate = Math.min(2.0, Math.max(0.5, rate));
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
    },
    []
  );

  /**
   * speak(text, options)
   * Exclusively uses Google Gemini Studio Voice (Charon spiritual voice).
   */
  const speak = useCallback(
    async (text, options = {}) => {
      if (!text || !text.trim()) return;

      // Stop any active playback
      stop();

      const {
        rate = 0.85,
        wordCount = false,
        onEnd,
        onError,
      } = options;

      let spokenContent = text.trim();
      if (wordCount) {
        const count = spokenContent.split(/\s+/).filter(Boolean).length;
        spokenContent = `${count} words. ${spokenContent}`;
      }

      // Verify Google Gemini API key
      if (!hasGeminiApiKey()) {
        const err = new Error('Google Gemini API key is required for voice playback.');
        err.code = 'MISSING_GEMINI_KEY';
        if (onError) onError(err);
        return;
      }

      setIsLoadingAudio(true);
      try {
        const audioBlob = await getOrGenerateSpiritualSpeech(spokenContent, {
          voice: 'Charon',
        });
        await playAudioBlob(audioBlob, rate, onEnd, onError);
      } catch (err) {
        console.warn('Gemini Voice playback failed:', err);
        setIsLoadingAudio(false);
        if (onError) onError(err);
      }
    },
    [stop, playAudioBlob]
  );

  /**
   * exportAudio(text, langOrOptions, filename)
   * Generates a downloadable audio file (.wav) using Google Gemini Voice.
   */
  const exportAudio = useCallback(
    async (text, langOrOptions = 'en-US', filenameArg = 'thought') => {
      if (!text || !text.trim()) return { success: false, error: 'Empty text' };
      setIsExporting(true);

      const isOptObj = typeof langOrOptions === 'object' && langOrOptions !== null;
      const filename = isOptObj ? (langOrOptions.filename || filenameArg) : filenameArg;

      try {
        const cleanName = (filename || 'thought')
          .replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '_')
          .slice(0, 50);

        const wavBlob = await generateSpiritualVoiceWav(text);
        triggerDownload(wavBlob, `${cleanName}-gemini-voice.wav`);
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
    exportAudio,
    isSupported,
  };
}
