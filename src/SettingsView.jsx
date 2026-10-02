import React, { useState, useRef } from 'react';
import {
  CloudLightning,
  Database,
  Download,
  Heart,
  HelpCircle,
  Key,
  LogOut,
  Moon,
  Plus,
  RotateCw,
  Sun,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react';

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
}) {
  const [newCatInput, setNewCatInput] = useState('');
  const [catError, setCatError] = useState('');
  const [showOAuthHelp, setShowOAuthHelp] = useState(false);
  const fileInputRef = useRef(null);

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
              <button type="button" className="secondary-button" onClick={handleLogin}>
                Connect Google Drive
              </button>
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

          {showOAuthHelp && (
            <div className="oauth-help-box">
              <h4>Google OAuth 2.0 Setup for Android APK</h4>
              <p>To authorize Google Drive from the Android APK without policy blocks:</p>
              <ul>
                <li>
                  <strong>Package Name:</strong> <code>com.kaiserabbas.thoughtorganizer</code>
                </li>
                <li>
                  <strong>SHA-1 Fingerprint:</strong>{' '}
                  <code>33:9E:8C:73:EC:2E:85:22:11:3E:F5:84:CA:DD:60:E9:14:95:36:C7</code>
                </li>
                <li>
                  In <em>Google Cloud Console &gt; APIs &amp; Services &gt; Credentials</em>, ensure you have an <strong>Android</strong> OAuth Client ID registered with the package name and SHA-1 above, or authorized redirect URLs.
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
