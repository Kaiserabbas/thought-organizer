// VoicePanel.jsx — Bilingual Voice Input with Groq Whisper AI & Microsoft Azure Speech
// Features:
// - Groq Whisper AI (whisper-large-v3-turbo & whisper-large-v3) for ultra-accurate Urdu Perso-Arabic script & bilingual code-switching
// - Microsoft Azure Cognitive Speech (Neural STT for Urdu & English)
// - Local Web Speech API fallback
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
  Radio,
  Cloud,
} from 'lucide-react';
import { useVoice, containsUrdu, formatEnglishSentence } from './useVoice';
import { useTTS } from './useTTS';
import { useGroqWhisper } from './useGroqWhisper';
import { hasGroqApiKey } from './groqService';
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
  voiceEngine = 'azure',
  onRequireGeminiKey,
}) {
  const [isCollapsed,  setIsCollapsed]  = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [sttEngine, setSttEngine]       = useState(() => {
    if (hasGroqApiKey()) return 'groq';
    if (hasAzureSpeechKey()) return 'azure';
    return 'webspeech';
  });
  const [recordSeconds, setRecordSeconds] = useState(0);

  const canvasRef     = useRef(null);
  const animFrameRef  = useRef(null);
  const audioFileRef  = useRef(null);
  const timerIntervalRef = useRef(null);

  const { speak, isSpeaking, isLoadingAudio, exportAudio, isExporting } = useTTS();

  // ── Web Speech API Engine (Fallback) ───────────────────────────────
  const handleCommand = useCallback((command) => {
    if (command === 'clear') { resetTranscript(); }
    if (command === 'stop')  { handleStopListening(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    isListening: isWebSpeechListening,
    transcript: webSpeechTranscript,
    interimTranscript,
    currentLang,
    setCurrentLang,
    startListening: startWebSpeech,
    stopListening: stopWebSpeech,
    resetTranscript: resetWebSpeechTranscript,
    error: webSpeechError,
  } = useVoice({
    lang,
    onNewChunk: (chunk) => {
      if (sttEngine === 'webspeech' && onNewChunk) {
        onNewChunk(chunk);
      }
    },
    onCommand: handleCommand,
  });

  // ── Groq Whisper Engine (Primary AI) ───────────────────────────────
  const groqWhisper = useGroqWhisper({
    lang: currentLang === 'ur-PK' ? 'ur' : currentLang === 'en-US' ? 'en' : 'auto',
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
  }, [lang, setCurrentLang]);

  // Sync internal detected lang → external
  useEffect(() => {
    if (currentLang !== lang && setLang) {
      setLang(currentLang);
    }
  }, [currentLang, lang, setLang]);

  // ── Active Transcription State ─────────────────────────────────────
  const activeTranscript =
    sttEngine === 'groq'
      ? groqWhisper.transcription || webSpeechTranscript
      : sttEngine === 'azure'
      ? azureSpeech.transcription || webSpeechTranscript
      : webSpeechTranscript;

  const isRecording =
    sttEngine === 'groq'
      ? groqWhisper.isRecording
      : sttEngine === 'azure'
      ? azureSpeech.isRecording
      : isWebSpeechListening;

  const isTranscribing =
    groqWhisper.isTranscribing || azureSpeech.isTranscribing;

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
    } else if (sttEngine === 'azure') {
      await azureSpeech.startRecording();
    } else {
      startWebSpeech();
    }
  }, [sttEngine, groqWhisper, azureSpeech, startWebSpeech]);

  const handleStopListening = useCallback(async () => {
    if (sttEngine === 'groq') {
      await groqWhisper.stopRecording();
    } else if (sttEngine === 'azure') {
      await azureSpeech.stopRecording();
    } else {
      stopWebSpeech();
    }
  }, [sttEngine, groqWhisper, azureSpeech, stopWebSpeech]);

  const resetTranscript = useCallback(() => {
    groqWhisper.resetTranscription();
    azureSpeech.resetTranscription();
    resetWebSpeechTranscript();
  }, [groqWhisper, azureSpeech, resetWebSpeechTranscript]);

  // ── File Upload Handler ────────────────────────────────────────────
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (sttEngine === 'azure') {
      await azureSpeech.transcribeAudioFile(file);
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

  const isUrdu = currentLang === 'ur-PK' || containsUrdu(activeTranscript + interimTranscript);
  const activeError = groqWhisper.error || azureSpeech.error || webSpeechError;

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
          {/* Engine Selector Row */}
          <div className="voice-engine-row">
            <span className="voice-lang-label">Speech Engine:</span>
            <div className="voice-engine-pills" role="radiogroup" aria-label="Speech Engine">
              <button
                type="button"
                className={`engine-pill ${sttEngine === 'groq' ? 'active' : ''}`}
                onClick={() => setSttEngine('groq')}
                title="Groq Whisper: ultra-fast (200ms) authentic Urdu Perso-Arabic script & code-switching"
              >
                <Zap size={13} />
                <span>Groq Whisper AI</span>
                <span className="pill-badge">Recommended</span>
              </button>

              <button
                type="button"
                className={`engine-pill ${sttEngine === 'azure' ? 'active' : ''}`}
                onClick={() => setSttEngine('azure')}
                title="Microsoft Azure Speech: neural cloud STT for Urdu & English"
              >
                <Cloud size={13} />
                <span>Azure Speech</span>
                <span className="pill-badge azure">eastus</span>
              </button>

              <button
                type="button"
                className={`engine-pill ${sttEngine === 'webspeech' ? 'active' : ''}`}
                onClick={() => setSttEngine('webspeech')}
                title="Browser Web Speech API: local dictation fallback"
              >
                <Radio size={13} />
                <span>Web Speech</span>
              </button>
            </div>
          </div>

          {/* Language Selector */}
          <div className="voice-lang-row">
            <span className="voice-lang-label">Language:</span>
            <div className="voice-lang-toggle" role="radiogroup">
              <button
                type="button"
                className={`lang-pill ${currentLang === 'ur-PK' ? 'active' : ''}`}
                onClick={() => { setCurrentLang('ur-PK'); if (setLang) setLang('ur-PK'); }}
              >
                🇵🇰 اردو Urdu
              </button>
              <button
                type="button"
                className={`lang-pill ${currentLang === 'auto' ? 'active' : ''}`}
                onClick={() => { setCurrentLang('auto'); if (setLang) setLang('auto'); }}
                title="Speak mixed Urdu and English (code-switched)"
              >
                🌐 مخلوط Bilingual
              </button>
              <button
                type="button"
                className={`lang-pill ${currentLang === 'en-US' ? 'active' : ''}`}
                onClick={() => { setCurrentLang('en-US'); if (setLang) setLang('en-US'); }}
              >
                🇬🇧 English
              </button>
            </div>

            {/* Model Pill (Visible for Groq Whisper) */}
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
                {groqWhisper.isTranscribing
                  ? '⚡ Groq Whisper AI is transcribing into Urdu script...'
                  : azureSpeech.isTranscribing
                  ? '☁️ Azure Speech is transcribing into Urdu script...'
                  : isRecording
                  ? (currentLang === 'ur-PK'
                      ? `🔴 بولیں... سن رہا ہوں (${formatTimer(recordSeconds)}) — مکمل ہونے پر مائیک دبائیں`
                      : `🔴 Recording audio (${formatTimer(recordSeconds)}) — tap mic to finish`)
                  : (currentLang === 'ur-PK'
                      ? 'اردو میں بولنے کے لیے مائیک پر کلک کریں'
                      : 'Click microphone to speak')}
              </strong>
              <span className="voice-mic-sub">
                {sttEngine === 'groq'
                  ? 'Powered by Groq Whisper Large-v3. Converts speech accurately into authentic Urdu Perso-Arabic script.'
                  : sttEngine === 'azure'
                  ? 'Powered by Microsoft Azure Speech Services. Real-time cloud transcription in Urdu & English.'
                  : 'Browser local recognition. Pauses add punctuation.'}
              </span>
            </div>

            {/* Upload audio file button */}
            {(sttEngine === 'groq' || sttEngine === 'azure') && (
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
                  title="Upload an audio note or recording (.m4a, .mp3, .wav, .webm)"
                >
                  <Upload size={14} />
                  <span>Upload Audio File</span>
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
                <span>Transcribing audio with {sttEngine === 'azure' ? 'Microsoft Azure Speech' : 'Groq Whisper'}...</span>
              </div>
            ) : activeTranscript || interimTranscript ? (
              <>
                <span className="transcript-final">{activeTranscript}</span>
                {interimTranscript && (
                  <span className="transcript-interim"> {interimTranscript}</span>
                )}
              </>
            ) : (
              <span className="transcript-placeholder">
                {isRecording
                  ? (isUrdu ? 'سن رہا ہوں، بولیں... (Listening, speak now)' : 'Listening, speak now...')
                  : (isUrdu
                      ? 'بولنے کے لیے اوپر مائیک پر کلک کریں یا آڈیو فائل اپلوڈ کریں'
                      : 'Click mic above to start speaking or upload an audio file')}
              </span>
            )}
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
                title="Set first sentence as Subject, rest as Description"
              >
                <Zap size={14} />
                <span>Auto-fill Post</span>
              </button>

              <button
                type="button"
                className="voice-action-btn"
                onClick={handleSpeak}
                disabled={isSpeaking || isLoadingAudio}
                title={voiceEngine === 'azure' ? 'Listen back in Azure Neural Voice (ur-PK-AsadNeural)' : voiceEngine === 'gemini' ? 'Listen back in Gemini spiritual voice' : 'Listen back in voice'}
              >
                {isLoadingAudio ? <Loader2 size={14} className="spin-icon" /> : <Volume2 size={14} />}
                <span>{isLoadingAudio ? 'Loading...' : isSpeaking ? 'Playing...' : 'Listen'}</span>
              </button>

              <button
                type="button"
                className="voice-action-btn voice-export-btn"
                onClick={handleExportAudio}
                disabled={isExporting}
                title="Export audio file (.mp3 / .wav) in heavy spiritual male voice"
              >
                <Download size={14} />
                <span>{isExporting ? 'Exporting...' : 'Export Audio'}</span>
              </button>

              <button
                type="button"
                className="voice-action-btn"
                onClick={handleCopy}
                title="Copy transcript to clipboard"
              >
                <Copy size={14} />
                <span>{copyFeedback ? 'Copied!' : 'Copy'}</span>
              </button>

              <button
                type="button"
                className="voice-action-btn voice-clear-btn"
                onClick={resetTranscript}
                title="Clear transcript"
              >
                <X size={14} />
                <span>Clear</span>
              </button>
            </div>
          )}

          {/* Footer note */}
          <div className="voice-commands-hint">
            <span>
              {sttEngine === 'azure' ? (
                <>☁️ Powered by <strong>Microsoft Azure Speech</strong>: Neural Urdu STT with cloud recognition</>
              ) : (
                <>⚡ Powered by <strong>Groq Whisper LPU</strong>: Transcribes Urdu in authentic حروفِ تہجی with code-switching</>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
