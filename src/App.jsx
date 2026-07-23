import React, { useState, useEffect, useRef } from 'react';
import { GoogleDriveService } from './googleDrive';
import CollectionsView from './CollectionsView';
import './App.css';
import {
  Brain,
  CloudLightning,
  Save,
  Search,
  LogOut,
  CheckCircle,
  WifiOff,
  Star,
  Plus,
  CalendarDays,
  Sparkles,
  Tag,
  Heart,
  Trash2,
  Filter,
  X,
  ChevronRight,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from 'lucide-react';

// TODO: Replace with your actual client ID from Google Cloud Console
const CLIENT_ID = '574535920766-ntjn0mr37h07sd3l1n5c3o2j4na7bqok.apps.googleusercontent.com';
const DEFAULT_CATEGORIES = ['Political', 'Religious', 'Poetry', 'Economics'];

function makeBlankForm(categories) {
  return {
    subject: '',
    description: '',
    category: categories[0] || DEFAULT_CATEGORIES[0],
    entryDate: new Date().toISOString().slice(0, 10),
    favorite: false,
    descriptionAlign: 'left',
  };
}

function normalizeCategories(categories) {
  const parsed = Array.isArray(categories) ? categories.filter(Boolean) : [];
  return parsed.length ? parsed : DEFAULT_CATEGORIES;
}

function normalizeSnapshot(payload) {
  if (!payload || typeof payload !== 'object') {
    return { thoughts: [], categories: DEFAULT_CATEGORIES };
  }

  return {
    thoughts: Array.isArray(payload.thoughts) ? payload.thoughts : [],
    categories: normalizeCategories(payload.categories),
  };
}

function formatDate(value) {
  if (!value) return 'No date';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function App() {
  const [token, setToken] = useState(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('gdrive_token') || null;
  });
  const [tokenExpiry, setTokenExpiry] = useState(() => {
    if (typeof window === 'undefined') return null;
    const expiry = localStorage.getItem('gdrive_token_expires_at');
    return expiry ? Number(expiry) : null;
  });
  const [thoughts, setThoughts] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('cached_thoughts');
      const parsed = JSON.parse(saved || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [categories, setCategories] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_CATEGORIES;
    try {
      const saved = localStorage.getItem('cached_categories');
      const parsed = JSON.parse(saved || 'null');
      return normalizeCategories(parsed);
    } catch {
      return DEFAULT_CATEGORIES;
    }
  });
  const [formData, setFormData] = useState(() => makeBlankForm(DEFAULT_CATEGORIES));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');
  const [collectionSelectedCategory, setCollectionSelectedCategory] = useState('All');
  const [collectionFavoritesOnly, setCollectionFavoritesOnly] = useState(false);
  const [activeView, setActiveView] = useState('home');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [status, setStatus] = useState('Ready');
  const [fileId, setFileId] = useState(null);
  const [selectedThought, setSelectedThought] = useState(null);
  const tokenClientRef = useRef(null);

  useEffect(() => {
    if (categories.length && formData.category && !categories.includes(formData.category)) {
      setFormData((current) => ({ ...current, category: categories[0] }));
    }
  }, [categories, formData.category]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cached_thoughts', JSON.stringify(thoughts));
    }
  }, [thoughts]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cached_categories', JSON.stringify(categories));
    }
  }, [categories]);

  useEffect(() => {
    const initGoogle = () => {
      if (window.google?.accounts?.oauth2) {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: async (response) => {
            if (response.error) {
              setStatus('Auth Error');
              return;
            }

            localStorage.setItem('gdrive_token', response.access_token);
            setToken(response.access_token);

            if (response.expires_in) {
              const expiresAt = Date.now() + Number(response.expires_in) * 1000;
              localStorage.setItem('gdrive_token_expires_at', String(expiresAt));
              setTokenExpiry(expiresAt);
            }

            setStatus('Connected');
          },
        });
        return true;
      }
      return false;
    };

    if (initGoogle()) return undefined;

    const interval = window.setInterval(() => {
      if (initGoogle()) window.clearInterval(interval);
    }, 200);

    return () => window.clearInterval(interval);
  }, []);

  const mergeThoughts = (local, remote) => {
    const map = new Map();
    (remote || []).forEach((thought) => map.set(thought.id, thought));
    (local || []).forEach((thought) => map.set(thought.id, thought));
    return Array.from(map.values()).sort((left, right) => {
      const leftTime = Number(left.createdAt || left.timestamp || 0);
      const rightTime = Number(right.createdAt || right.timestamp || 0);
      return rightTime - leftTime;
    });
  };

  const mergeCategories = (local, remote) => {
    const combined = [...new Set([...(remote || []), ...(local || [])].filter(Boolean))];
    return combined.length ? combined : DEFAULT_CATEGORIES;
  };

  const isTokenExpired = () => tokenExpiry && Date.now() >= tokenExpiry;

  const clearGoogleToken = () => {
    localStorage.removeItem('gdrive_token');
    localStorage.removeItem('gdrive_token_expires_at');
    setToken(null);
    setTokenExpiry(null);
    setFileId(null);
    setStatus('Auth expired');
  };

  const syncWithDrive = async (currentThoughts = thoughts, currentCategories = categories) => {
    if (!token || isTokenExpired()) {
      clearGoogleToken();
      return;
    }

    setStatus('Syncing...');
    try {
      const folderId = await GoogleDriveService.getOrCreateFolder(token);
      const { fileId: activeFileId, isNew } = await GoogleDriveService.getOrCreateDataFile(token, folderId);
      setFileId(activeFileId);

      const snapshot = {
        thoughts: currentThoughts,
        categories: currentCategories,
      };

      if (isNew) {
        await GoogleDriveService.uploadThoughts(token, activeFileId, snapshot);
      } else {
        const remoteState = normalizeSnapshot(await GoogleDriveService.downloadThoughts(token, activeFileId));
        const mergedThoughts = mergeThoughts(currentThoughts, remoteState.thoughts);
        const mergedCategories = mergeCategories(currentCategories, remoteState.categories);
        setThoughts(mergedThoughts);
        setCategories(mergedCategories);
        await GoogleDriveService.uploadThoughts(token, activeFileId, {
          thoughts: mergedThoughts,
          categories: mergedCategories,
        });
      }
      setStatus('Saved');
    } catch (error) {
      console.error(error);
      if (error?.status === 401) {
        clearGoogleToken();
        setStatus('Auth expired');
      } else {
        setStatus('Sync Error');
      }
    }
  };

  useEffect(() => {
    if (token) {
      syncWithDrive(thoughts, categories);
    }
  }, [token]);

  useEffect(() => {
    if (!selectedThought) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedThought(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedThought]);

  const handleLogin = () => {
    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gdrive_token');
    localStorage.removeItem('gdrive_token_expires_at');
    setToken(null);
    setTokenExpiry(null);
    setFileId(null);
    setStatus('Idle');
  };

  const handleSaveThought = async (event) => {
    event.preventDefault();
    const subject = formData.subject.trim();
    const description = formData.description.trim();
    if (!subject && !description) return;

    const nextThought = {
      id: crypto.randomUUID(),
      subject: subject || 'Untitled thought',
      description: description || 'A thoughtful note captured for later.',
      category: formData.category || categories[0] || DEFAULT_CATEGORIES[0],
      entryDate: formData.entryDate || new Date().toISOString().slice(0, 10),
      favorite: Boolean(formData.favorite),
      descriptionAlign: formData.descriptionAlign || 'left',
      createdAt: Date.now(),
    };

    const updatedThoughts = [nextThought, ...thoughts];
    setThoughts(updatedThoughts);
    setFormData(makeBlankForm(categories));
    setStatus('Saved Locally');

    if (token) {
      await syncWithDrive(updatedThoughts, categories);
    }
  };

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name || categories.includes(name)) return;

    const nextCategories = [...categories, name];
    setCategories(nextCategories);
    setFormData((current) => ({ ...current, category: name }));
    setNewCategoryName('');
    setStatus('Category added');

    if (token) {
      await syncWithDrive(thoughts, nextCategories);
    }
  };

  const deleteCategory = async (categoryName) => {
    const nextCategories = categories.filter((category) => category !== categoryName);
    const fallbackCategories = nextCategories.length ? nextCategories : DEFAULT_CATEGORIES;
    const fallbackCategory = fallbackCategories[0] || 'General';
    const updatedThoughts = thoughts.map((thought) => (
      thought.category === categoryName ? { ...thought, category: fallbackCategory } : thought
    ));

    setCategories(fallbackCategories);
    setThoughts(updatedThoughts);
    if (selectedCategory === categoryName) {
      setSelectedCategory('All');
    }
    setFormData((current) => ({ ...current, category: current.category === categoryName ? fallbackCategory : current.category }));
    setStatus('Category removed');

    if (token) {
      await syncWithDrive(updatedThoughts, fallbackCategories);
    }
  };

  const toggleFavorite = (id) => {
    setThoughts((current) => current.map((thought) => (thought.id === id ? { ...thought, favorite: !thought.favorite } : thought)));
    setSelectedThought((current) => (current?.id === id ? { ...current, favorite: !current.favorite } : current));
  };

  const deleteThought = (id) => {
    setThoughts((current) => current.filter((thought) => thought.id !== id));
    if (selectedThought?.id === id) {
      setSelectedThought(null);
    }
    setStatus('Thought removed');
  };

  const visibleThoughts = thoughts.filter((thought) => {
    const haystack = `${thought.subject} ${thought.description} ${thought.category}`.toLowerCase();
    const matchesQuery = haystack.includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || thought.category === selectedCategory;
    const matchesFavorite = !favoritesOnly || thought.favorite;
    return matchesQuery && matchesCategory && matchesFavorite;
  });

  const favoriteCount = thoughts.filter((thought) => thought.favorite).length;
  const summarizeText = (value, max = 112) => {
    const baseValue = value || 'No description added yet.';
    return baseValue.length > max ? `${baseValue.slice(0, max)}…` : baseValue;
  };
  const groupedRecentThoughts = categories
    .map((category) => {
      const items = visibleThoughts
        .filter((thought) => thought.category === category)
        .sort((left, right) => Number(right.createdAt || right.timestamp || 0) - Number(left.createdAt || left.timestamp || 0))
        .slice(0, 5);
      return { category, items };
    })
    .filter((group) => group.items.length > 0);

  const visibleCategoryGroups = selectedCategory === 'All'
    ? groupedRecentThoughts
    : groupedRecentThoughts.filter((group) => group.category === selectedCategory);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-icon">
            <Brain size={22} />
          </div>
          <div>
            <p className="eyebrow">Thought Organizer</p>
            <h1>Capture ideas with calm clarity</h1>
          </div>
        </div>

        <div className="header-actions">
          <span className="status-pill">
            {status === 'Syncing...' && <CloudLightning className="status-icon pulse" />}
            {status === 'Saved' && <CheckCircle className="status-icon success" />}
            {status.includes('Offline') && <WifiOff className="status-icon" />}
            {status}
          </span>
          {token ? (
            <button type="button" className="action-link" onClick={handleLogout}>
              <LogOut size={16} /> Sign out
            </button>
          ) : (
            <button type="button" className="primary-button" onClick={handleLogin}>
              Connect Google Drive
            </button>
          )}
        </div>
      </header>

      <div className="view-tabs" role="tablist" aria-label="Primary views">
        <button type="button" className={`tab-pill ${activeView === 'home' ? 'active' : ''}`} onClick={() => setActiveView('home')}>
          Home
        </button>
        <button type="button" className={`tab-pill ${activeView === 'collections' ? 'active' : ''}`} onClick={() => setActiveView('collections')}>
          Collections
        </button>
      </div>

      <main className="dashboard">
        {activeView === 'home' ? (
          <>
            <section className="hero-panel">
              <div className="capture-card">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">New thought</p>
                    <h2>Organize your reflections</h2>
                  </div>
                  <div className="chip">{thoughts.length} entries</div>
                </div>

                <form className="entry-form" onSubmit={handleSaveThought}>
                  <label className="field">
                    <span>Subject</span>
                    <input
                      value={formData.subject}
                      onChange={(event) => setFormData((current) => ({ ...current, subject: event.target.value }))}
                      placeholder="What sparked this thought?"
                    />
                  </label>

                  <label className="field">
                    <span>Description</span>
                    <div className="alignment-picker" role="toolbar" aria-label="Description alignment">
                      <button type="button" className={`alignment-button ${formData.descriptionAlign === 'left' ? 'active' : ''}`} onClick={() => setFormData((current) => ({ ...current, descriptionAlign: 'left' }))} aria-label="Align left">
                        <AlignLeft size={14} />
                      </button>
                      <button type="button" className={`alignment-button ${formData.descriptionAlign === 'center' ? 'active' : ''}`} onClick={() => setFormData((current) => ({ ...current, descriptionAlign: 'center' }))} aria-label="Align center">
                        <AlignCenter size={14} />
                      </button>
                      <button type="button" className={`alignment-button ${formData.descriptionAlign === 'right' ? 'active' : ''}`} onClick={() => setFormData((current) => ({ ...current, descriptionAlign: 'right' }))} aria-label="Align right">
                        <AlignRight size={14} />
                      </button>
                      <button type="button" className={`alignment-button ${formData.descriptionAlign === 'justify' ? 'active' : ''}`} onClick={() => setFormData((current) => ({ ...current, descriptionAlign: 'justify' }))} aria-label="Justify text">
                        <AlignJustify size={14} />
                      </button>
                    </div>
                    <textarea
                      rows="5"
                      value={formData.description}
                      onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Add deeper notes, reflections, or context"
                      style={{ textAlign: formData.descriptionAlign || 'left', direction: formData.descriptionAlign === 'right' ? 'rtl' : 'ltr' }}
                    />
                  </label>

                  <div className="field-row">
                    <label className="field compact">
                      <span>Category</span>
                      <select
                        value={formData.category}
                        onChange={(event) => setFormData((current) => ({ ...current, category: event.target.value }))}
                      >
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field compact">
                      <span>Date</span>
                      <input
                        type="date"
                        value={formData.entryDate}
                        onChange={(event) => setFormData((current) => ({ ...current, entryDate: event.target.value }))}
                      />
                    </label>
                  </div>

                  <div className="form-footer">
                    <label className="favorite-toggle">
                      <input
                        type="checkbox"
                        checked={formData.favorite}
                        onChange={(event) => setFormData((current) => ({ ...current, favorite: event.target.checked }))}
                      />
                      <Star size={16} /> Favorite
                    </label>

                    <button type="submit" className="primary-button save-button">
                      <Save size={16} /> Save thought
                    </button>
                  </div>
                </form>

                <div className="category-builder">
                  <div className="section-heading small">
                    <div>
                      <p className="eyebrow">Categories</p>
                      <h3>Grow your organizing system</h3>
                    </div>
                  </div>
                  <div className="category-list">
                    {categories.map((category) => (
                      <span key={category} className="category-pill">
                        <Tag size={12} /> {category}
                        <button type="button" className="category-delete-button" onClick={() => deleteCategory(category)} aria-label={`Delete category ${category}`}>
                          <Trash2 size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="category-inputs">
                    <input
                      value={newCategoryName}
                      onChange={(event) => setNewCategoryName(event.target.value)}
                      placeholder="Add a category"
                    />
                    <button type="button" className="secondary-button" onClick={handleAddCategory}>
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="stats-card">
                <div className="stat-row">
                  <div className="stat-icon">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <strong>{thoughts.length}</strong>
                    <span>Total thoughts</span>
                  </div>
                </div>
                <div className="stat-row">
                  <div className="stat-icon">
                    <Heart size={18} />
                  </div>
                  <div>
                    <strong>{favoriteCount}</strong>
                    <span>Favorites</span>
                  </div>
                </div>
                <div className="stat-row">
                  <div className="stat-icon">
                    <Tag size={18} />
                  </div>
                  <div>
                    <strong>{categories.length}</strong>
                    <span>Categories</span>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <CollectionsView
            categories={categories}
            thoughts={thoughts}
            collectionSearchQuery={collectionSearchQuery}
            setCollectionSearchQuery={setCollectionSearchQuery}
            collectionSelectedCategory={collectionSelectedCategory}
            setCollectionSelectedCategory={setCollectionSelectedCategory}
            collectionFavoritesOnly={collectionFavoritesOnly}
            setCollectionFavoritesOnly={setCollectionFavoritesOnly}
            formatDate={formatDate}
            summarizeText={summarizeText}
            setSelectedThought={setSelectedThought}
          />
        )}
      </main>
      {selectedThought && (
        <div className="preview-backdrop" role="dialog" aria-modal="true" onClick={() => setSelectedThought(null)}>
          <div className="preview-panel" onClick={(event) => event.stopPropagation()}>
            <div className="preview-head">
              <div>
                <p className="eyebrow">Full screen preview</p>
                <h3>{selectedThought.subject || 'Untitled thought'}</h3>
              </div>
              <div className="preview-actions">
                <button type="button" className="icon-button" onClick={(event) => {
                  event.stopPropagation();
                  toggleFavorite(selectedThought.id);
                }} aria-label="Toggle favorite in preview">
                  <Star size={18} className={selectedThought.favorite ? 'filled' : ''} />
                </button>
                <button type="button" className="icon-button" onClick={(event) => {
                  event.stopPropagation();
                  deleteThought(selectedThought.id);
                }} aria-label="Delete thought in preview">
                  <Trash2 size={18} />
                </button>
                <button type="button" className="icon-button" onClick={() => setSelectedThought(null)} aria-label="Close preview">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="preview-content">
              <p className="preview-description" style={{ textAlign: selectedThought.descriptionAlign || 'left', direction: selectedThought.descriptionAlign === 'right' ? 'rtl' : 'ltr' }}>
                {selectedThought.description || 'No description added yet.'}
              </p>
              <div className="preview-meta-list">
                <div className="preview-meta-item">
                  <span>Category</span>
                  <strong>{selectedThought.category || 'General'}</strong>
                </div>
                <div className="preview-meta-item">
                  <span>Captured</span>
                  <strong>{formatDate(selectedThought.entryDate || selectedThought.createdAt || selectedThought.timestamp)}</strong>
                </div>
                <div className="preview-meta-item">
                  <span>Favorite</span>
                  <strong>{selectedThought.favorite ? 'Yes' : 'No'}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
