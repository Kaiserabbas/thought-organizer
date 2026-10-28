// VoicePanel.jsx — Bilingual Voice Input with Groq Whisper AI, Google Gemini & Microsoft Azure Speech
// Features:
// - Groq Whisper AI (whisper-large-v3-turbo & whisper-large-v3) for ultra-accurate Urdu Perso-Arabic script & bilingual code-switching
// - Google Gemini AI Multimodal Audio for authentic Urdu Nastaliq & English speech-to-text
// - Microsoft Azure Cognitive Speech (Neural STT for Urdu & English)
// - Direct voice recording + audio file upload
// - Zero audio collisions and clean state management

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Copy,
  Download,
  Mic,
  MicOff,
  Volume2,
  X,
  Zap,
  Loader2,
  Upload,
  Cloud,
  Sparkles,
} from 'lucide-react';
import { containsUrdu, formatEnglishSentence } from './useVoice';
import { useTTS } from './useTTS';
import { useGroqWhisper } from './useGroqWhisper';
import { hasGroqApiKey } from './groqService';
import { useGeminiSpeech } from './useGeminiSpeech';
import { hasGeminiApiKey } from './geminiService';
import { useAzureSpeech } from './useAzureSpeech';
import { hasAzureSpeechKey } from './azureSpeechService';

/**
 * VoicePanel
 * @param {function} props.onNewChunk         — called with each new spoken chunk
 * @param {function} props.onDraftComplete    — called with { subject, description }
 * @param {string}   props.lang               — 'en-US' | 'ur-PK' | 'auto'
 * @param {function} props.setLang            — setter for lang
 * @param {function} props.onRequireGeminiKey — trigger to open Gemini API key modal
 */
