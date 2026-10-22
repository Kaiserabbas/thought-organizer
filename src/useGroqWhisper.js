// useGroqWhisper.js — Hook for Ultra-Fast Urdu & English Voice Typing via Groq Whisper API
// Models: whisper-large-v3-turbo (200ms) & whisper-large-v3 (nuanced)
// Accurately transcribes Urdu in authentic Perso-Arabic / Nastaʿlīq script and handles bilingual code-switching.

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  transcribeAudioWithGroq,
  getGroqApiKey,
  getGroqWhisperModel,
  setGroqWhisperModel as saveGroqWhisperModel,
} from './groqService';
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
 * useGroqWhisper
 *
 * @param {Object} options
 * @param {string} [options.lang='ur'] - 'ur' | 'en' | 'auto'
 * @param {function} [options.onTranscribed] - Callback when audio chunk/recording is transcribed
 * @param {function} [options.onError] - Error callback
 */
export function useGroqWhisper({ lang = 'ur', onTranscribed, onError } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState(null);
  const [whisperModel, setWhisperModel] = useState(() => getGroqWhisperModel());

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

  const updateModel = useCallback((newModel) => {
    setWhisperModel(newModel);
    saveGroqWhisperModel(newModel);
  }, []);

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

    const apiKey = getGroqApiKey();
    if (!apiKey) {
      const msg = 'Groq API Key is missing. Please configure it in Settings.';
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
      recorder.start(250); // collect in 250ms chunks
      return true;
    } catch (err) {
      let msg = `Microphone access error: ${err.message}`;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Microphone permission was denied. Please allow microphone in browser settings.';
      }
      setError(msg);
      onErrorRef.current?.(msg);
      cleanupStream();
      setIsRecording(false);
      return false;
    }
  }, [cleanupStream]);

  /**
   * Stop microphone recording and transcribe with Groq Whisper
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

        // If recording was extremely short (< 400ms), ignore as accidental tap
        const duration = Date.now() - recordingStartTimeRef.current;
        if (duration < 400 || audioBlob.size < 500) {
          resolve('');
          return;
        }

        setIsTranscribing(true);
        setError(null);

        try {
          const rawText = await transcribeAudioWithGroq(audioBlob, {
            lang: langRef.current,
            model: whisperModel,
          });

          let cleaned = (rawText || '').trim();
          if (cleaned) {
            const isUrdu = containsUrdu(cleaned) || langRef.current === 'ur' || langRef.current === 'ur-PK';
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
          const msg = `Transcription error: ${err.message}`;
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
  }, [cleanupStream, whisperModel]);

  /**
   * Transcribe an uploaded audio file (e.g. .m4a, .mp3, .wav, .ogg, .webm)
   */
  const transcribeAudioFile = useCallback(
    async (file) => {
      if (!file) return '';
      setIsTranscribing(true);
      setError(null);

      try {
        const rawText = await transcribeAudioWithGroq(file, {
          lang: langRef.current,
          model: whisperModel,
        });

        let cleaned = (rawText || '').trim();
        if (cleaned) {
          const isUrdu = containsUrdu(cleaned) || langRef.current === 'ur' || langRef.current === 'ur-PK';
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
        const msg = `Audio file transcription error: ${err.message}`;
        setError(msg);
        onErrorRef.current?.(msg);
        return '';
      } finally {
        setIsTranscribing(false);
      }
    },
    [whisperModel]
  );

  const resetTranscription = useCallback(() => {
    setTranscription('');
    setError(null);
  }, []);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      cleanupStream();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [cleanupStream]);

  return {
    isRecording,
    isTranscribing,
    transcription,
    setTranscription,
    resetTranscription,
    startRecording,
    stopRecording,
    transcribeAudioFile,
    error,
    whisperModel,
    setWhisperModel: updateModel,
    isSupported,
  };
}
