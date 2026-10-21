// VoicePanel.jsx — Voice Input Panel for the Add Thought form
// Uses browser-native Web Speech API + Canvas waveform visualizer + Spiritual Audio Export.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Languages,
  Copy,
  Download,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { useVoice, containsUrdu } from './useVoice';
import { useTranslate } from './useTranslate';
import { useTTS } from './useTTS';

/**
 * VoicePanel
 * @param {Object} props
 * @param {function} props.onTranscript — called with (text) when transcript updates
 * @param {function} props.onDraftComplete — called with ({ subject, description }) for Voice Draft Mode
 * @param {string}   props.lang — 'en-US' | 'ur-PK'
 * @param {function} props.setLang — setter for lang
 */
export default function VoicePanel({ onTranscript, onDraftComplete, lang, setLang }) {
  const [translatedText, setTranslatedText] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);

  const { translate, isTranslating, error: translateError } = useTranslate();
  const { speak, isSpeaking, exportAudio, isExporting } = useTTS();

  const handleCommand = useCallback((command) => {
    if (command === 'clear') {
      resetTranscript();
      setTranslatedText('');
    }
    if (command === 'stop') {
      stopListening();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    isListening,
    transcript,
    interimTranscript,
    startListening: startRec,
    stopListening,
    resetTranscript,
    error: voiceError,
    isSupported,
  } = useVoice({ lang, onCommand: handleCommand });

  // When transcript updates, optionally notify parent
  useEffect(() => {
    if (transcript && onTranscript) {
      onTranscript(transcript);
    }
  }, [transcript, onTranscript]);

  // Auto-detect language from transcript if typed/spoken in Urdu
  useEffect(() => {
    if (!transcript) return;
    const hasUrdu = containsUrdu(transcript);
    if (hasUrdu && lang !== 'ur-PK') {
      setLang('ur-PK');
    }
  }, [transcript, lang, setLang]);

  // ── Waveform visualizer ──────────────────────────────────
  const startWaveform = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);

        const barWidth = (width / bufferLength) * 2.2;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = Math.max(3, (dataArray[i] / 255) * height);
          const alpha = 0.4 + (dataArray[i] / 255) * 0.6;
          ctx.fillStyle = '#125d01';
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, height - barHeight, barWidth - 2, barHeight, 2);
          } else {
            ctx.rect(x, height - barHeight, barWidth - 2, barHeight);
          }
          ctx.fill();
          x += barWidth + 1;
        }
        ctx.globalAlpha = 1;
      };

      draw();
    } catch {
      // Microphone stream for visualization unavailable (non-fatal)
    }
  }, []);

  const stopWaveform = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const handleStartListening = useCallback(async () => {
    startRec();
    await startWaveform();
  }, [startRec, startWaveform]);

  const handleStopListening = useCallback(() => {
    stopListening();
    stopWaveform();
  }, [stopListening, stopWaveform]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWaveform();
    };
  }, [stopWaveform]);

  // ── Translation ──────────────────────────────────────────
  const handleTranslate = async () => {
    if (!transcript) return;
    const from = containsUrdu(transcript) ? 'ur' : 'en';
    const to = from === 'ur' ? 'en' : 'ur';
    const result = await translate(transcript, from, to);
    setTranslatedText(result);
  };

  // ── Voice Draft Mode ─────────────────────────────────────
  const handleDraftFill = () => {
    if (!transcript || !onDraftComplete) return;
    const lines = transcript.trim().split(/[.!?\n؛۔]+/).filter(Boolean);
    const subject = lines[0]?.trim() || '';
    const description = lines.slice(1).join('. ').trim() || lines[0]?.trim();
    onDraftComplete({ subject, description });
    resetTranscript();
    setTranslatedText('');
  };

  // ── Copy transcript ──────────────────────────────────────
  const handleCopy = () => {
    if (!transcript) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(transcript);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    }
  };

  // ── Speak Transcript in Spiritual Voice ─────────────────
  const handleSpeakTranscript = () => {
    if (!transcript) return;
    speak(transcript, {
      lang,
      rate: 0.82,
      pitch: 0.68,
      wordCount: false,
    });
  };

  // ── Export Audio (.wav) ──────────────────────────────────
  const handleExportWav = async () => {
    if (!transcript) return;
    await exportAudio(transcript, lang, 'voice-thought');
  };

  const displayText = transcript + (interimTranscript ? ` ${interimTranscript}` : '');
  const isUrdu = lang === 'ur-PK' || containsUrdu(displayText);

  if (!isSupported) {
    return (
      <div className="voice-panel voice-panel-unsupported">
        <MicOff size={16} />
        <span>Voice input is not supported in this browser. Please try Chrome, Edge, or the Android App.</span>
      </div>
    );
  }

  return (
    <div className={`voice-panel ${isCollapsed ? 'voice-panel-collapsed' : ''}`}>
      {/* ── Header ── */}
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
            title={isCollapsed ? 'Expand voice panel' : 'Collapse voice panel'}
            aria-label="Toggle voice panel"
          >
            {isCollapsed ? '▼ Show Voice' : '▲ Hide'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="voice-panel-body">
          {/* ── Language Switcher ── */}
          <div className="voice-lang-row">
            <span className="voice-lang-label">Language:</span>
            <div className="voice-lang-toggle" role="radiogroup" aria-label="Speech language">
              <button
                type="button"
                className={`lang-pill ${lang === 'en-US' ? 'active' : ''}`}
                onClick={() => setLang('en-US')}
              >
                🇬🇧 English
              </button>
              <button
                type="button"
                className={`lang-pill ${lang === 'ur-PK' ? 'active' : ''}`}
                onClick={() => setLang('ur-PK')}
              >
                🇵🇰 اردو Urdu
              </button>
            </div>
          </div>

          {/* ── Microphone Action & Waveform ── */}
          <div className="voice-mic-container">
            <button
              type="button"
              className={`voice-mic-btn ${isListening ? 'active' : ''}`}
              onClick={isListening ? handleStopListening : handleStartListening}
              aria-label={isListening ? 'Stop recording voice' : 'Start speaking'}
              title={isListening ? 'Click to stop voice dictation' : 'Click to speak your thought'}
            >
              {isListening ? <MicOff size={24} /> : <Mic size={24} />}
            </button>

            <div className="voice-mic-info">
              <strong>{isListening ? 'Speaking now...' : 'Click mic to speak'}</strong>
              <span className="voice-mic-sub">
                {isListening
                  ? 'Say words clearly, or say "save" / "clear"'
                  : 'Speak in Urdu or English to dictate your thought'}
              </span>
            </div>
          </div>

          {/* ── Live Audio Waveform Canvas ── */}
          <div className={`waveform-wrapper ${isListening ? 'active' : ''}`}>
            <canvas
              ref={canvasRef}
              className="waveform-canvas"
              width={400}
              height={44}
              aria-hidden="true"
            />
          </div>

          {/* ── Real-time Transcript Preview ── */}
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

          {/* ── Error message ── */}
          {voiceError && (
            <div className="voice-error-msg" role="alert">
              ⚠️ {voiceError}
            </div>
          )}

          {/* ── Smart Action Bar ── */}
          {transcript && (
            <div className="voice-actions-toolbar">
              {/* Magic Draft Auto-Fill */}
              <button
                type="button"
                className="voice-action-btn voice-draft-btn"
                onClick={handleDraftFill}
                title="Automatically set 1st sentence as Subject and rest as Description"
              >
                <Zap size={14} />
                <span>Auto-fill Post</span>
              </button>

              {/* Real-time Translate */}
              <button
                type="button"
                className="voice-action-btn"
                onClick={handleTranslate}
                disabled={isTranslating}
                title={isUrdu ? 'Translate Urdu → English' : 'Translate English → Urdu'}
              >
                <Languages size={14} />
                <span>{isTranslating ? 'Translating...' : isUrdu ? 'Translate to English' : 'ترجمہ اردو'}</span>
              </button>

              {/* Listen back in spiritual voice */}
              <button
                type="button"
                className="voice-action-btn"
                onClick={handleSpeakTranscript}
                disabled={isSpeaking}
                title="Listen in deep spiritual male voice"
              >
                <Volume2 size={14} />
                <span>{isSpeaking ? 'Playing...' : 'Listen'}</span>
              </button>

              {/* Export Audio File (.wav) directly */}
              <button
                type="button"
                className="voice-action-btn voice-export-btn"
                onClick={handleExportWav}
                disabled={isExporting}
                title="Export this voice note directly as an audio file (.wav)"
              >
                <Download size={14} />
                <span>{isExporting ? 'Exporting...' : 'Export Audio (.wav)'}</span>
              </button>

              {/* Copy Transcript */}
              <button
                type="button"
                className="voice-action-btn"
                onClick={handleCopy}
                title="Copy spoken transcript to clipboard"
              >
                <Copy size={14} />
                <span>{copyFeedback ? 'Copied!' : 'Copy'}</span>
              </button>

              {/* Clear */}
              <button
                type="button"
                className="voice-action-btn voice-clear-btn"
                onClick={() => {
                  resetTranscript();
                  setTranslatedText('');
                }}
                title="Clear transcript"
              >
                <X size={14} />
                <span>Clear</span>
              </button>
            </div>
          )}

          {/* ── Translation Result Card ── */}
          {translatedText && (
            <div
              className="voice-translation-card"
              dir={containsUrdu(translatedText) ? 'rtl' : 'ltr'}
            >
              <div className="voice-translation-head">
                <span className="flex-inline">
                  <Languages size={14} />
                  <strong>Real-time Translation</strong>
                </span>
                <button
                  type="button"
                  className="voice-mini-btn"
                  onClick={() => {
                    if (navigator?.clipboard?.writeText) {
                      navigator.clipboard.writeText(translatedText);
                    }
                  }}
                  title="Copy translated text"
                >
                  <Copy size={12} /> Copy
                </button>
              </div>
              <p className="voice-translation-text">{translatedText}</p>
              {translateError && <small className="voice-error-hint">{translateError}</small>}
            </div>
          )}

          {/* ── Hands-free voice commands footer ── */}
          <div className="voice-commands-hint">
            <span>💡 Hands-free commands: say <strong>"clear"</strong> or <strong>"stop"</strong> while speaking</span>
          </div>
        </div>
      )}
    </div>
  );
}
