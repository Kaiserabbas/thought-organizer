// VoicePanel.jsx — Bilingual Voice Input (Urdu in Urdu script / English in English)
// Native Web Speech API — works on mobile & desktop browsers. Zero audio collisions.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Download, Mic, MicOff, Volume2, X, Zap, Loader2 } from 'lucide-react';
import { useVoice, containsUrdu, formatEnglishSentence } from './useVoice';
import { useTTS } from './useTTS';

/**
 * VoicePanel
 * @param {function} props.onNewChunk         — called with each new spoken chunk
 * @param {function} props.onDraftComplete    — called with { subject, description }
 * @param {string}   props.lang               — 'en-US' | 'ur-PK'
 * @param {function} props.setLang            — setter for lang
 * @param {function} props.onRequireGeminiKey — trigger to open Gemini API key modal
 */
export default function VoicePanel({
  onNewChunk,
  onDraftComplete,
  lang,
  setLang,
  ttsRate = 0.85,
  ttsPitch = 0.68,
  voiceEngine = 'existing',
  onRequireGeminiKey,
}) {
  const [isCollapsed,  setIsCollapsed]  = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const canvasRef    = useRef(null);
  const animFrameRef = useRef(null);

  const { speak, isSpeaking, isLoadingAudio, exportAudio, isExporting } = useTTS();

  // ── Voice commands from speech ─────────────────────────────────────
  const handleCommand = useCallback((command) => {
    if (command === 'clear') { resetTranscript(); }
    if (command === 'stop')  { handleStopListening(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    isListening,
    transcript,
    interimTranscript,
    currentLang,
    setCurrentLang,
    startListening: startRec,
    stopListening,
    resetTranscript,
    error: voiceError,
    isSupported,
  } = useVoice({
    lang,
    // onNewChunk: fired with ONLY the new chunk — no repetition
    onNewChunk: (chunk) => {
      if (onNewChunk) onNewChunk(chunk);
    },
    onCommand: handleCommand,
  });

  // Sync external lang prop → internal
  useEffect(() => {
    setCurrentLang(lang);
  }, [lang, setCurrentLang]);

  // Sync internal detected lang → external (e.g. when Urdu is auto-detected)
  useEffect(() => {
    if (currentLang !== lang) {
      setLang(currentLang);
    }
  }, [currentLang, lang, setLang]);

  // ── Waveform Visualizer (Synthetic Animation — Zero Mic Contention) ──
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

  // Sync waveform animation with listening state
  useEffect(() => {
    if (isListening) {
      startWaveform();
    } else {
      stopWaveform();
    }
    return () => stopWaveform();
  }, [isListening, startWaveform, stopWaveform]);

  const handleStartListening = useCallback(() => {
    startRec();
  }, [startRec]);

  const handleStopListening = useCallback(() => {
    stopListening();
  }, [stopListening]);

  // ── Auto-fill Draft ────────────────────────────────────────────────
  const handleDraftFill = () => {
    if (!transcript || !onDraftComplete) return;
    const isUrdu = containsUrdu(transcript) || currentLang === 'ur-PK';
    const separator = isUrdu ? '۔ ' : '. ';
    const endPunctuation = isUrdu ? '۔' : '.';
    // Split on sentence-ending punctuation (supports Urdu ۔ and . ! ?)
    const lines = transcript.trim().split(/[.!?۔\n]+/).filter(Boolean);
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
    if (!transcript) return;
    navigator.clipboard?.writeText(transcript);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 1500);
  };

  // ── Listen in Voice (respects settings rate, pitch & engine) ──
  const handleSpeak = () => {
    if (!transcript) return;
    speak(transcript, {
      lang: currentLang,
      rate: ttsRate,
      pitch: ttsPitch,
      useGemini: voiceEngine === 'gemini',
      onError: (err) => {
        if (err?.code === 'MISSING_GEMINI_KEY' && onRequireGeminiKey) {
          onRequireGeminiKey();
        }
      },
    });
  };

  // ── Export Audio (.wav) ────────────────────────────────────────────
  const handleExportWav = async () => {
    if (!transcript) return;
    const res = await exportAudio(transcript, currentLang, 'voice-thought');
    if (res && res.code === 'MISSING_GEMINI_KEY') {
      if (onRequireGeminiKey) onRequireGeminiKey();
    }
  };

  const isUrdu = currentLang === 'ur-PK' || containsUrdu(transcript + interimTranscript);

  if (!isSupported) {
    return (
      <div className="voice-panel voice-panel-unsupported">
        <MicOff size={16} />
        <span>Voice input is not supported in this browser. Please use Chrome, Edge, or Android Chrome.</span>
      </div>
    );
  }

  return (
    <div className={`voice-panel ${isCollapsed ? 'voice-panel-collapsed' : ''}`}>
      {/* Header */}
      <div className="voice-panel-header">
        <div className="voice-panel-title">
          <Mic size={16} />
          <span>Voice Thought Input</span>
          {isListening && <span className="voice-live-badge">● LISTENING</span>}
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
          {/* Language Selector */}
          <div className="voice-lang-row">
            <span className="voice-lang-label">Language:</span>
            <div className="voice-lang-toggle" role="radiogroup">
              <button
                type="button"
                className={`lang-pill ${currentLang === 'en-US' ? 'active' : ''}`}
                onClick={() => { setCurrentLang('en-US'); setLang('en-US'); }}
              >
                🇬🇧 English
              </button>
              <button
                type="button"
                className={`lang-pill ${currentLang === 'ur-PK' ? 'active' : ''}`}
                onClick={() => { setCurrentLang('ur-PK'); setLang('ur-PK'); }}
              >
                🇵🇰 اردو Urdu
              </button>
            </div>
            <span className="voice-lang-hint">
              {currentLang === 'ur-PK'
                ? '🟢 Urdu mode — speaks into authentic اردو script'
                : '🔵 English mode — first word capitalized automatically'}
            </span>
          </div>

          {/* Mic Button + Info */}
          <div className="voice-mic-container">
            <button
              type="button"
              className={`voice-mic-btn ${isListening ? 'active' : ''}`}
              onClick={isListening ? handleStopListening : handleStartListening}
              aria-label={isListening ? 'Stop recording' : 'Start speaking'}
              title={isListening ? 'Tap to stop dictation' : 'Tap to start speaking'}
            >
              {isListening ? <MicOff size={24} /> : <Mic size={24} />}
            </button>

            <div className="voice-mic-info">
              <strong>
                {isListening
                  ? (currentLang === 'ur-PK' ? 'سن رہا ہوں... (Listening)' : 'Listening...')
                  : (currentLang === 'ur-PK' ? 'بولنے کے لیے مائیک دبائیں' : 'Click mic to start speaking')}
              </strong>
              <span className="voice-mic-sub">
                {isListening
                  ? 'Speak naturally — pauses add proper punctuation automatically.'
                  : `Speaks in ${currentLang === 'ur-PK' ? 'Urdu (اردو script)' : 'English'}`}
              </span>
            </div>
          </div>

          {/* Live Audio Waveform Canvas */}
          <div className={`waveform-wrapper ${isListening ? 'active' : ''}`}>
            <canvas ref={canvasRef} className="waveform-canvas" width={400} height={44} aria-hidden="true" />
          </div>

          {/* Live Transcript Preview */}
          {(transcript || interimTranscript) && (
            <div
              className="transcript-box"
              dir={isUrdu ? 'rtl' : 'ltr'}
              lang={isUrdu ? 'ur' : 'en'}
            >
              <span className="transcript-final">{transcript}</span>
              {interimTranscript && (
                <span className="transcript-interim"> {interimTranscript}</span>
              )}
            </div>
          )}

          {/* Error */}
          {voiceError && (
            <div className="voice-error-msg" role="alert">⚠️ {voiceError}</div>
          )}

          {/* Action Bar (shows only when there is transcript) */}
          {transcript && (
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
                title={voiceEngine === 'gemini' ? 'Listen back in Gemini spiritual voice' : 'Listen back in voice'}
              >
                {isLoadingAudio ? <Loader2 size={14} className="spin-icon" /> : <Volume2 size={14} />}
                <span>{isLoadingAudio ? 'Loading...' : isSpeaking ? 'Playing...' : 'Listen'}</span>
              </button>

              <button
                type="button"
                className="voice-action-btn voice-export-btn"
                onClick={handleExportWav}
                disabled={isExporting}
                title="Export as .wav audio file in heavy spiritual male voice"
              >
                <Download size={14} />
                <span>{isExporting ? 'Exporting...' : 'Export Audio (.wav)'}</span>
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
                onClick={() => resetTranscript()}
                title="Clear transcript"
              >
                <X size={14} />
                <span>Clear</span>
              </button>
            </div>
          )}

          {/* Commands hint */}
          <div className="voice-commands-hint">
            <span>💡 Say <strong>"clear"</strong> or <strong>"stop"</strong> to control hands-free</span>
          </div>
        </div>
      )}
    </div>
  );
}
