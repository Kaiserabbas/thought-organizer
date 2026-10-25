// PostSoundPlayer.jsx — Dedicated SoundPlayer with Track Time for Full Post View
// Plays post content using Google Gemini Voice (Studio-grade spiritual voice)
// Features: Track time (mm:ss / mm:ss), interactive scrubber, seek -5s/+5s, speed control, download

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Download,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { getOrGenerateSpiritualSpeech, hasGeminiApiKey } from './geminiService';
import { triggerDownload } from './audioExporter';

/**
 * Helper to format seconds into mm:ss
 */
function formatTime(seconds) {
  if (isNaN(seconds) || seconds === null || seconds === undefined || seconds < 0) {
    return '00:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function PostSoundPlayer({
  thought,
  onRequireGeminiKey,
  defaultRate = 0.85,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(defaultRate || 1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const audioRef = useRef(null);
  const progressContainerRef = useRef(null);
  const currentBlobUrlRef = useRef(null);

  // Thought full text content
  const thoughtText = [
    thought?.subject ? `${thought.subject}.` : '',
    thought?.description || '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  // Stop & cleanup audio when thought changes or unmounts
  const cleanupAudio = useCallback(() => {
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
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentTime(0);
    setDuration(0);
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    cleanupAudio();
    return () => cleanupAudio();
  }, [thought?.id, cleanupAudio]);

  /**
   * Generates audio using Google Gemini Voice
   */
  const loadAudio = useCallback(async () => {
    if (!thoughtText) return null;
    setIsLoading(true);
    setErrorMessage(null);

    let blob = null;

    // Google Gemini Voice
    if (hasGeminiApiKey()) {
      try {
        blob = await getOrGenerateSpiritualSpeech(thoughtText, {
          voice: 'Charon',
        });
      } catch (geminiErr) {
        console.warn('Gemini Voice failed:', geminiErr);
      }
    }

    if (!blob) {
      setIsLoading(false);
      setErrorMessage(
        hasGeminiApiKey()
          ? 'Unable to generate Gemini voice audio. Please check your internet connection.'
          : 'Google Gemini API key required for Gemini Studio Voice. Please add your key in Settings.'
      );
      if (!hasGeminiApiKey() && onRequireGeminiKey) {
        onRequireGeminiKey();
      }
      return null;
    }

    // Revoke previous blob URL if any
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
    }

    const url = URL.createObjectURL(blob);
    currentBlobUrlRef.current = url;
    setIsLoading(false);

    // Initialize HTML Audio element
    const audio = new Audio(url);
    audio.playbackRate = playbackSpeed;
    audio.muted = isMuted;

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.onerror = (e) => {
      console.warn('Soundplayer audio error:', e);
      setIsPlaying(false);
      setIsLoading(false);
      setErrorMessage('Audio playback error occurred.');
    };

    audioRef.current = audio;
    return audio;
  }, [thoughtText, playbackSpeed, isMuted, onRequireGeminiKey]);

  /**
   * Play / Pause toggle
   */
  const handleTogglePlay = async () => {
    let audio = audioRef.current;

    if (!audio) {
      audio = await loadAudio();
      if (!audio) return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn('Audio play request failed:', err);
        setIsPlaying(false);
      }
    }
  };

  /**
   * Stop audio and reset position
   */
  const handleStop = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    setIsPlaying(false);
    setCurrentTime(0);
  };

  /**
   * Seek by clicking or dragging on the progress bar
   */
  const handleSeek = (e) => {
    if (!progressContainerRef.current || !duration) return;
    const rect = progressContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = ratio * duration;

    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  };

  /**
   * Skip forward or backward by seconds
   */
  const handleSkipSeconds = (delta) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(duration || 9999, audioRef.current.currentTime + delta));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  /**
   * Speed change handler
   */
  const handleSpeedChange = (rate) => {
    setPlaybackSpeed(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  /**
   * Mute toggle handler
   */
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (audioRef.current) {
      audioRef.current.muted = next;
    }
  };

  /**
   * Export audio file
   */
  const handleDownloadAudio = async () => {
    if (!thoughtText) return;
    const cleanName = (thought?.subject || 'thought')
      .replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '_')
      .slice(0, 50);

    // If audio already loaded as blob, download it directly
    if (currentBlobUrlRef.current && audioRef.current) {
      const a = document.createElement('a');
      a.href = currentBlobUrlRef.current;
      a.download = `${cleanName}-gemini-voice.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Otherwise generate and download with Google Gemini Voice
    try {
      setIsLoading(true);
      if (!hasGeminiApiKey()) {
        if (onRequireGeminiKey) onRequireGeminiKey();
        return;
      }
      const blob = await getOrGenerateSpiritualSpeech(thoughtText, { voice: 'Charon' });
      if (blob) {
        triggerDownload(blob, `${cleanName}-gemini-voice`);
      }
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Progress percentage
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="post-soundplayer-container">
      {/* SoundPlayer Header */}
      <div className="soundplayer-header">
        <div className="soundplayer-title-row">
          <div className="soundplayer-brand">
            <span className="brand-icon-gemini">
              <Sparkles size={16} />
            </span>
            <strong className="brand-name">Google Gemini Voice</strong>
            <span className="voice-tag">Charon · Spiritual Male</span>
          </div>

          <div className="soundplayer-header-actions">
            <button
              type="button"
              className="soundplayer-action-icon"
              onClick={handleDownloadAudio}
              disabled={isLoading || !thoughtText}
              title="Download post audio (Google Gemini Voice)"
              aria-label="Download audio"
            >
              <Download size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Scrubber & Track Time Row */}
      <div className="soundplayer-timeline-box">
        {/* Scrubber Progress Bar */}
        <div
          ref={progressContainerRef}
          className="soundplayer-progress-bar"
          onClick={handleSeek}
          role="slider"
          aria-valuemin="0"
          aria-valuemax={duration || 100}
          aria-valuenow={currentTime}
          tabIndex={0}
          title="Click to seek position"
        >
          <div
            className="soundplayer-progress-fill"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
          <div
            className="soundplayer-progress-thumb"
            style={{ left: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>

        {/* Track Time Display */}
        <div className="soundplayer-time-row">
          <div className="track-time-display">
            <span className="time-current">{formatTime(currentTime)}</span>
            <span className="time-divider">/</span>
            <span className="time-total">{formatTime(duration)}</span>
          </div>

          {/* Equalizer Soundwave Animation */}
          <div className={`soundplayer-soundwave ${isPlaying ? 'active' : ''}`}>
            <span className="sw-bar b1" />
            <span className="sw-bar b2" />
            <span className="sw-bar b3" />
            <span className="sw-bar b4" />
            <span className="sw-bar b5" />
            <span className="sw-bar b6" />
            <span className="sw-bar b7" />
            <span className="sw-bar b8" />
          </div>
        </div>
      </div>

      {/* Main Controls Row */}
      <div className="soundplayer-controls-row">
        {/* Center: Play / Pause Big Button */}
        <button
          type="button"
          className={`soundplayer-play-btn ${isPlaying ? 'playing' : ''} ${isLoading ? 'loading' : ''}`}
          onClick={handleTogglePlay}
          disabled={isLoading || !thoughtText}
          title={isPlaying ? 'Pause voice playback' : 'Play in Google Gemini spiritual voice'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <Loader2 size={18} className="spin-icon" />
          ) : isPlaying ? (
            <Pause size={18} />
          ) : (
            <Play size={18} style={{ marginLeft: 2 }} />
          )}
          <span className="play-btn-text">
            {isLoading ? 'Generating Audio...' : isPlaying ? 'Pause Voice' : 'Play Voice'}
          </span>
        </button>

        {/* Secondary Controls Group */}
        <div className="soundplayer-secondary-row">
          {/* Left: Skip back 5s */}
          <button
            type="button"
            className="soundplayer-ctrl-btn sec-btn"
            onClick={() => handleSkipSeconds(-5)}
            disabled={!duration || currentTime <= 0}
            title="Rewind 5 seconds"
            aria-label="Rewind 5 seconds"
          >
            <RotateCcw size={15} />
            <span className="btn-label-sub">5s</span>
          </button>

          {/* Skip forward 5s */}
          <button
            type="button"
            className="soundplayer-ctrl-btn sec-btn"
            onClick={() => handleSkipSeconds(5)}
            disabled={!duration || currentTime >= duration}
            title="Forward 5 seconds"
            aria-label="Forward 5 seconds"
          >
            <RotateCw size={15} />
            <span className="btn-label-sub">5s</span>
          </button>

          {/* Stop button (visible while playing or paused mid-track) */}
          {(isPlaying || currentTime > 0) && (
            <button
              type="button"
              className="soundplayer-ctrl-btn sec-btn"
              onClick={handleStop}
              title="Stop and reset to start"
              aria-label="Stop playback"
            >
              <Square size={14} />
            </button>
          )}

          {/* Mute button */}
          <button
            type="button"
            className="soundplayer-ctrl-btn sec-btn"
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          {/* Speed Selector Pills */}
          <div className="soundplayer-speed-group" role="radiogroup" aria-label="Playback speed">
            {[
              { label: '0.75x', val: 0.75 },
              { label: '1x', val: 1.0 },
              { label: '1.25x', val: 1.25 },
              { label: '1.5x', val: 1.5 },
            ].map((s) => (
              <button
                key={s.val}
                type="button"
                className={`speed-chip ${Math.abs(playbackSpeed - s.val) < 0.05 ? 'active' : ''}`}
                onClick={() => handleSpeedChange(s.val)}
                title={`${s.label} speed`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error / Alert notice if any */}
      {errorMessage && (
        <div className="soundplayer-alert-bar">
          <span>⚠️ {errorMessage}</span>
          {!hasGeminiApiKey() && onRequireGeminiKey && (
            <button
              type="button"
              className="soundplayer-setup-btn"
              onClick={onRequireGeminiKey}
            >
              Setup Gemini Key
            </button>
          )}
        </div>
      )}
    </div>
  );
}
