import React, { useState, useRef } from 'react';
import {
  Check,
  CloudLightning,
  Database,
  Download,
  ExternalLink,
  Heart,
  HelpCircle,
  Key,
  LogOut,
  Moon,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Sparkles,
  Square,
  Sun,
  Tag,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { getGeminiApiKey, setGeminiApiKey, testGeminiApiKey } from './geminiService';

export default function SettingsView({
  theme,
  setTheme,
  categories,
  thoughts,
  onAddCategory,
  onRequestDeleteCategory,
  token,
  status,
  isSyncing,
  handleRefreshMemory,
  handleLogin,
  handleLogout,
  onExportBackup,
  onImportBackup,
  onManualToken,
  ttsRate = 0.85,
  setTtsRate,
  ttsPitch = 0.68,
  setTtsPitch,
  voiceEngine = 'existing',
  setVoiceEngine,
  isSpeaking = false,
  onStopTTS,
  onTestSpeak,
}) {
  const [newCatInput, setNewCatInput] = useState('');
  const [catError, setCatError] = useState('');
  const [showOAuthHelp, setShowOAuthHelp] = useState(false);
  const [showManualToken, setShowManualToken] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [geminiKeyInput, setGeminiKeyInput] = useState(() => getGeminiApiKey());
  const [isGeminiTesting, setIsGeminiTesting] = useState(false);
  const [geminiStatusMsg, setGeminiStatusMsg] = useState({ text: '', type: '' });
  const [resetFeedback, setResetFeedback] = useState(false);
  const fileInputRef = useRef(null);

  const handleResetDefaults = () => {
    if (setTtsRate) setTtsRate(0.85);
    if (setTtsPitch) setTtsPitch(0.68);
    if (setVoiceEngine) setVoiceEngine('existing');
    setResetFeedback(true);
    setTimeout(() => setResetFeedback(false), 2000);
  };

  const handleSaveGeminiKey = async (e) => {
    if (e) e.preventDefault();
    setGeminiStatusMsg({ text: '', type: '' });
    const cleanKey = geminiKeyInput.trim();
    if (!cleanKey) {
      setGeminiApiKey('');
      setGeminiStatusMsg({ text: 'API key cleared', type: 'info' });
      return;
    }
    setIsGeminiTesting(true);
    try {
      await testGeminiApiKey(cleanKey);
      setGeminiApiKey(cleanKey);
      setGeminiStatusMsg({ text: 'Gemini connected successfully! Studio voice & Urdu AI active.', type: 'success' });
    } catch (err) {
      setGeminiStatusMsg({ text: `Connection failed: ${err.message}`, type: 'error' });
    } finally {
      setIsGeminiTesting(false);
    }
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    const trimmed = newCatInput.trim();
    if (!trimmed) {
      setCatError('Category name cannot be empty');
      return;
    }
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setCatError('Category already exists');
      return;
    }

    setCatError('');
    onAddCategory(trimmed);
    setNewCatInput('');
  };

  const getCategoryCount = (catName) => {
    return thoughts.filter((t) => t.category === catName).length;
  };

  const totalFavorites = thoughts.filter((t) => t.favorite).length;

  return (
    <div className="settings-page">
      <div className="settings-header">
        <p className="eyebrow">Preferences & Management</p>
        <h2>Settings</h2>
      </div>

      <div className="settings-grid">
        {/* ── Theme / Appearance ── */}
        <section className="settings-card">
          <div className="card-section-heading">
            <div className="settings-icon-badge">
              {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
            </div>
            <div>
              <h3>Appearance</h3>
              <p className="card-subtitle">Choose between light and dark visual themes</p>
            </div>
          </div>

          <div className="theme-toggle-group" role="radiogroup" aria-label="Theme mode">
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'light'}
              className={`theme-option-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
            >
              <Sun size={18} />
              <span>Light Mode</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'dark'}
              className={`theme-option-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
            >
              <Moon size={18} />
              <span>Dark Mode</span>
            </button>
          </div>
        </section>

        {/* ── Google Gemini AI Configuration ── */}
        <section className="settings-card gemini-settings-card">
          <div className="card-section-heading">
            <div className="settings-icon-badge gemini-badge">
              <Sparkles size={20} />
            </div>
            <div>
              <h3>Google Gemini AI (Studio Voice & Urdu Voice Typing)</h3>
              <p className="card-subtitle">
                Powers authentic heavy spiritual male voice generation (<code>gemini-3.8-flash-tts</code>) and real-time Urdu script typing
              </p>
            </div>
          </div>

          <div className="sync-status-row">
            <span className="status-label">AI Voice Status:</span>
            <span className={`status-pill ${geminiKeyInput.trim() ? 'connected' : ''}`}>
              {geminiKeyInput.trim() ? '🟢 Active (Studio Voice & Urdu AI)' : '⚪ Not Configured'}
            </span>
          </div>

          <form onSubmit={handleSaveGeminiKey} className="gemini-settings-form">
            <label className="field">
              <span className="field-label-row">
                <span className="flex-inline"><Key size={14} /> Gemini API Key</span>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ai-studio-link"
                >
                  Get free key <ExternalLink size={12} />
                </a>
              </span>
              <div className="gemini-input-group">
                <input
                  type="password"
                  value={geminiKeyInput}
                  onChange={(e) => {
                    setGeminiKeyInput(e.target.value);
                    setGeminiStatusMsg({ text: '', type: '' });
                  }}
                  placeholder="Paste your free Gemini API key (AIzaSy...)"
                />
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isGeminiTesting}
                >
                  {isGeminiTesting ? 'Testing...' : 'Save & Connect'}
                </button>
              </div>
            </label>

            {geminiStatusMsg.text && (
              <div className={`gemini-status-alert ${geminiStatusMsg.type}`}>
                {geminiStatusMsg.type === 'success' && <Check size={14} />}
                <span>{geminiStatusMsg.text}</span>
              </div>
            )}
          </form>
        </section>

        {/* ── Audio Playback Speed & Pitch Settings ── */}
        <section className="settings-card full-width audio-settings-card">
          <div className="card-section-heading">
            <div className="settings-icon-badge audio-badge">
              <Volume2 size={20} />
            </div>
            <div>
              <h3>Audio Playback &amp; Voice Settings</h3>
              <p className="card-subtitle">
                Configure voice playback speed, voice pitch, and default voice engine (Existing is default)
              </p>
            </div>
          </div>

          {/* Voice Engine Toggle */}
          <div className="audio-setting-block">
            <div className="audio-setting-header">
              <span className="audio-setting-title">Voice Engine:</span>
              <span className="audio-setting-current-val">
                {voiceEngine === 'gemini' ? 'Google Gemini AI (Studio Voice)' : 'Existing Browser Voice (Default)'}
              </span>
            </div>
            <div className="voice-engine-toggle-group" role="radiogroup" aria-label="Voice Engine">
              <button
                type="button"
                role="radio"
                aria-checked={voiceEngine === 'existing'}
                className={`voice-engine-option-btn ${voiceEngine === 'existing' ? 'active' : ''}`}
                onClick={() => setVoiceEngine && setVoiceEngine('existing')}
              >
                <div className="engine-option-main">
                  <strong>Existing Browser Voice</strong>
                  <span className="badge-default">DEFAULT</span>
                </div>
                <span className="engine-option-desc">
                  Fast, 100% offline, zero latency. Built-in deep male resonance with customizable speed and pitch.
                </span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={voiceEngine === 'gemini'}
                className={`voice-engine-option-btn ${voiceEngine === 'gemini' ? 'active' : ''}`}
                onClick={() => setVoiceEngine && setVoiceEngine('gemini')}
              >
                <div className="engine-option-main">
                  <span className="flex-inline"><Sparkles size={14} /> <strong>Google Gemini AI Voice</strong></span>
                  {geminiKeyInput.trim() ? (
                    <span className="badge-ready">ACTIVE</span>
                  ) : (
                    <span className="badge-key-needed">KEY NEEDED</span>
                  )}
                </div>
                <span className="engine-option-desc">
                  Studio-grade heavy spiritual male baritone (gemini-3.8-flash-tts). Requires free API key.
                </span>
              </button>
            </div>
          </div>

          {/* Audio Playback Speed (Rate) */}
          <div className="audio-setting-block">
            <div className="audio-setting-header">
              <label htmlFor="audio-speed-slider" className="audio-setting-title">
                Play Audio Speed:
              </label>
              <span className="audio-setting-current-val">
                <strong>{Number(ttsRate).toFixed(2)}x</strong>
                <span className="audio-hint-tag">
                  {ttsRate < 0.8 ? 'Slow / Meditative' : ttsRate <= 0.9 ? 'Calm (Default)' : ttsRate <= 1.1 ? 'Normal' : 'Fast'}
                </span>
              </span>
            </div>

            <div className="slider-control-row">
              <span className="slider-bound">0.50x</span>
              <input
                id="audio-speed-slider"
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={ttsRate}
                onChange={(e) => setTtsRate && setTtsRate(parseFloat(e.target.value))}
                className="audio-range-slider"
                aria-label="Playback speed"
              />
              <span className="slider-bound">2.00x</span>
            </div>

            <div className="audio-presets-row">
              <span className="presets-label">Speed Presets:</span>
              {[
                { label: '0.75x Calm', val: 0.75 },
                { label: '0.85x Default', val: 0.85 },
                { label: '1.00x Normal', val: 1.0 },
                { label: '1.25x Brisk', val: 1.25 },
                { label: '1.50x Fast', val: 1.5 },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  className={`audio-preset-btn ${Math.abs(ttsRate - p.val) < 0.02 ? 'active' : ''}`}
                  onClick={() => setTtsRate && setTtsRate(p.val)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Audio Playback Pitch */}
          <div className="audio-setting-block">
            <div className="audio-setting-header">
              <label htmlFor="audio-pitch-slider" className="audio-setting-title">
                Play Audio Pitch:
              </label>
              <span className="audio-setting-current-val">
                <strong>{Number(ttsPitch).toFixed(2)}</strong>
                <span className="audio-hint-tag">
                  {ttsPitch <= 0.72 ? 'Deep Spiritual (Default)' : ttsPitch <= 0.9 ? 'Warm Baritone' : ttsPitch <= 1.1 ? 'Standard' : 'High Pitch'}
                </span>
              </span>
            </div>

            <div className="slider-control-row">
              <span className="slider-bound">0.50 (Deep)</span>
              <input
                id="audio-pitch-slider"
                type="range"
                min="0.5"
                max="1.5"
                step="0.02"
                value={ttsPitch}
                onChange={(e) => setTtsPitch && setTtsPitch(parseFloat(e.target.value))}
                className="audio-range-slider"
                aria-label="Voice pitch"
              />
              <span className="slider-bound">1.50 (High)</span>
            </div>

            <div className="audio-presets-row">
              <span className="presets-label">Pitch Presets:</span>
              {[
                { label: '0.68 Deep (Default)', val: 0.68 },
                { label: '0.82 Warm', val: 0.82 },
                { label: '1.00 Standard', val: 1.0 },
                { label: '1.20 Light', val: 1.2 },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  className={`audio-preset-btn ${Math.abs(ttsPitch - p.val) < 0.02 ? 'active' : ''}`}
                  onClick={() => setTtsPitch && setTtsPitch(p.val)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Test Listen Buttons & Reset */}
          <div className="audio-actions-row">
            <div className="audio-test-buttons">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  if (isSpeaking) {
                    onStopTTS?.();
                  } else {
                    onTestSpeak?.(
                      'Peace be upon you. This is a sample of your selected voice speed and pitch settings.',
                      'en-US'
                    );
                  }
                }}
              >
                {isSpeaking ? <Square size={15} /> : <Play size={15} />}
                <span>{isSpeaking ? 'Stop Test' : 'Test English Audio'}</span>
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  if (isSpeaking) {
                    onStopTTS?.();
                  } else {
                    onTestSpeak?.(
                      'السلام علیکم۔ یہ آپ کی منتخب کردہ آواز کی رفتار اور پچ کا نمونہ ہے۔',
                      'ur-PK'
                    );
                  }
                }}
              >
                {isSpeaking ? <Square size={15} /> : <Play size={15} />}
                <span>{isSpeaking ? 'Stop Test' : 'Test Urdu Audio'}</span>
              </button>
            </div>

            <button
              type="button"
              className="action-link reset-defaults-btn"
              onClick={handleResetDefaults}
              title="Reset speed to 0.85x, pitch to 0.68, and engine to Existing"
            >
              <RotateCcw size={14} />
              <span>{resetFeedback ? '✓ Reset to Existing Defaults' : 'Reset to Existing Defaults'}</span>
            </button>
          </div>
        </section>

        {/* ── Google Drive & Memory Sync ── */}
        <section className="settings-card">
          <div className="card-section-heading">
            <div className="settings-icon-badge">
              <CloudLightning size={20} />
            </div>
            <div>
              <h3>Cloud & Google Drive Backup</h3>
              <p className="card-subtitle">Sync to Google Drive and refresh notebook state</p>
            </div>
          </div>

          <div className="sync-status-row">
            <span className="status-label">Current Status:</span>
            <span className="status-pill">
              {isSyncing && <RotateCw size={13} className="spin" />}
              {status}
            </span>
          </div>

          <div className="sync-actions-row">
            <button
              type="button"
              className="primary-button refresh-button"
              onClick={handleRefreshMemory}
              disabled={isSyncing}
            >
              <RotateCw size={16} className={isSyncing ? 'spin' : ''} />
              Refresh Memory
            </button>

            {token ? (
              <button type="button" className="secondary-button" onClick={handleLogout}>
                <LogOut size={16} /> Disconnect Drive
              </button>
            ) : (
              <>
                <button type="button" className="secondary-button" onClick={() => handleLogin()}>
                  Connect Google Drive
                </button>
                <button
                  type="button"
                  className="action-link"
                  onClick={() => setShowManualToken(!showManualToken)}
                  title="Manual Access Token paste"
                >
                  <Key size={15} /> Paste Token
                </button>
              </>
            )}

            <button
              type="button"
              className="action-link"
              onClick={() => setShowOAuthHelp(!showOAuthHelp)}
              title="Google OAuth 2.0 configuration details"
            >
              <HelpCircle size={15} /> APK OAuth Info
            </button>
          </div>

          {showManualToken && !token && (
            <div className="oauth-help-box" style={{ marginTop: '0.75rem' }}>
              <h4>Manual OAuth Access Token</h4>
              <p style={{ fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                If you have an OAuth 2.0 token (from OAuth Playground or gcloud), you can paste it directly below:
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="ya29.a0..."
                  value={manualTokenInput}
                  onChange={(e) => setManualTokenInput(e.target.value)}
                  style={{
                    flex: '1',
                    minWidth: '200px',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                />
                <button
                  type="button"
                  className="primary-button"
                  style={{ padding: '0.5rem 1rem' }}
                  onClick={() => {
                    if (onManualToken && onManualToken(manualTokenInput)) {
                      setShowManualToken(false);
                      setManualTokenInput('');
                    }
                  }}
                >
                  Apply Token
                </button>
              </div>
            </div>
          )}

          {showOAuthHelp && (
            <div className="oauth-help-box">
              <h4>Google OAuth 2.0 Setup Details</h4>
              <p>
                <strong>1. In-App Direct Login (Default):</strong><br />
                Tapping <em>&quot;Connect Google Drive&quot;</em> opens the Google Sign-in dialog directly inside the app with a sanitized User-Agent. It uses in-app messaging and does <strong>not</strong> require redirect URIs.
              </p>
              <p style={{ marginTop: '0.5rem' }}>
                <strong>2. If using External Browser / Chrome Custom Tab:</strong><br />
                If you encounter <code>Error 400: redirect_uri_mismatch</code>, go to{' '}
                <em>Google Cloud Console &gt; APIs &amp; Services &gt; Credentials</em>, select your Web Client ID, and add this exact URI to <strong>Authorized redirect URIs</strong>:
                <br />
                <code>https://kaiserabbas.github.io/thought-organizer/</code>
              </p>
              <p style={{ marginTop: '0.5rem' }}>
                <strong>3. Native Android Client ID (Optional):</strong>
              </p>
              <ul>
                <li>
                  <strong>Package Name:</strong> <code>com.kaiserabbas.thoughtorganizer</code>
                </li>
                <li>
                  <strong>SHA-1 Fingerprint:</strong>{' '}
                  <code>33:9E:8C:73:EC:2E:85:22:11:3E:F5:84:CA:DD:60:E9:14:95:36:C7</code>
                </li>
              </ul>
            </div>
          )}

          <div className="sync-stats-box">
            <div className="sync-stat">
              <Database size={15} />
              <span>{thoughts.length} total saved</span>
            </div>
            <div className="sync-stat">
              <Heart size={15} />
              <span>{totalFavorites} favorites backed up</span>
            </div>
            <div className="sync-stat">
              <Tag size={15} />
              <span>{categories.length} categories</span>
            </div>
          </div>
        </section>

        {/* ── Offline Local Backup (Export / Import JSON) ── */}
        <section className="settings-card full-width">
          <div className="card-section-heading">
            <div className="settings-icon-badge">
              <Key size={20} />
            </div>
            <div>
              <h3>Local Backup &amp; Restore (Offline-Safe)</h3>
              <p className="card-subtitle">Export or import all your thoughts and categories directly as a JSON file</p>
            </div>
          </div>

          <div className="backup-actions-row">
            <button type="button" className="secondary-button" onClick={onExportBackup}>
              <Download size={16} /> Export JSON Backup
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} /> Restore from JSON Backup
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onImportBackup}
              accept=".json,application/json"
              style={{ display: 'none' }}
            />
          </div>
        </section>

        {/* ── Category Management (Addition & Deletion) ── */}
        <section className="settings-card full-width">
          <div className="card-section-heading">
            <div className="settings-icon-badge">
              <Tag size={20} />
            </div>
            <div>
              <h3>Category Management</h3>
              <p className="card-subtitle">Add new categories or delete existing ones</p>
            </div>
          </div>

          {/* Add Category Form */}
          <form className="add-category-form" onSubmit={handleAddSubmit}>
            <div className="input-with-button">
              <input
                type="text"
                value={newCatInput}
                onChange={(e) => {
                  setNewCatInput(e.target.value);
                  if (catError) setCatError('');
                }}
                placeholder="Enter new category name..."
                dir="auto"
              />
              <button type="submit" className="primary-button">
                <Plus size={16} /> Add Category
              </button>
            </div>
            {catError && <p className="field-error-msg">{catError}</p>}
          </form>

          {/* Existing Categories List */}
          <div className="categories-manage-list">
            <h4>Existing Categories ({categories.length})</h4>
            <div className="category-manage-items">
              {categories.map((cat) => {
                const count = getCategoryCount(cat);
                const isOnlyOne = categories.length <= 1;
                return (
                  <div key={cat} className="category-manage-item">
                    <div className="category-info">
                      <Tag size={15} />
                      <strong className="category-name">{cat}</strong>
                      <span className="category-post-count">
                        {count} {count === 1 ? 'thought' : 'thoughts'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="category-delete-action-btn"
                      onClick={() => onRequestDeleteCategory(cat, count)}
                      disabled={isOnlyOne}
                      title={isOnlyOne ? 'At least one category is required' : `Delete category ${cat}`}
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="category-info-note">
              Note: Deleting a category moves its thoughts to the default category so your thoughts are never lost. Before deleting, a confirmation will appear.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
