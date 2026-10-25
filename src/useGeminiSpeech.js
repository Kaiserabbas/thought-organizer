// useGeminiSpeech.js — Hook for Google Gemini Multimodal Speech-to-Text (STT)
// Transcribes spoken Urdu directly into authentic Urdu script (نستعلیق / حروفِ تہجی) and English.

import { useState, useRef, useCallback } from 'react';
import {
  transcribeAudioWithGemini,
  hasGeminiApiKey,
} from './geminiService';
import { containsUrdu, formatEnglishSentence } from './useVoice';

const isSupported =
  typeof window !== 'undefined' &&
  Boolean(navigator?.mediaDevices?.getUserMedia) &&
  typeof window.MediaRecorder !== 'undefined';

function getSupportedMimeType() {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/wav',
  ];
  for (const c of candidates) {
    if (window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return '';
}

/**
 * useGeminiSpeech
 *
 * @param {Object} options
 * @param {string} [options.lang='ur-PK'] - 'ur-PK' | 'en-US' | 'auto'
 * @param {function} [options.onTranscribed] - Callback when audio chunk is transcribed
 * @param {function} [options.onError] - Error callback
 */
export function useGeminiSpeech({ lang = 'ur-PK', onTranscribed, onError } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingStartTimeRef = useRef(0);
  const onTranscribedRef = useRef(onTranscribed);
  const onErrorRef = useRef(onError);
  const langRef = useRef(lang);

  onTranscribedRef.current = onTranscribed;
  onErrorRef.current = onError;
  langRef.current = lang;

  const cleanupStream = useCallback(() => {
    if (audioStreamRef.current) {
      try {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      audioStreamRef.current = null;
    }
  }, []);

  /**
   * Start microphone recording
   */
  const startRecording = useCallback(async () => {
    if (!isSupported) {
      const msg = 'MediaRecorder is not supported in this browser. Please use Chrome, Edge, or Android.';
      setError(msg);
      onErrorRef.current?.(msg);
      return false;
    }

    if (!hasGeminiApiKey()) {
      const msg = 'Google Gemini API key is missing. Please add your key in Settings.';
      setError(msg);
      onErrorRef.current?.(msg);
      return false;
    }

    setError(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      audioStreamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstart = () => {
        setIsRecording(true);
        recordingStartTimeRef.current = Date.now();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      return true;
    } catch (err) {
      let msg = `Microphone access error: ${err.message}`;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Microphone permission was denied. Please allow microphone access in browser.';
      }
      setError(msg);
      onErrorRef.current?.(msg);
      cleanupStream();
      setIsRecording(false);
      return false;
    }
  }, [cleanupStream]);

  /**
   * Stop microphone recording and transcribe with Google Gemini Multimodal Audio
   */
  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setIsRecording(false);
      cleanupStream();
      return '';
    }

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        setIsRecording(false);
        cleanupStream();

        const chunks = audioChunksRef.current;
        if (!chunks || chunks.length === 0) {
          resolve('');
          return;
        }

        const mime = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(chunks, { type: mime });

        // If recording was extremely short (< 400ms), ignore
        const duration = Date.now() - recordingStartTimeRef.current;
        if (duration < 400 || audioBlob.size < 500) {
          resolve('');
          return;
        }

        setIsTranscribing(true);
        setError(null);

        try {
          const rawText = await transcribeAudioWithGemini(audioBlob, langRef.current);

          let cleaned = (rawText || '').trim();
          if (cleaned) {
            const isUrdu = containsUrdu(cleaned) || langRef.current.startsWith('ur');
            const pausePunctuation = isUrdu ? '۔' : '.';
            const hasCustomPunctuation = /[؟?!.۔]$/.test(cleaned);

            if (!hasCustomPunctuation) {
              cleaned = `${cleaned}${pausePunctuation}`;
            }

            if (!isUrdu) {
              cleaned = formatEnglishSentence(cleaned);
            }

            setTranscription((prev) => (prev ? `${prev} ${cleaned}` : cleaned));
            onTranscribedRef.current?.(cleaned);
          }
          resolve(cleaned);
        } catch (err) {
          const msg = `Gemini Audio Transcription error: ${err.message}`;
          setError(msg);
          onErrorRef.current?.(msg);
          resolve('');
        } finally {
          setIsTranscribing(false);
        }
      };

      try {
        recorder.stop();
      } catch {
        setIsRecording(false);
        cleanupStream();
        resolve('');
      }
    });
  }, [cleanupStream]);

  /**
   * Transcribe an uploaded audio file using Gemini
   */
  const transcribeAudioFile = useCallback(async (file) => {
    if (!file) return '';
    setIsTranscribing(true);
    setError(null);

    try {
      const rawText = await transcribeAudioWithGemini(file, langRef.current);

      let cleaned = (rawText || '').trim();
      if (cleaned) {
        const isUrdu = containsUrdu(cleaned) || langRef.current.startsWith('ur');
        const pausePunctuation = isUrdu ? '۔' : '.';
        const hasCustomPunctuation = /[؟?!.۔]$/.test(cleaned);

        if (!hasCustomPunctuation) {
          cleaned = `${cleaned}${pausePunctuation}`;
        }

        if (!isUrdu) {
          cleaned = formatEnglishSentence(cleaned);
        }

        setTranscription((prev) => (prev ? `${prev} ${cleaned}` : cleaned));
        onTranscribedRef.current?.(cleaned);
      }
      return cleaned;
    } catch (err) {
      const msg = `Gemini Audio File error: ${err.message}`;
      setError(msg);
      onErrorRef.current?.(msg);
      return '';
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const resetTranscription = useCallback(() => {
    setTranscription('');
    setError(null);
  }, []);

  return {
    isRecording,
    isTranscribing,
    transcription,
    error,
    startRecording,
    stopRecording,
    transcribeAudioFile,
    resetTranscription,
    isSupported,
  };
}
