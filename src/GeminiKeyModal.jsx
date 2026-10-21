// GeminiKeyModal.jsx — Modal for entering and managing Google Gemini API Key
// Needed for studio-grade heavy spiritual male voice generation (gemini-3.8-flash-tts)
// and accurate Urdu script voice typing (gemini-3.8-flash)

import React, { useState } from 'react';
import { Key, Sparkles, ExternalLink, X, Check, AlertCircle } from 'lucide-react';
import { getGeminiApiKey, setGeminiApiKey, testGeminiApiKey } from './geminiService';

export default function GeminiKeyModal({ isOpen, onClose, onSuccess }) {
  const [apiKeyInput, setApiKeyInput] = useState(() => getGeminiApiKey());
  const [isTesting, setIsTesting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const cleanKey = apiKeyInput.trim();

    if (!cleanKey) {
      setErrorMsg('Please paste or enter your Gemini API key');
      return;
    }

    setIsTesting(true);
    try {
      await testGeminiApiKey(cleanKey);
      setGeminiApiKey(cleanKey);
      setSuccessMsg('API key verified successfully!');
      setTimeout(() => {
        if (onSuccess) onSuccess(cleanKey);
        if (onClose) onClose();
      }, 700);
    } catch (err) {
      setErrorMsg(`Verification failed: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setApiKeyInput(text.trim());
    } catch {
      // ignore
    }
  };

  return (
    <div className="confirm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="confirm-modal-box gemini-key-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gemini-modal-header">
          <div className="gemini-modal-icon">
            <Sparkles size={20} />
          </div>
          <div>
            <h3>Google Gemini AI Setup</h3>
            <p className="gemini-modal-sub">Studio-grade Spiritual Voice & Urdu Voice Typing</p>
          </div>
          <button type="button" className="icon-button close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="gemini-modal-body">
          <p className="gemini-explanation">
            To generate <strong>real heavy spiritual male voice audio files</strong> (powered by <code>gemini-3.8-flash-tts</code>) and transcribe Urdu voice directly into native Urdu script, a free Gemini API key is required.
          </p>

          <form onSubmit={handleSave} className="gemini-key-form">
            <label className="field">
              <span className="field-label-row">
                <span className="flex-inline"><Key size={14} /> Gemini API Key</span>
                <button type="button" className="paste-text-btn" onClick={handlePaste}>
                  Paste from clipboard
                </button>
              </span>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                placeholder="AIzaSy..."
                autoFocus
              />
            </label>

            {errorMsg && (
              <div className="gemini-modal-alert error">
                <AlertCircle size={15} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="gemini-modal-alert success">
                <Check size={15} />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="gemini-helper-link">
              <span>Don't have a key?</span>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="ai-studio-link"
              >
                Get a free key from Google AI Studio <ExternalLink size={13} />
              </a>
            </div>

            <div className="confirm-modal-actions">
              <button type="button" className="secondary-button" onClick={onClose} disabled={isTesting}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={isTesting || !apiKeyInput.trim()}>
                {isTesting ? 'Verifying Key...' : 'Save & Continue'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