export default function VoicePanel({
  onNewChunk,
  onDraftComplete,
  lang = 'ur-PK',
  setLang,
  ttsRate = 0.85,
  ttsPitch = 0.68,
  voiceEngine = 'gemini',
  onRequireGeminiKey,
}) {
  const [isCollapsed,  setIsCollapsed]  = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [sttEngine, setSttEngine]       = useState(() => {
    if (hasGroqApiKey()) return 'groq';
    if (hasGeminiApiKey()) return 'gemini';
    if (hasAzureSpeechKey()) return 'azure';
    return 'groq';
  });
  const [currentLang, setCurrentLang]   = useState(lang || 'ur-PK');
  const [recordSeconds, setRecordSeconds] = useState(0);

  const canvasRef     = useRef(null);
  const animFrameRef  = useRef(null);
  const audioFileRef  = useRef(null);
  const timerIntervalRef = useRef(null);

  const { speak, isSpeaking, isLoadingAudio, exportAudio, isExporting } = useTTS();

  // ── Groq Whisper Engine (Primary AI) ───────────────────────────────
  const groqWhisper = useGroqWhisper({
    lang: currentLang === 'ur-PK' ? 'ur' : currentLang === 'en-US' ? 'en' : 'auto',
    onTranscribed: (text) => {
      if (onNewChunk) onNewChunk(text);
    },
  });

  // ── Google Gemini AI Speech Engine ─────────────────────────────────
  const geminiSpeech = useGeminiSpeech({
    lang: currentLang === 'ur-PK' ? 'ur-PK' : currentLang === 'en-US' ? 'en-US' : 'auto',
    onTranscribed: (text) => {
      if (onNewChunk) onNewChunk(text);
    },
  });

  // ── Microsoft Azure Speech Engine ──────────────────────────────────
  const azureSpeech = useAzureSpeech({
    lang: currentLang === 'ur-PK' || currentLang === 'auto' ? 'ur' : 'en',
    onTranscribed: (text) => {
      if (onNewChunk) onNewChunk(text);
    },
  });

  // Sync external lang prop → internal
  useEffect(() => {
    setCurrentLang(lang);
  }, [lang]);

  // Sync internal detected lang → external
  useEffect(() => {
    if (currentLang !== lang && setLang) {
      setLang(currentLang);
    }
  }, [currentLang, lang, setLang]);

  // ── Active Transcription State ─────────────────────────────────────
  const activeTranscript =
    sttEngine === 'groq'
      ? groqWhisper.transcription
      : sttEngine === 'gemini'
      ? geminiSpeech.transcription
      : azureSpeech.transcription;

  const isRecording =
    sttEngine === 'groq'
      ? groqWhisper.isRecording
      : sttEngine === 'gemini'
      ? geminiSpeech.isRecording
      : azureSpeech.isRecording;

  const isTranscribing =
    groqWhisper.isTranscribing || geminiSpeech.isTranscribing || azureSpeech.isTranscribing;

  const isBusy = isTranscribing || isRecording;

  // ── Elapsed recording timer ────────────────────────────────────────
  useEffect(() => {
    if (isRecording) {
      setRecordSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // ── Waveform Visualizer ────────────────────────────────────────────
  const startWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    let step = 0;
    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      step += 0.08;
      ctx.clearRect(0, 0, width, height);
      const bars = 26;
      const bw = width / bars;
      for (let i = 0; i < bars; i++) {
        const wave = Math.sin(step + i * 0.35) * 0.5 + 0.5;
        const wave2 = Math.cos(step * 0.7 + i * 0.5) * 0.3 + 0.3;
        const combined = Math.min(1, wave * 0.7 + wave2 * 0.3);
        const bh = Math.max(4, combined * (height - 6));
        ctx.fillStyle = '#125d01';
        ctx.globalAlpha = 0.35 + combined * 0.65;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(i * bw + 2, height - bh, bw - 4, bh, 2);
        } else {
          ctx.rect(i * bw + 2, height - bh, bw - 4, bh);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    draw();
  }, []);

  const stopWaveform = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  useEffect(() => {
    if (isRecording) {
      startWaveform();
    } else {
      stopWaveform();
    }
    return () => stopWaveform();
  }, [isRecording, startWaveform, stopWaveform]);

  // ── Start / Stop Mic Handlers ──────────────────────────────────────
  const handleStartListening = useCallback(async () => {
    if (sttEngine === 'groq') {
      await groqWhisper.startRecording();
    } else if (sttEngine === 'gemini') {
      await geminiSpeech.startRecording();
    } else {
      await azureSpeech.startRecording();
    }
  }, [sttEngine, groqWhisper, geminiSpeech, azureSpeech]);

  const handleStopListening = useCallback(async () => {
    if (sttEngine === 'groq') {
      await groqWhisper.stopRecording();
    } else if (sttEngine === 'gemini') {
      await geminiSpeech.stopRecording();
    } else {
      await azureSpeech.stopRecording();
    }
  }, [sttEngine, groqWhisper, geminiSpeech, azureSpeech]);

  const resetTranscript = useCallback(() => {
    groqWhisper.resetTranscription();
    geminiSpeech.resetTranscription();
    azureSpeech.resetTranscription();
  }, [groqWhisper, geminiSpeech, azureSpeech]);

  // ── File Upload Handler ────────────────────────────────────────────
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (sttEngine === 'azure') {
      await azureSpeech.transcribeAudioFile(file);
    } else if (sttEngine === 'gemini') {
      await geminiSpeech.transcribeAudioFile(file);
    } else {
      await groqWhisper.transcribeAudioFile(file);
    }
    if (audioFileRef.current) audioFileRef.current.value = '';
  };

  // ── Auto-fill Draft ────────────────────────────────────────────────
  const handleDraftFill = () => {
    const textToFill = activeTranscript.trim();
    if (!textToFill || !onDraftComplete) return;

    const isUrdu = containsUrdu(textToFill) || currentLang === 'ur-PK';
    const separator = isUrdu ? '۔ ' : '. ';
    const endPunctuation = isUrdu ? '۔' : '.';
    const lines = textToFill.split(/[.!?۔\n]+/).filter(Boolean);
    const subjectRaw = lines[0]?.trim() || '';
    let subject = subjectRaw.replace(/[.۔!?؟\s]+$/, '');
    let description = lines.slice(1).join(separator).trim() || subject;
    if (description && !/[.۔!?؟]$/.test(description)) {
      description += endPunctuation;
    }

    if (!isUrdu) {
      subject = formatEnglishSentence(subject);
      description = formatEnglishSentence(description);
    }

    onDraftComplete({ subject, description });
    resetTranscript();
  };

  // ── Copy ───────────────────────────────────────────────────────────
  const handleCopy = () => {
    if (!activeTranscript) return;
    navigator.clipboard?.writeText(activeTranscript);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 1500);
  };

  // ── Listen in Voice ────────────────────────────────────────────────
  const handleSpeak = () => {
    if (!activeTranscript) return;
    speak(activeTranscript, {
      lang: currentLang === 'auto' ? (containsUrdu(activeTranscript) ? 'ur-PK' : 'en-US') : currentLang,
      rate: ttsRate,
      pitch: ttsPitch,
      engine: voiceEngine,
      onError: (err) => {
        if (err?.code === 'MISSING_GEMINI_KEY' && onRequireGeminiKey) {
          onRequireGeminiKey();
        }
      },
    });
  };

  // ── Export Audio (.mp3 / .wav) ─────────────────────────────────────
  const handleExportAudio = async () => {
    if (!activeTranscript) return;
    const targetLang = currentLang === 'auto' ? (containsUrdu(activeTranscript) ? 'ur-PK' : 'en-US') : currentLang;
    const res = await exportAudio(activeTranscript, {
      lang: targetLang,
      engine: voiceEngine,
      filename: 'voice-thought',
    });
    if (res && res.code === 'MISSING_GEMINI_KEY') {
      if (onRequireGeminiKey) onRequireGeminiKey();
    }
  };

  const isUrdu = currentLang === 'ur-PK' || containsUrdu(activeTranscript);
  const activeError = groqWhisper.error || geminiSpeech.error || azureSpeech.error;

  return (
    <div className={`voice-panel ${isCollapsed ? 'voice-panel-collapsed' : ''}`}>
      {/* Header */}
      <div className="voice-panel-header">
        <div className="voice-panel-title">
          <Mic size={16} />
          <span>Voice Thought Input</span>
          {isRecording && <span className="voice-live-badge recording">● RECORDING ({formatTimer(recordSeconds)})</span>}
          {isTranscribing && <span className="voice-live-badge transcribing">⚡ TRANSCRIBING...</span>}
        </div>
        <div className="voice-header-right">
          <button
            type="button"
            className="voice-collapse-btn"
            onClick={() => setIsCollapsed((v) => !v)}
            title={isCollapsed ? 'Show voice panel' : 'Hide voice panel'}
          >
            {isCollapsed ? '▼ Show Voice' : '▲ Hide'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="voice-panel-body">
          {/* Speech Engine Selector */}
          <div className="voice-engine-section">
            <div className="voice-section-header voice-engine-header">
              <span className="voice-section-label">Speech Engine:</span>
              <div className="engine-circles-group" role="radiogroup" aria-label="Speech Engine">
                {/* Azure */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={sttEngine === 'azure'}
                  className={`engine-circle-btn ${sttEngine === 'azure' ? 'active azure' : ''}`}
                  onClick={() => setSttEngine('azure')}
                  title="Azure Speech"
                  aria-label="Azure Speech"
                >
                  <Cloud size={16} />
                  <span className="circle-label">Azure</span>
                </button>

                {/* Gemini */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={sttEngine === 'gemini'}
                  className={`engine-circle-btn ${sttEngine === 'gemini' ? 'active gemini' : ''}`}
                  onClick={() => setSttEngine('gemini')}
                  title="Google Gemini"
                  aria-label="Google Gemini"
                >
                  <Sparkles size={16} />
                  <span className="circle-label">Gemini</span>
                </button>

                {/* Groq */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={sttEngine === 'groq'}
                  className={`engine-circle-btn ${sttEngine === 'groq' ? 'active groq' : ''}`}
                  onClick={() => setSttEngine('groq')}
                  title="Groq Whisper"
                  aria-label="Groq Whisper"
                >
                  <Zap size={16} />
                  <span className="circle-label">Groq</span>
                </button>
              </div>
            </div>
          </div>

          {/* Spoken Language Selector */}
          <div className="voice-lang-section">
            <div className="voice-section-header">
              <span className="voice-section-label">Spoken Language:</span>
              {sttEngine === 'groq' && (
                <div className="voice-model-pill-group">
                  <button
                    type="button"
                    className={`model-sub-pill ${groqWhisper.whisperModel === 'whisper-large-v3-turbo' ? 'active' : ''}`}
                    onClick={() => groqWhisper.setWhisperModel('whisper-large-v3-turbo')}
                    title="200ms ultra-fast Whisper Large Turbo"
                  >
                    ⚡ Turbo v3
                  </button>
                  <button
                    type="button"
                    className={`model-sub-pill ${groqWhisper.whisperModel === 'whisper-large-v3' ? 'active' : ''}`}
                    onClick={() => groqWhisper.setWhisperModel('whisper-large-v3')}
                    title="Whisper Large v3 (maximum nuance)"
                  >
                    🎯 Large v3
                  </button>
                </div>
              )}
            </div>

            <div className="voice-lang-segmented-bar" role="radiogroup" aria-label="Spoken Language">
              <button
                type="button"
                className={`lang-segment-btn ${currentLang === 'ur-PK' ? 'active' : ''}`}
                onClick={() => { setCurrentLang('ur-PK'); if (setLang) setLang('ur-PK'); }}
              >
                <span className="lang-flag">🇵🇰</span>
                <span className="lang-name">اردو Urdu</span>
              </button>
              <button
                type="button"
                className={`lang-segment-btn ${currentLang === 'auto' ? 'active' : ''}`}
                onClick={() => { setCurrentLang('auto'); if (setLang) setLang('auto'); }}
                title="Speak mixed Urdu and English (code-switched)"
              >
                <span className="lang-flag">🌐</span>
                <span className="lang-name">مخلوط Bilingual</span>
              </button>
              <button
                type="button"
                className={`lang-segment-btn ${currentLang === 'en-US' ? 'active' : ''}`}
                onClick={() => { setCurrentLang('en-US'); if (setLang) setLang('en-US'); }}
              >
                <span className="lang-flag">🇬🇧</span>
                <span className="lang-name">English</span>
              </button>
            </div>
          </div>

          {/* Mic Button + Info */}
          <div className="voice-mic-container">
            <button
              type="button"
              className={`voice-mic-btn ${isRecording ? 'active recording' : ''} ${isTranscribing ? 'transcribing' : ''}`}
              onClick={isRecording ? handleStopListening : handleStartListening}
              disabled={isTranscribing}
              aria-label={isRecording ? 'Stop recording & transcribe' : 'Start speaking'}
              title={isRecording ? 'Click to finish speaking & transcribe' : 'Click mic to speak'}
            >
              {isTranscribing ? (
                <Loader2 size={24} className="spin-icon" />
              ) : isRecording ? (
                <MicOff size={24} />
              ) : (
                <Mic size={24} />
              )}
            </button>

            <div className="voice-mic-info">
              <strong>
                {isRecording
                  ? (currentLang === 'ur-PK'
                      ? `🔴 بولیں... (${formatTimer(recordSeconds)})`
                      : `🔴 Recording (${formatTimer(recordSeconds)})`)
                  : isTranscribing
                  ? 'Transcribing...'
                  : (currentLang === 'ur-PK'
                      ? 'بولنے کے لیے مائیک دبائیں'
                      : 'Tap to speak')}
              </strong>
            </div>

            {/* Upload audio file button */}
            {(sttEngine === 'groq' || sttEngine === 'gemini' || sttEngine === 'azure') && (
              <div className="voice-upload-action">
                <input
                  type="file"
                  ref={audioFileRef}
                  accept="audio/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="voice-upload-file-btn"
                  onClick={() => audioFileRef.current?.click()}
                  disabled={isBusy}
                  title="Upload audio note (.m4a, .mp3, .wav, .webm)"
                  aria-label="Upload audio note"
                >
                  <Upload size={14} />
                  <span>Upload Audio</span>
                </button>
              </div>
            )}
          </div>

          {/* Live Audio Waveform Canvas */}
          <div className={`waveform-wrapper ${isRecording ? 'active' : ''}`}>
            <canvas ref={canvasRef} className="waveform-canvas" width={400} height={44} aria-hidden="true" />
          </div>

          {/* Transcript Preview */}
          <div
            className={`transcript-box ${isRecording ? 'active' : ''} ${isTranscribing ? 'loading' : ''}`}
            dir={isUrdu ? 'rtl' : 'ltr'}
            lang={isUrdu ? 'ur' : 'en'}
          >
            {isTranscribing ? (
              <div className="transcript-loading-row">
                <Loader2 size={16} className="spin-icon" />
                <span>
                  Transcribing with{' '}
                  {sttEngine === 'azure'
                    ? 'Azure'
                    : sttEngine === 'gemini'
                    ? 'Gemini'
                    : 'Groq'}
                  ...
                </span>
              </div>
            ) : activeTranscript ? (
              <span className="transcript-final">{activeTranscript}</span>
            ) : isRecording ? (
              <span className="transcript-placeholder">
                {isUrdu ? 'سن رہا ہوں...' : 'Listening...'}
              </span>
            ) : null}
          </div>

          {/* Error */}
          {activeError && (
            <div className="voice-error-msg" role="alert">⚠️ {activeError}</div>
          )}

          {/* Action Bar (shows when there is transcript) */}
          {activeTranscript && (
            <div className="voice-actions-toolbar">
              <button
                type="button"
                className="voice-action-btn voice-draft-btn"
                onClick={handleDraftFill}
                title="Auto-fill Post"
                aria-label="Auto-fill Post"
              >
                <Zap size={14} />
              </button>

              <button
                type="button"
                className="voice-action-btn"
                onClick={handleSpeak}
                disabled={isSpeaking || isLoadingAudio}
                title="Listen back"
                aria-label="Listen back"
              >
                {isLoadingAudio ? <Loader2 size={14} className="spin-icon" /> : <Volume2 size={14} />}
              </button>

              <button
                type="button"
                className="voice-action-btn voice-export-btn"
                onClick={handleExportAudio}
                disabled={isExporting}
                title="Export audio file"
                aria-label="Export audio file"
              >
                <Download size={14} />
              </button>

              <button
                type="button"
                className="voice-action-btn"
                onClick={handleCopy}
                title={copyFeedback ? 'Copied!' : 'Copy transcript'}
                aria-label="Copy transcript"
              >
                <Copy size={14} />
              </button>

              <button
                type="button"
                className="voice-action-btn voice-clear-btn"
                onClick={resetTranscript}
                title="Clear transcript"
                aria-label="Clear transcript"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
