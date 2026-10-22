import React, { useState, useRef } from 'react';
import {
  Check,
  CloudLightning,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Heart,
  HelpCircle,
  Key,
  Loader2,
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
  Zap,
  ClipboardPaste,
  Copy,
  X,
  Sliders,
  Cloud,
} from 'lucide-react';
import { getGeminiApiKey, setGeminiApiKey, testGeminiApiKey } from './geminiService';
import {
  DEFAULT_GROQ_API_KEY,
  getGroqApiKey,
  setGroqApiKey,
  testGroqApiKey,
  getGroqWhisperModel,
  setGroqWhisperModel,
} from './groqService';
import {
  DEFAULT_AZURE_KEY,
  DEFAULT_AZURE_KEY2,
  AZURE_VOICE_OPTIONS,
  getAzureSpeechKey,
  setAzureSpeechKey,
  getAzureSpeechRegion,
  setAzureSpeechRegion,
  getAzureUrduVoice,
  setAzureUrduVoice,
  getAzureEnglishVoice,
  setAzureEnglishVoice,
  testAzureSpeechConnection,
} from './azureSpeechService';

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
  voiceEngine = 'azure',
  setVoiceEngine,
  isSpeaking = false,
  onStopTTS,
  onTestSpeak,
}) {
  const [activeTab, setActiveTab] = useState('all');

  // Categories & Backup
  const [newCatInput, setNewCatInput] = useState('');
  const [catError, setCatError] = useState('');
  const [showOAuthHelp, setShowOAuthHelp] = useState(false);
  const [showManualToken, setShowManualToken] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [showManualTokenSecret, setShowManualTokenSecret] = useState(false);
  const fileInputRef = useRef(null);

  // Groq Whisper AI
  const [groqKeyInput, setGroqKeyInput] = useState(() => getGroqApiKey());
  const [groqModel, setGroqModel] = useState(() => getGroqWhisperModel());
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [groqCopied, setGroqCopied] = useState(false);
  const [groqSavedFeedback, setGroqSavedFeedback] = useState(false);
  const [isGroqTesting, setIsGroqTesting] = useState(false);
  const [groqStatusMsg, setGroqStatusMsg] = useState({ text: '', type: '' });

  // Google Gemini AI
  const [geminiKeyInput, setGeminiKeyInput] = useState(() => getGeminiApiKey());
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiCopied, setGeminiCopied] = useState(false);
  const [geminiSavedFeedback, setGeminiSavedFeedback] = useState(false);
  const [isGeminiTesting, setIsGeminiTesting] = useState(false);
  const [geminiStatusMsg, setGeminiStatusMsg] = useState({ text: '', type: '' });

  // Microsoft Azure Speech
  const [azureKeyInput, setAzureKeyInput] = useState(() => getAzureSpeechKey());
  const [azureRegionInput, setAzureRegionInput] = useState(() => getAzureSpeechRegion());
  const [azureUrduVoice, setAzureUrduVoiceState] = useState(() => getAzureUrduVoice());
  const [azureEnVoice, setAzureEnVoiceState] = useState(() => getAzureEnglishVoice());
  const [showAzureKey, setShowAzureKey] = useState(false);
  const [azureCopied, setAzureCopied] = useState(false);
  const [azureSavedFeedback, setAzureSavedFeedback] = useState(false);
  const [isAzureTesting, setIsAzureTesting] = useState(false);
  const [azureStatusMsg, setAzureStatusMsg] = useState({ text: '', type: '' });

  // Playback settings reset
  const [resetFeedback, setResetFeedback] = useState(false);

  // ── Groq Handlers ──
  const handleSaveOnlyGroqKey = () => {
    const cleanKey = groqKeyInput.trim();
    setGroqApiKey(cleanKey);
    setGroqSavedFeedback(true);
    setGroqStatusMsg({
      text: cleanKey
        ? '✓ Groq API Key permanently saved in browser localStorage.'
        : 'Groq API Key cleared (reset to default).',
      type: 'success',
    });
    setTimeout(() => setGroqSavedFeedback(false), 2400);
  };

  const handleTestGroqKey = async () => {
    const cleanKey = groqKeyInput.trim();
    if (!cleanKey) {
      setGroqStatusMsg({ text: 'Please enter a Groq API Key to test.', type: 'error' });
      return;
    }
    setIsGroqTesting(true);
    setGroqStatusMsg({ text: '', type: '' });
    try {
      const result = await testGroqApiKey(cleanKey);
      setGroqApiKey(cleanKey);
      setGroqStatusMsg({
        text: `✓ Connected to Groq Cloud in ${result.latency}ms! (Available: ${result.models.filter((m) => m.includes('whisper')).join(', ') || 'Whisper Large v3'})`,
        type: 'success',
      });
    } catch (err) {
      setGroqStatusMsg({ text: `Connection test failed: ${err.message}`, type: 'error' });
    } finally {
      setIsGroqTesting(false);
    }
  };

  const handleCopyGroqKey = () => {
    if (!groqKeyInput) return;
    navigator.clipboard?.writeText(groqKeyInput);
    setGroqCopied(true);
    setTimeout(() => setGroqCopied(false), 1600);
  };

  const handlePasteGroqKey = async () => {
    try {
      const text = await navigator.clipboard?.readText();
      if (text) {
        setGroqKeyInput(text.trim());
        setGroqStatusMsg({ text: '', type: '' });
      }
    } catch {
      // fallback
    }
  };

  const handleResetGroqDefault = () => {
    setGroqKeyInput(DEFAULT_GROQ_API_KEY);
    setGroqApiKey(DEFAULT_GROQ_API_KEY);
    setGroqStatusMsg({ text: 'Restored pre-configured Groq API key.', type: 'info' });
  };

  const handleSelectGroqModel = (model) => {
    setGroqModel(model);
    setGroqWhisperModel(model);
  };

  // ── Gemini Handlers ──
  const handleSaveOnlyGeminiKey = () => {
    const cleanKey = geminiKeyInput.trim();
    setGeminiApiKey(cleanKey);
    setGeminiSavedFeedback(true);
    setGeminiStatusMsg({
      text: cleanKey
        ? '✓ Gemini API Key permanently saved in browser storage.'
        : 'Gemini API Key cleared.',
      type: cleanKey ? 'success' : 'info',
    });
    setTimeout(() => setGeminiSavedFeedback(false), 2400);
  };

  const handleTestGeminiKey = async () => {
    const cleanKey = geminiKeyInput.trim();
    if (!cleanKey) {
      setGeminiStatusMsg({ text: 'Please enter a Gemini API Key to test.', type: 'error' });
      return;
    }
    setIsGeminiTesting(true);
    setGeminiStatusMsg({ text: '', type: '' });
    try {
      const result = await testGeminiApiKey(cleanKey);
      setGeminiApiKey(cleanKey);
      setGeminiStatusMsg({
        text: `✓ Connected to Google Gemini in ${result.latency || 200}ms! Studio voice ready.`,
        type: 'success',
      });
    } catch (err) {
      setGeminiStatusMsg({ text: `Connection failed: ${err.message}`, type: 'error' });
    } finally {
      setIsGeminiTesting(false);
    }
  };

  const handleCopyGeminiKey = () => {
    if (!geminiKeyInput) return;
    navigator.clipboard?.writeText(geminiKeyInput);
    setGeminiCopied(true);
    setTimeout(() => setGeminiCopied(false), 1600);
  };

  const handlePasteGeminiKey = async () => {
    try {
      const text = await navigator.clipboard?.readText();
      if (text) {
        setGeminiKeyInput(text.trim());
        setGeminiStatusMsg({ text: '', type: '' });
      }
    } catch {
      // fallback
    }
  };

  // ── Azure Speech Handlers ──
  const handleSaveAzureConfig = () => {
    const cleanKey = azureKeyInput.trim();
    setAzureSpeechKey(cleanKey);
    setAzureSpeechRegion(azureRegionInput);
    setAzureUrduVoice(azureUrduVoice);
    setAzureEnglishVoice(azureEnVoice);
    setAzureSavedFeedback(true);
    setAzureStatusMsg({
      text: cleanKey
        ? `✓ Azure Speech settings permanently saved (${azureRegionInput} · ${azureUrduVoice}).`
        : 'Azure Speech Key reset to default.',
      type: 'success',
    });
    setTimeout(() => setAzureSavedFeedback(false), 2400);
  };

  const handleTestAzureConnection = async () => {
    const cleanKey = azureKeyInput.trim();
    if (!cleanKey) {
      setAzureStatusMsg({ text: 'Please enter an Azure Speech Subscription Key to test.', type: 'error' });
      return;
    }
    setIsAzureTesting(true);
    setAzureStatusMsg({ text: `Testing connection to Azure Speech (${azureRegionInput})...`, type: 'info' });
    try {
      const res = await testAzureSpeechConnection(cleanKey, azureRegionInput);
      setAzureSpeechKey(cleanKey);
      setAzureSpeechRegion(azureRegionInput);
      setAzureStatusMsg({
        text: `✓ Connected to Azure ${azureRegionInput} in ${res.latency}ms! ${res.totalVoices} neural voices online (${res.urduVoices} Urdu voices).`,
        type: 'success',
      });
    } catch (err) {
      setAzureStatusMsg({ text: `Connection failed: ${err.message}`, type: 'error' });
    } finally {
      setIsAzureTesting(false);
    }
  };

  const handleCopyAzureKey = async () => {
    if (!azureKeyInput) return;
    try {
      await navigator.clipboard.writeText(azureKeyInput);
      setAzureCopied(true);
      setTimeout(() => setAzureCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  const handlePasteAzureKey = async () => {
    try {
      const text = await navigator.clipboard?.readText();
      if (text && text.trim()) {
        setAzureKeyInput(text.trim());
        setAzureStatusMsg({ text: '', type: '' });
      }
    } catch {
      // ignore
    }
  };

  const handleUseKey1 = () => {
    setAzureKeyInput(DEFAULT_AZURE_KEY);
    setAzureSpeechKey(DEFAULT_AZURE_KEY);
    setAzureStatusMsg({ text: '✓ Switched to Azure Key 1 (Primary). Click Save to apply.', type: 'info' });
  };

  const handleUseKey2 = () => {
    setAzureKeyInput(DEFAULT_AZURE_KEY2);
    setAzureSpeechKey(DEFAULT_AZURE_KEY2);
    setAzureStatusMsg({ text: '✓ Switched to Azure Key 2 (Secondary). Click Save to apply.', type: 'info' });
  };

  // ── Audio Settings Reset ──
  const handleResetDefaults = () => {
    if (setTtsRate) setTtsRate(0.85);
    if (setTtsPitch) setTtsPitch(0.68);
    if (setVoiceEngine) setVoiceEngine('azure');
    setResetFeedback(true);
    setTimeout(() => setResetFeedback(false), 2000);
  };

  // ── Categories ──
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

  const showAll = activeTab === 'all';
  const showAI = showAll || activeTab === 'ai';
  const showCloud = showAll || activeTab === 'cloud';
  const showAppearance = showAll || activeTab === 'appearance';

  return (
    <div className="settings-page">
      <div className="settings-header">
        <p className="eyebrow">Preferences & Management</p>
        <h2>Settings</h2>
      </div>

      {/* ── Settings Navigation Filter Tabs ── */}
      <div className="settings-tabs-nav" role="tablist" aria-label="Settings Categories">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          className={`settings-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <Sliders size={14} /> All Settings
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ai'}
          className={`settings-tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          <Zap size={14} /> AI & Voice
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'cloud'}
          className={`settings-tab-btn ${activeTab === 'cloud' ? 'active' : ''}`}
          onClick={() => setActiveTab('cloud')}
        >
          <Cloud size={14} /> Cloud & Sync
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'appearance'}
          className={`settings-tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
          onClick={() => setActiveTab('appearance')}
        >
          <Sun size={14} /> Appearance & Categories
        </button>
      </div>

      <div className="settings-grid">
        {/* ── Groq Whisper AI Configuration (Primary Urdu STT) ── */}
        {showAI && (
          <section className="settings-card groq-settings-card">
            <div className="card-section-heading">
              <div className="settings-icon-badge groq-badge">
                <Zap size={22} />
              </div>
              <div>
                <h3>Groq Whisper AI (Urdu Voice-to-Urdu Text)</h3>
                <p className="card-subtitle">
                  High-speed speech-to-text directly in Persian-Arabic / Nastaʿlīq Urdu script &amp; bilingual code-switching via Groq LPUs
                </p>
              </div>
            </div>

            <div className="sync-status-row">
              <span className="status-label">Groq Whisper Status:</span>
              <span className={`status-pill ${groqKeyInput.trim() ? 'connected' : ''}`}>
                <span className={`status-dot ${groqKeyInput.trim() ? 'active' : ''}`} />
                {groqKeyInput.trim() ? `Active (${groqModel})` : 'Not Configured'}
              </span>
            </div>

            {/* Whisper Model Interactive Cards */}
            <div className="field">
              <div className="field-label-row">
                <span className="flex-inline">
                  <strong>Whisper Speech Model</strong>
                </span>
                <span className="field-hint">Select your preferred transcription engine</span>
              </div>
              <div className="groq-model-cards-grid" role="radiogroup" aria-label="Whisper model selection">
                <button
                  type="button"
                  role="radio"
                  aria-checked={groqModel === 'whisper-large-v3-turbo'}
                  className={`groq-model-card ${groqModel === 'whisper-large-v3-turbo' ? 'active' : ''}`}
                  onClick={() => handleSelectGroqModel('whisper-large-v3-turbo')}
                >
                  <div className="model-card-header">
                    <span className="model-name">
                      <Zap size={14} /> whisper-large-v3-turbo
                    </span>
                    <span className="model-card-badge turbo">⚡ ~200ms Fast</span>
                  </div>
                  <p className="model-card-desc">
                    Blistering-fast turnaround on Groq LPUs. Recommended for real-time dictation and thoughts.
                  </p>
                  {groqModel === 'whisper-large-v3-turbo' && (
                    <div className="model-card-selected">
                      <Check size={13} /> Selected
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={groqModel === 'whisper-large-v3'}
                  className={`groq-model-card ${groqModel === 'whisper-large-v3' ? 'active' : ''}`}
                  onClick={() => handleSelectGroqModel('whisper-large-v3')}
                >
                  <div className="model-card-header">
                    <span className="model-name">whisper-large-v3</span>
                    <span className="model-card-badge accuracy">🎯 Maximum Nuance</span>
                  </div>
                  <p className="model-card-desc">
                    Full-sized OpenAI Whisper model. Provides deepest vocabulary accuracy for complex Urdu dialects.
                  </p>
                  {groqModel === 'whisper-large-v3' && (
                    <div className="model-card-selected">
                      <Check size={13} /> Selected
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Groq API Key Box */}
            <div className="api-key-box">
              <div className="api-key-label-row">
                <span className="flex-inline">
                  <Key size={14} /> <strong>Groq API Key</strong>
                </span>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ai-studio-link"
                >
                  Get key on Groq Console <ExternalLink size={12} />
                </a>
              </div>

              <div className="api-key-input-wrapper">
                <span className="key-icon-prefix">
                  <Key size={15} />
                </span>
                <input
                  type={showGroqKey ? 'text' : 'password'}
                  value={groqKeyInput}
                  onChange={(e) => {
                    setGroqKeyInput(e.target.value);
                    setGroqStatusMsg({ text: '', type: '' });
                  }}
                  placeholder="Paste your Groq API key (gsk_...)"
                  className="api-key-input"
                  autoComplete="off"
                  spellCheck="false"
                />

                <div className="api-key-inline-actions">
                  <button
                    type="button"
                    className="key-action-icon-btn"
                    onClick={() => setShowGroqKey((v) => !v)}
                    title={showGroqKey ? 'Hide key' : 'Show key'}
                  >
                    {showGroqKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>

                  <button
                    type="button"
                    className={`key-action-icon-btn ${groqCopied ? 'copied' : ''}`}
                    onClick={handleCopyGroqKey}
                    title="Copy key to clipboard"
                    disabled={!groqKeyInput}
                  >
                    {groqCopied ? <Check size={15} className="copied-check" /> : <Copy size={15} />}
                  </button>

                  <button
                    type="button"
                    className="key-action-icon-btn"
                    onClick={handlePasteGroqKey}
                    title="Paste from clipboard"
                  >
                    <ClipboardPaste size={15} />
                  </button>

                  {groqKeyInput && (
                    <button
                      type="button"
                      className="key-action-icon-btn"
                      onClick={() => {
                        setGroqKeyInput('');
                        setGroqStatusMsg({ text: '', type: '' });
                      }}
                      title="Clear field"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="api-key-actions-row">
                <div className="primary-actions-left">
                  <button
                    type="button"
                    className="primary-button save-key-btn"
                    onClick={handleSaveOnlyGroqKey}
                  >
                    {groqSavedFeedback ? <Check size={15} /> : <Key size={15} />}
                    <span>{groqSavedFeedback ? 'Key Saved Permanently!' : 'Save Key'}</span>
                  </button>

                  <button
                    type="button"
                    className="secondary-button test-key-btn"
                    onClick={handleTestGroqKey}
                    disabled={isGroqTesting || !groqKeyInput.trim()}
                  >
                    {isGroqTesting ? <Loader2 size={15} className="spin-icon" /> : <Zap size={15} />}
                    <span>{isGroqTesting ? 'Testing connection...' : 'Test Connection'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="action-link reset-key-link"
                  onClick={handleResetGroqDefault}
                  title="Restore default pre-configured key"
                >
                  <RotateCcw size={13} />
                  <span>Reset to Default Key</span>
                </button>
              </div>

              <div className="api-security-note">
                <span>🔒 Permanently stored in your browser's persistent localStorage. Private &amp; secure.</span>
              </div>

              {groqStatusMsg.text && (
                <div className={`gemini-status-alert ${groqStatusMsg.type}`}>
                  {groqStatusMsg.type === 'success' && <Check size={14} />}
                  <span>{groqStatusMsg.text}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Google Gemini AI Configuration ── */}
        {showAI && (
          <section className="settings-card gemini-settings-card">
            <div className="card-section-heading">
              <div className="settings-icon-badge gemini-badge">
                <Sparkles size={22} />
              </div>
              <div>
                <h3>Google Gemini AI (Studio Spiritual Male Voice)</h3>
                <p className="card-subtitle">
                  Powers studio-grade heavy spiritual male voice generation (<code>gemini-3.8-flash-tts</code>)
                </p>
              </div>
            </div>

            <div className="sync-status-row">
              <span className="status-label">Gemini Voice Status:</span>
              <span className={`status-pill ${geminiKeyInput.trim() ? 'connected' : ''}`}>
                <span className={`status-dot ${geminiKeyInput.trim() ? 'active' : ''}`} />
                {geminiKeyInput.trim() ? 'Active (Studio Voice)' : 'Not Configured'}
              </span>
            </div>

            {/* Gemini API Key Box */}
            <div className="api-key-box">
              <div className="api-key-label-row">
                <span className="flex-inline">
                  <Key size={14} /> <strong>Gemini API Key</strong>
                </span>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ai-studio-link"
                >
                  Get free key on Google AI Studio <ExternalLink size={12} />
                </a>
              </div>

              <div className="api-key-input-wrapper">
                <span className="key-icon-prefix">
                  <Key size={15} />
                </span>
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiKeyInput}
                  onChange={(e) => {
                    setGeminiKeyInput(e.target.value);
                    setGeminiStatusMsg({ text: '', type: '' });
                  }}
                  placeholder="Paste your Gemini API key (AIzaSy...)"
                  className="api-key-input"
                  autoComplete="off"
                  spellCheck="false"
                />

                <div className="api-key-inline-actions">
                  <button
                    type="button"
                    className="key-action-icon-btn"
                    onClick={() => setShowGeminiKey((v) => !v)}
                    title={showGeminiKey ? 'Hide key' : 'Show key'}
                  >
                    {showGeminiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>

                  <button
                    type="button"
                    className={`key-action-icon-btn ${geminiCopied ? 'copied' : ''}`}
                    onClick={handleCopyGeminiKey}
                    title="Copy key to clipboard"
                    disabled={!geminiKeyInput}
                  >
                    {geminiCopied ? <Check size={15} className="copied-check" /> : <Copy size={15} />}
                  </button>

                  <button
                    type="button"
                    className="key-action-icon-btn"
                    onClick={handlePasteGeminiKey}
                    title="Paste from clipboard"
                  >
                    <ClipboardPaste size={15} />
                  </button>

                  {geminiKeyInput && (
                    <button
                      type="button"
                      className="key-action-icon-btn"
                      onClick={() => {
                        setGeminiKeyInput('');
                        setGeminiStatusMsg({ text: '', type: '' });
                      }}
                      title="Clear field"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="api-key-actions-row">
                <div className="primary-actions-left">
                  <button
                    type="button"
                    className="primary-button save-key-btn"
                    onClick={handleSaveOnlyGeminiKey}
                  >
                    {geminiSavedFeedback ? <Check size={15} /> : <Key size={15} />}
                    <span>{geminiSavedFeedback ? 'Key Saved Permanently!' : 'Save Key'}</span>
                  </button>

                  <button
                    type="button"
                    className="secondary-button test-key-btn"
                    onClick={handleTestGeminiKey}
                    disabled={isGeminiTesting || !geminiKeyInput.trim()}
                  >
                    {isGeminiTesting ? <Loader2 size={15} className="spin-icon" /> : <Sparkles size={15} />}
                    <span>{isGeminiTesting ? 'Testing connection...' : 'Test Connection'}</span>
                  </button>
                </div>
              </div>

              <div className="api-security-note">
                <span>🔒 Stored safely in persistent browser localStorage.</span>
              </div>

              {geminiStatusMsg.text && (
                <div className={`gemini-status-alert ${geminiStatusMsg.type}`}>
                  {geminiStatusMsg.type === 'success' && <Check size={14} />}
                  <span>{geminiStatusMsg.text}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Microsoft Azure Cognitive Speech (Neural Voice & STT) ── */}
        {showAI && (
          <section className="settings-card full-width azure-speech-card">
            <div className="card-section-heading">
              <div className="settings-icon-badge azure-badge">
                <Cloud size={22} />
              </div>
              <div className="heading-with-badge">
                <div>
                  <div className="card-title-row">
                    <h3>Microsoft Azure Cognitive Speech Services</h3>
                    <span className="groq-active-badge azure-active">
                      🟢 Active ({azureRegionInput} · {azureUrduVoice})
                    </span>
                  </div>
                  <p className="card-subtitle">
                    Lifelike Neural Text-to-Speech (ur-PK-AsadNeural deep spiritual male voice) &amp; Speech-to-Text for Urdu and English.
                  </p>
                </div>
              </div>
            </div>

            {/* Azure Resource Info Pill Bar */}
            <div className="azure-resource-info-bar">
              <div className="azure-meta-item">
                <span className="meta-lbl">Resource:</span>
                <strong className="meta-val">thought-organizer</strong>
              </div>
              <div className="azure-meta-item">
                <span className="meta-lbl">Region:</span>
                <strong className="meta-val">{azureRegionInput}</strong>
              </div>
              <div className="azure-meta-item">
                <span className="meta-lbl">Pricing Tier:</span>
                <strong className="meta-val">F0 (Free · 500k chars/mo)</strong>
              </div>
              <div className="azure-meta-item">
                <span className="meta-lbl">Urdu Voice:</span>
                <strong className="meta-val highlight">{azureUrduVoice}</strong>
              </div>
            </div>

            {/* Key Quick Selection Buttons */}
            <div className="azure-key-quick-row">
              <span className="quick-row-label">Key Slot:</span>
              <div className="azure-key-pills">
                <button
                  type="button"
                  className={`azure-key-pill ${azureKeyInput === DEFAULT_AZURE_KEY ? 'active' : ''}`}
                  onClick={handleUseKey1}
                  title="Switch to Key 1 (Primary subscription key)"
                >
                  <Key size={13} />
                  <span>Key 1 (Primary - Default)</span>
                </button>
                <button
                  type="button"
                  className={`azure-key-pill ${azureKeyInput === DEFAULT_AZURE_KEY2 ? 'active' : ''}`}
                  onClick={handleUseKey2}
                  title="Switch to Key 2 (Secondary backup key)"
                >
                  <Key size={13} />
                  <span>Key 2 (Secondary)</span>
                </button>
              </div>
            </div>

            {/* Azure API Key Input */}
            <div className="api-key-box">
              <div className="api-key-label-row">
                <span className="flex-inline">
                  <Key size={14} /> <strong>Azure Speech Subscription Key (Ocp-Apim-Subscription-Key)</strong>
                </span>
                <a
                  href="https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/SpeechServices"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ai-studio-link"
                >
                  Azure Portal <ExternalLink size={12} />
                </a>
              </div>

              <div className="api-key-input-wrapper">
                <span className="key-icon-prefix">
                  <Key size={15} />
                </span>
                <input
                  type={showAzureKey ? 'text' : 'password'}
                  value={azureKeyInput}
                  onChange={(e) => {
                    setAzureKeyInput(e.target.value);
                    setAzureStatusMsg({ text: '', type: '' });
                  }}
                  placeholder="Paste Microsoft Azure Speech Subscription Key..."
                  className="api-key-input"
                  autoComplete="off"
                  spellCheck="false"
                />

                <div className="api-key-inline-actions">
                  <button
                    type="button"
                    className="key-action-icon-btn"
                    onClick={() => setShowAzureKey((v) => !v)}
                    title={showAzureKey ? 'Hide key' : 'Show key'}
                  >
                    {showAzureKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>

                  <button
                    type="button"
                    className={`key-action-icon-btn ${azureCopied ? 'copied' : ''}`}
                    onClick={handleCopyAzureKey}
                    title="Copy key to clipboard"
                    disabled={!azureKeyInput}
                  >
                    {azureCopied ? <Check size={15} className="copied-check" /> : <Copy size={15} />}
                  </button>

                  <button
                    type="button"
                    className="key-action-icon-btn"
                    onClick={handlePasteAzureKey}
                    title="Paste from clipboard"
                  >
                    <ClipboardPaste size={15} />
                  </button>

                  {azureKeyInput && (
                    <button
                      type="button"
                      className="key-action-icon-btn"
                      onClick={() => {
                        setAzureKeyInput('');
                        setAzureStatusMsg({ text: '', type: '' });
                      }}
                      title="Clear field"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Region and Voice Pickers */}
              <div className="azure-settings-grid">
                {/* Region */}
                <div className="azure-config-field">
                  <label htmlFor="azure-region-select" className="azure-field-label">
                    Azure Service Region:
                  </label>
                  <select
                    id="azure-region-select"
                    value={azureRegionInput}
                    onChange={(e) => {
                      setAzureRegionInput(e.target.value);
                      setAzureStatusMsg({ text: '', type: '' });
                    }}
                    className="azure-select"
                  >
                    <option value="eastus">eastus (US East · Configured Default)</option>
                    <option value="eastus2">eastus2 (US East 2)</option>
                    <option value="westeurope">westeurope (West Europe)</option>
                    <option value="southeastasia">southeastasia (Southeast Asia)</option>
                    <option value="centralus">centralus (Central US)</option>
                    <option value="uksouth">uksouth (UK South)</option>
                  </select>
                </div>

                {/* Urdu Voice */}
                <div className="azure-config-field">
                  <label htmlFor="azure-urdu-voice-select" className="azure-field-label">
                    Urdu Neural Voice (STT &amp; TTS):
                  </label>
                  <select
                    id="azure-urdu-voice-select"
                    value={azureUrduVoice}
                    onChange={(e) => {
                      setAzureUrduVoiceState(e.target.value);
                      setAzureStatusMsg({ text: '', type: '' });
                    }}
                    className="azure-select"
                  >
                    {AZURE_VOICE_OPTIONS.urdu.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label} {v.id === 'ur-PK-AsadNeural' ? '⭐ Recommended' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* English Voice */}
                <div className="azure-config-field">
                  <label htmlFor="azure-en-voice-select" className="azure-field-label">
                    English Neural Voice:
                  </label>
                  <select
                    id="azure-en-voice-select"
                    value={azureEnVoice}
                    onChange={(e) => {
                      setAzureEnVoiceState(e.target.value);
                      setAzureStatusMsg({ text: '', type: '' });
                    }}
                    className="azure-select"
                  >
                    {AZURE_VOICE_OPTIONS.english.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label} {v.id === 'en-US-GuyNeural' ? '⭐ Recommended' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="api-key-actions-row">
                <div className="primary-actions-left">
                  <button
                    type="button"
                    className="primary-button save-key-btn"
                    onClick={handleSaveAzureConfig}
                  >
                    {azureSavedFeedback ? <Check size={15} /> : <Key size={15} />}
                    <span>{azureSavedFeedback ? 'Azure Settings Saved!' : 'Save Azure Settings'}</span>
                  </button>

                  <button
                    type="button"
                    className="secondary-button test-key-btn"
                    onClick={handleTestAzureConnection}
                    disabled={isAzureTesting || !azureKeyInput.trim()}
                  >
                    {isAzureTesting ? <Loader2 size={15} className="spin-icon" /> : <Cloud size={15} />}
                    <span>{isAzureTesting ? 'Testing connection...' : 'Test Connection'}</span>
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      onTestSpeak?.('السلام علیکم، یہ مائیکروسافٹ ایژر کی قدرتی نیورل آواز ہے۔', 'ur-PK');
                    }}
                    disabled={isSpeaking}
                    title="Test Urdu Neural Voice playback"
                  >
                    {isSpeaking ? <Loader2 size={15} className="spin-icon" /> : <Volume2 size={15} />}
                    <span>Test Urdu Voice</span>
                  </button>
                </div>
              </div>

              <div className="api-security-note">
                <span>🔒 Credentials stored securely in browser localStorage. Keys are obfuscated in memory.</span>
              </div>

              {azureStatusMsg.text && (
                <div className={`gemini-status-alert ${azureStatusMsg.type}`}>
                  {azureStatusMsg.type === 'success' && <Check size={14} />}
                  <span>{azureStatusMsg.text}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Audio Playback Speed & Pitch Settings ── */}
        {showAI && (
          <section className="settings-card full-width audio-settings-card">
            <div className="card-section-heading">
              <div className="settings-icon-badge audio-badge">
                <Volume2 size={22} />
              </div>
              <div>
                <h3>Audio Playback &amp; Voice Controls</h3>
                <p className="card-subtitle">
                  Configure voice playback speed, voice pitch, and default voice engine (Microsoft Azure is default)
                </p>
              </div>
            </div>

            {/* Voice Engine Toggle */}
            <div className="audio-setting-block">
              <div className="audio-setting-header">
                <span className="audio-setting-title">Voice Engine:</span>
                <span className="audio-setting-current-val">
                  {voiceEngine === 'azure'
                    ? 'Microsoft Azure Neural Voice (Default)'
                    : voiceEngine === 'gemini'
                    ? 'Gemini Studio Spiritual Voice'
                    : 'Browser Voice (Offline Fallback)'}
                </span>
              </div>
              <div className="voice-engine-picker" role="radiogroup" aria-label="Default voice engine">
                <button
                  type="button"
                  className={`voice-engine-btn ${voiceEngine === 'azure' ? 'active' : ''}`}
                  onClick={() => setVoiceEngine && setVoiceEngine('azure')}
                >
                  <span className="engine-title">
                    <Cloud size={16} /> Microsoft Azure Neural Voice (Default)
                  </span>
                  <span className="engine-desc">
                    Studio-quality deep spiritual male voice (ur-PK-AsadNeural &amp; en-US-GuyNeural). Default for thought playback.
                  </span>
                </button>

                <button
                  type="button"
                  className={`voice-engine-btn ${voiceEngine === 'gemini' ? 'active' : ''}`}
                  onClick={() => setVoiceEngine && setVoiceEngine('gemini')}
                >
                  <span className="engine-title">
                    <Sparkles size={16} /> Gemini Studio Voice (AI)
                  </span>
                  <span className="engine-desc">
                    Ultra-realistic spiritual male voice generated by Gemini 3.8 Flash TTS. Requires API key.
                  </span>
                </button>

                <button
                  type="button"
                  className={`voice-engine-btn ${voiceEngine === 'existing' ? 'active' : ''}`}
                  onClick={() => setVoiceEngine && setVoiceEngine('existing')}
                >
                  <span className="engine-title">
                    <Volume2 size={16} /> Browser Voice (Offline Fallback)
                  </span>
                  <span className="engine-desc">
                    Local browser speech synthesis tuned with deep baritone acoustics. Works offline without internet.
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
        )}

        {/* ── Theme / Appearance ── */}
        {showAppearance && (
          <section className="settings-card">
            <div className="card-section-heading">
              <div className="settings-icon-badge">
                {theme === 'dark' ? <Moon size={22} /> : <Sun size={22} />}
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
        )}

        {/* ── Google Drive & Memory Sync ── */}
        {showCloud && (
          <section className="settings-card">
            <div className="card-section-heading">
              <div className="settings-icon-badge">
                <CloudLightning size={22} />
              </div>
              <div>
                <h3>Cloud & Google Drive Backup</h3>
                <p className="card-subtitle">Sync thoughts to Google Drive and refresh memory state</p>
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
                  If you have an OAuth 2.0 token (from OAuth Playground or gcloud), paste it directly below:
                </p>
                <div className="api-key-input-wrapper">
                  <input
                    type={showManualTokenSecret ? 'text' : 'password'}
                    placeholder="ya29.a0..."
                    value={manualTokenInput}
                    onChange={(e) => setManualTokenInput(e.target.value)}
                    className="api-key-input"
                  />
                  <div className="api-key-inline-actions">
                    <button
                      type="button"
                      className="key-action-icon-btn"
                      onClick={() => setShowManualTokenSecret((v) => !v)}
                      title={showManualTokenSecret ? 'Hide token' : 'Show token'}
                    >
                      {showManualTokenSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button
                      type="button"
                      className="key-action-icon-btn"
                      onClick={async () => {
                        const text = await navigator.clipboard?.readText();
                        if (text) setManualTokenInput(text.trim());
                      }}
                      title="Paste from clipboard"
                    >
                      <ClipboardPaste size={15} />
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: '8px' }}>
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
        )}

        {/* ── Offline Local Backup (Export / Import JSON) ── */}
        {showCloud && (
          <section className="settings-card full-width">
            <div className="card-section-heading">
              <div className="settings-icon-badge">
                <Download size={22} />
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
        )}

        {/* ── Category Management (Addition & Deletion) ── */}
        {showAppearance && (
          <section className="settings-card full-width">
            <div className="card-section-heading">
              <div className="settings-icon-badge">
                <Tag size={22} />
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
        )}
      </div>
    </div>
  );
}
