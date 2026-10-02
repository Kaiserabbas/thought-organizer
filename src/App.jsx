import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';
import { GoogleDriveService } from './googleDrive';
import CollectionsView from './CollectionsView';
import SettingsView from './SettingsView';
import ConfirmModal from './ConfirmModal';
import './App.css';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  BookOpen,
  Check,
  CheckCircle,
  CloudLightning,
  Copy,
  FilePlus2,
  Heart,
  Italic,
  List,
  LogOut,
  Moon,
  Palette,
  Pencil,
  Quote,
  RotateCw,
  Save,
  Settings,
  Sparkles,
  Star,
  Sun,
  Tag,
  Trash2,
  Type,
  WifiOff,
  X,
} from 'lucide-react';

const CLIENT_ID = '574535920766-ntjn0mr37h07sd3l1n5c3o2j4na7bqok.apps.googleusercontent.com';
const DEFAULT_CATEGORIES = ['Political', 'Religious', 'Poetry', 'Economics'];

const CARD_COLORS = [
  { id: 'default', label: 'Default', bg: '#ffffff' },
  { id: 'amber', label: 'Amber', bg: '#fffbeb' },
  { id: 'emerald', label: 'Emerald', bg: '#f0fdf4' },
  { id: 'blue', label: 'Sky Blue', bg: '#eff6ff' },
  { id: 'rose', label: 'Rose', bg: '#fff1f2' },
  { id: 'purple', label: 'Lavender', bg: '#faf5ff' },
  { id: 'slate', label: 'Slate', bg: '#f8fafc' },
];

const TEXT_COLORS = [
  { id: '', label: 'Default', color: '' },
  { id: '#dc2626', label: 'Ruby Red', color: '#dc2626' },
  { id: '#16a34a', label: 'Forest Green', color: '#16a34a' },
  { id: '#2563eb', label: 'Royal Blue', color: '#2563eb' },
  { id: '#d97706', label: 'Warm Amber', color: '#d97706' },
  { id: '#9333ea', label: 'Deep Purple', color: '#9333ea' },
  { id: '#e11d48', label: 'Crimson Rose', color: '#e11d48' },
];

function makeBlankForm(categories) {
  return {
    subject: '',
    description: '',
    category: categories[0] || DEFAULT_CATEGORIES[0],
    entryDate: new Date().toISOString().slice(0, 10),
    favorite: false,
    descriptionAlign: 'right',
    textColor: '',
    cardColor: 'default',
    isBold: false,
    isItalic: false,
  };
}

function makeEditForm(thought, categories) {
  return {
    subject: thought?.subject || '',
    description: thought?.description || '',
    category: thought?.category || categories[0] || DEFAULT_CATEGORIES[0],
    entryDate: String(thought?.entryDate || new Date().toISOString().slice(0, 10)).slice(0, 10),
    favorite: Boolean(thought?.favorite),
    descriptionAlign: thought?.descriptionAlign || 'right',
    textColor: thought?.textColor || '',
    cardColor: thought?.cardColor || 'default',
    isBold: Boolean(thought?.isBold),
    isItalic: Boolean(thought?.isItalic),
  };
}

function normalizeCategories(categories) {
  const parsed = Array.isArray(categories) ? categories.filter(Boolean) : [];
  return parsed.length ? parsed : DEFAULT_CATEGORIES;
}

function normalizeSnapshot(payload) {
  if (!payload || typeof payload !== 'object') {
    return { thoughts: [], categories: DEFAULT_CATEGORIES, deletedThoughtIds: [] };
  }

  return {
    thoughts: Array.isArray(payload.thoughts) ? payload.thoughts : [],
    categories: normalizeCategories(payload.categories),
    deletedThoughtIds: Array.isArray(payload.deletedThoughtIds) ? payload.deletedThoughtIds : [],
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

function copyToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
  return Promise.resolve();
}

function parseInlineMarkdown(text) {
  if (!text) return null;
  const tokens = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return <strong key={i}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      return <em key={i}>{token.slice(1, -1)}</em>;
    }
    return token;
  });
}

function renderFormattedContent(text) {
  if (!text) return 'No description added yet.';
  const lines = text.split('\n');

  return lines.map((line, idx) => {
    let cleanLine = line;
    const isQuote = cleanLine.startsWith('> ');
    if (isQuote) cleanLine = cleanLine.slice(2);

    const isBullet = cleanLine.startsWith('• ') || cleanLine.startsWith('- ');
    if (isBullet) cleanLine = cleanLine.slice(2);

    return (
      <span
        key={idx}
        className={`content-line ${isQuote ? 'line-quote' : ''} ${isBullet ? 'line-bullet' : ''}`}
      >
        {isBullet && <span className="bullet-dot">• </span>}
        {parseInlineMarkdown(cleanLine)}
        {idx < lines.length - 1 && <br />}
      </span>
    );
  });
}

function mergeThoughts(local, remote, deletedIds = []) {
  const deletedSet = new Set(deletedIds || []);
  const map = new Map();

  // Add remote thoughts first (unless deleted)
  (remote || []).forEach((thought) => {
    if (thought && thought.id && !deletedSet.has(thought.id)) {
      map.set(thought.id, thought);
    }
  });

  // Merge local thoughts
  (local || []).forEach((thought) => {
    if (thought && thought.id && !deletedSet.has(thought.id)) {
      const existing = map.get(thought.id);
      if (!existing) {
        map.set(thought.id, thought);
      } else {
        const localTime = Number(thought.updatedAt || thought.createdAt || thought.timestamp || 0);
        const existingTime = Number(existing.updatedAt || existing.createdAt || existing.timestamp || 0);
        if (localTime >= existingTime) {
          map.set(thought.id, thought);
        }
      }
    }
  });

  return Array.from(map.values()).sort((left, right) => {
    const leftTime = Number(left.createdAt || left.timestamp || 0);
    const rightTime = Number(right.createdAt || right.timestamp || 0);
    return rightTime - leftTime;
  });
}

function mergeCategories(local, remote) {
  const combined = [...new Set([...(remote || []), ...(local || [])].filter(Boolean))];
  return combined.length ? combined : DEFAULT_CATEGORIES;
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    return localStorage.getItem('app_theme') || 'light';
  });

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

  const [deletedThoughtIds, setDeletedThoughtIds] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('cached_deleted_thought_ids');
      const parsed = JSON.parse(saved || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [formData, setFormData] = useState(() => makeBlankForm(DEFAULT_CATEGORIES));
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');
  const [collectionSelectedCategory, setCollectionSelectedCategory] = useState('All');
  const [collectionFavoritesOnly, setCollectionFavoritesOnly] = useState(false);
  const [activeView, setActiveView] = useState('home');
  const [status, setStatus] = useState('Ready');
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedThought, setSelectedThought] = useState(null);
  const [isEditingThought, setIsEditingThought] = useState(false);
  const [editFormData, setEditFormData] = useState(() => makeBlankForm(DEFAULT_CATEGORIES));
  const [copiedThought, setCopiedThought] = useState(false);

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Delete',
    action: null,
  });

  const addTextareaRef = useRef(null);
  const editTextareaRef = useRef(null);
  const tokenClientRef = useRef(null);
  const syncedTokenRef = useRef(null);
  const isSyncingRef = useRef(false);
  const queuedSyncRef = useRef(null);

  // Apply theme to document
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('app_theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

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
    if (typeof window !== 'undefined') {
      localStorage.setItem('cached_deleted_thought_ids', JSON.stringify(deletedThoughtIds));
    }
  }, [deletedThoughtIds]);

  // URL Hash OAuth token parser (for redirect-based OAuth callbacks)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const expiresIn = params.get('expires_in');
        if (accessToken) {
          localStorage.setItem('gdrive_token', accessToken);
          setToken(accessToken);
          if (expiresIn) {
            const expiresAt = Date.now() + Number(expiresIn) * 1000;
            localStorage.setItem('gdrive_token_expires_at', String(expiresAt));
            setTokenExpiry(expiresAt);
          }
          setStatus('Connected');
          window.history.replaceState(null, '', window.location.pathname);
        }
      } catch (err) {
        console.error('Error parsing token hash:', err);
      }
    }
  }, []);

  // Deep Link Listener for Mobile APK (OAuth callback via custom scheme)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const sub = CapApp.addListener('appUrlOpen', async (data) => {
        try {
          const url = data.url;
          if (url && (url.includes('access_token=') || url.includes('token='))) {
            await Browser.close().catch(() => {});
            const rawParams = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
            const params = new URLSearchParams(rawParams);
            const accessToken = params.get('access_token') || params.get('token');
            const expiresIn = params.get('expires_in');
            if (accessToken) {
              localStorage.setItem('gdrive_token', accessToken);
              setToken(accessToken);
              if (expiresIn) {
                const expiresAt = Date.now() + Number(expiresIn) * 1000;
                localStorage.setItem('gdrive_token_expires_at', String(expiresAt));
                setTokenExpiry(expiresAt);
              }
              setStatus('Connected');
            }
          }
        } catch (err) {
          console.error('Error handling deep link:', err);
        }
      });

      return () => {
        sub.then((s) => s.remove());
      };
    }
  }, []);

  // Google OAuth Client for Web
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

  const clearGoogleToken = useCallback(() => {
    localStorage.removeItem('gdrive_token');
    localStorage.removeItem('gdrive_token_expires_at');
    syncedTokenRef.current = null;
    setToken(null);
    setTokenExpiry(null);
    setStatus('Auth expired');
  }, []);

  // Online / Offline listener
  useEffect(() => {
    const handleOnline = () => {
      setStatus(token ? 'Connected' : 'Ready');
    };
    const handleOffline = () => {
      setStatus('Offline (Saved locally)');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [token]);

  // Synchronize with Google Drive
  const syncWithDrive = useCallback(async (
    currentThoughts = thoughts,
    currentCategories = categories,
    options = {}
  ) => {
    const { deletedIds = deletedThoughtIds, directPush = false, forcePull = false } = options;

    if (!token || (tokenExpiry && Date.now() >= tokenExpiry)) {
      if (token) clearGoogleToken();
      return;
    }

    if (!navigator.onLine) {
      setStatus('Offline (Saved locally)');
      return;
    }

    if (isSyncingRef.current) {
      queuedSyncRef.current = { currentThoughts, currentCategories, options };
      return;
    }

    isSyncingRef.current = true;
    setIsSyncing(true);
    setStatus('Syncing...');

    try {
      const folderId = await GoogleDriveService.getOrCreateFolder(token);
      const { fileId: activeFileId, isNew } = await GoogleDriveService.getOrCreateDataFile(token, folderId);

      if (isNew || directPush) {
        const snapshot = {
          thoughts: currentThoughts,
          categories: currentCategories,
          deletedThoughtIds: deletedIds,
          lastSyncedAt: Date.now(),
        };
        await GoogleDriveService.uploadThoughts(token, activeFileId, snapshot);
      } else {
        const remoteState = normalizeSnapshot(await GoogleDriveService.downloadThoughts(token, activeFileId));
        const combinedDeleted = [...new Set([...deletedIds, ...(remoteState.deletedThoughtIds || [])])];
        setDeletedThoughtIds(combinedDeleted);

        let finalThoughts;
        let finalCategories;

        if (forcePull && remoteState.thoughts.length > 0) {
          finalThoughts = mergeThoughts(currentThoughts, remoteState.thoughts, combinedDeleted);
          finalCategories = mergeCategories(currentCategories, remoteState.categories);
        } else {
          finalThoughts = mergeThoughts(currentThoughts, remoteState.thoughts, combinedDeleted);
          finalCategories = mergeCategories(currentCategories, remoteState.categories);
        }

        setThoughts(finalThoughts);
        setCategories(finalCategories);

        await GoogleDriveService.uploadThoughts(token, activeFileId, {
          thoughts: finalThoughts,
          categories: finalCategories,
          deletedThoughtIds: combinedDeleted,
          lastSyncedAt: Date.now(),
        });
      }

      setStatus('Saved to Drive');
    } catch (error) {
      console.error('Sync error:', error);
      if (error?.status === 401) {
        clearGoogleToken();
        setStatus('Auth expired');
      } else {
        setStatus('Sync Error');
      }
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);

      if (queuedSyncRef.current) {
        const next = queuedSyncRef.current;
        queuedSyncRef.current = null;
        syncWithDrive(next.currentThoughts, next.currentCategories, next.options);
      }
    }
  }, [categories, clearGoogleToken, deletedThoughtIds, thoughts, token, tokenExpiry]);

  useEffect(() => {
    if (!token || syncedTokenRef.current === token) {
      return;
    }

    syncedTokenRef.current = token;
    syncWithDrive(thoughts, categories);
  }, [token, thoughts, categories, syncWithDrive]);

  // Modal keyboard dismiss
  useEffect(() => {
    if (!selectedThought) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeSelectedThought();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedThought]);

  useEffect(() => {
    if (!selectedThought) {
      setIsEditingThought(false);
      setCopiedThought(false);
      return;
    }

    setEditFormData(makeEditForm(selectedThought, categories));
    setIsEditingThought(false);
  }, [selectedThought, categories]);

  // Universal Login Handler: Supports In-App GIS Popup (direct, zero-config) & Browser Flow
  const handleLogin = async (options = {}) => {
    const useBrowser = Boolean(options && options.browser);

    // 1. In-App GIS Popup (Primary)
    // Works seamlessly on Web and inside the APK with sanitized User-Agent and popup dialog in MainActivity.
    // Does NOT send or require any redirect_uri, eliminating Error 400: redirect_uri_mismatch!
    if (!useBrowser) {
      if (tokenClientRef.current) {
        try {
          tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
          return;
        } catch (err) {
          console.warn('In-app tokenClient request failed, trying fallback:', err);
        }
      } else if (window.google?.accounts?.oauth2) {
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
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
          tokenClientRef.current = client;
          client.requestAccessToken({ prompt: 'consent' });
          return;
        } catch (err) {
          console.warn('Direct token client initialization failed:', err);
        }
      }
    }

    // 2. Browser / Chrome Custom Tab flow (Secondary / Fallback)
    // Note: Requires https://kaiserabbas.github.io/thought-organizer/ to be registered in Google Cloud Console
    if (Capacitor.isNativePlatform() || useBrowser) {
      const redirectUri = 'https://kaiserabbas.github.io/thought-organizer/';
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=token&scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.file')}&prompt=consent`;

      try {
        await Browser.open({ url: authUrl });
      } catch (browserErr) {
        console.error('Browser open failed:', browserErr);
      }
    }
  };

  const handleManualToken = (inputToken) => {
    if (!inputToken || !inputToken.trim()) return false;
    const cleanToken = inputToken.trim();
    localStorage.setItem('gdrive_token', cleanToken);
    const expiresAt = Date.now() + 3600 * 1000;
    localStorage.setItem('gdrive_token_expires_at', String(expiresAt));
    setToken(cleanToken);
    setTokenExpiry(expiresAt);
    setStatus('Connected');
    return true;
  };

  const handleLogout = () => {
    localStorage.removeItem('gdrive_token');
    localStorage.removeItem('gdrive_token_expires_at');
    setToken(null);
    setTokenExpiry(null);
    syncedTokenRef.current = null;
    setStatus('Ready');
  };

  const handleRefreshMemory = async () => {
    if (token) {
      setStatus('Refreshing...');
      await syncWithDrive(thoughts, categories, { forcePull: true });
      setStatus('Refreshed');
    } else {
      try {
        const savedThoughts = JSON.parse(localStorage.getItem('cached_thoughts') || '[]');
        const savedCategories = normalizeCategories(JSON.parse(localStorage.getItem('cached_categories') || 'null'));
        const savedDeleted = JSON.parse(localStorage.getItem('cached_deleted_thought_ids') || '[]');
        setThoughts(Array.isArray(savedThoughts) ? savedThoughts : []);
        setCategories(savedCategories);
        setDeletedThoughtIds(Array.isArray(savedDeleted) ? savedDeleted : []);
        setStatus('Memory Refreshed');
      } catch {
        setStatus('Memory Refreshed');
      }
    }
  };

  // Local JSON Backup Export & Import Handlers
  const handleExportBackup = () => {
    const data = {
      thoughts,
      categories,
      deletedThoughtIds,
      exportedAt: new Date().toISOString(),
      app: 'Thought Organizer',
      version: '1.0.0',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thought-organizer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const importedThoughts = Array.isArray(parsed.thoughts) ? parsed.thoughts : [];
        const importedCategories = normalizeCategories(parsed.categories);
        const mergedT = mergeThoughts(thoughts, importedThoughts, deletedThoughtIds);
        const mergedC = mergeCategories(categories, importedCategories);
        setThoughts(mergedT);
        setCategories(mergedC);
        setStatus('Backup Restored');
        if (token) {
          await syncWithDrive(mergedT, mergedC, { directPush: true });
        }
      } catch {
        alert('Invalid backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  // Copy Thought Handler
  const handleCopyThought = async (thoughtToCopy) => {
    const t = thoughtToCopy || selectedThought;
    if (!t) return;

    const textToCopy = `${t.subject}\n\n${t.description}\n\nCategory: ${t.category} | ${formatDate(t.entryDate || t.createdAt)}`;
    await copyToClipboard(textToCopy);
    setCopiedThought(true);
    setTimeout(() => setCopiedThought(false), 2000);
  };

  // Formatting tool helper: insert markdown tags into textarea
  const handleInsertTag = (textareaRef, tagStart, tagEnd, isEdit = false) => {
    const el = textareaRef.current;
    const setForm = isEdit ? setEditFormData : setFormData;

    if (!el) {
      setForm((prev) => ({ ...prev, description: `${prev.description}${tagStart}${tagEnd}` }));
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;
    const selected = val.slice(start, end);
    const replacement = `${tagStart}${selected || 'text'}${tagEnd}`;
    const nextVal = val.slice(0, start) + replacement + val.slice(end);

    setForm((prev) => ({ ...prev, description: nextVal }));

    setTimeout(() => {
      el.focus();
      const cursorStart = start + tagStart.length;
      const cursorEnd = cursorStart + (selected ? selected.length : 4);
      el.setSelectionRange(cursorStart, cursorEnd);
    }, 0);
  };

  // Save new thought
  const handleSaveThought = async (event) => {
    if (event) event.preventDefault();
    const subject = formData.subject.trim();
    const description = formData.description.trim();
    if (!subject && !description) return;

    const nextThought = {
      id: crypto.randomUUID(),
      subject: subject || 'Untitled thought',
      description,
      category: formData.category || categories[0] || DEFAULT_CATEGORIES[0],
      entryDate: formData.entryDate || new Date().toISOString().slice(0, 10),
      favorite: Boolean(formData.favorite),
      descriptionAlign: formData.descriptionAlign || 'right',
      textColor: formData.textColor || '',
      cardColor: formData.cardColor || 'default',
      isBold: Boolean(formData.isBold),
      isItalic: Boolean(formData.isItalic),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updatedThoughts = [nextThought, ...thoughts];
    setThoughts(updatedThoughts);
    setFormData(makeBlankForm(categories));
    setActiveView('home');
    setStatus('Saved Locally');

    if (token) {
      await syncWithDrive(updatedThoughts, categories, { directPush: true });
    }
  };

  // Add category
  const handleAddCategory = async (name) => {
    const trimmed = name.trim();
    if (!trimmed || categories.includes(trimmed)) return;

    const nextCategories = [...categories, trimmed];
    setCategories(nextCategories);
    setFormData((current) => ({ ...current, category: trimmed }));
    setStatus('Category added');

    if (token) {
      await syncWithDrive(thoughts, nextCategories, { directPush: true });
    }
  };

  // Request category deletion with confirmation
  const requestDeleteCategory = (categoryName, count) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Category Deletion',
      message: `Are you sure you want to delete "${categoryName}"? ${count} ${count === 1 ? 'thought' : 'thoughts'} will be moved to the default category.`,
      confirmText: 'Delete Category',
      action: () => executeDeleteCategory(categoryName),
    });
  };

  // Execute category deletion
  const executeDeleteCategory = async (categoryName) => {
    const nextCategories = categories.filter((category) => category !== categoryName);
    const fallbackCategories = nextCategories.length ? nextCategories : DEFAULT_CATEGORIES;
    const fallbackCategory = fallbackCategories[0] || 'General';
    const updatedThoughts = thoughts.map((thought) => (
      thought.category === categoryName ? { ...thought, category: fallbackCategory, updatedAt: Date.now() } : thought
    ));

    setCategories(fallbackCategories);
    setThoughts(updatedThoughts);
    if (collectionSelectedCategory === categoryName) {
      setCollectionSelectedCategory('All');
    }
    setFormData((current) => ({ ...current, category: current.category === categoryName ? fallbackCategory : current.category }));
    setEditFormData((current) => ({ ...current, category: current.category === categoryName ? fallbackCategory : current.category }));
    setStatus('Category removed');

    if (token) {
      await syncWithDrive(updatedThoughts, fallbackCategories, { directPush: true });
    }
  };

  // Toggle favorite
  const toggleFavorite = async (id) => {
    const updatedThoughts = thoughts.map((thought) =>
      thought.id === id ? { ...thought, favorite: !thought.favorite, updatedAt: Date.now() } : thought
    );
    setThoughts(updatedThoughts);
    setSelectedThought((current) =>
      current?.id === id ? { ...current, favorite: !current.favorite, updatedAt: Date.now() } : current
    );
    setStatus('Saved Locally');

    if (token) {
      await syncWithDrive(updatedThoughts, categories, { directPush: true });
    }
  };

  // Request thought deletion with confirmation
  const requestDeleteThought = (thought) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Deletion',
      message: `Are you sure you want to delete "${thought.subject || 'Untitled thought'}"? This action cannot be undone.`,
      confirmText: 'Delete Thought',
      action: () => executeDeleteThought(thought.id),
    });
  };

  // Execute thought deletion
  const executeDeleteThought = async (id) => {
    const nextDeletedIds = [...new Set([...deletedThoughtIds, id])];
    setDeletedThoughtIds(nextDeletedIds);
    localStorage.setItem('cached_deleted_thought_ids', JSON.stringify(nextDeletedIds));

    const updatedThoughts = thoughts.filter((thought) => thought.id !== id);
    setThoughts(updatedThoughts);
    localStorage.setItem('cached_thoughts', JSON.stringify(updatedThoughts));

    if (selectedThought?.id === id) {
      setSelectedThought(null);
      setIsEditingThought(false);
    }
    setStatus('Thought removed');

    if (token) {
      await syncWithDrive(updatedThoughts, categories, { deletedIds: nextDeletedIds, directPush: true });
    }
  };

  // Update existing thought
  const handleUpdateThought = async (event) => {
    if (event) event.preventDefault();
    if (!selectedThought) return;

    const subject = editFormData.subject.trim();
    const description = editFormData.description.trim();
    if (!subject && !description) return;

    const updatedThought = {
      ...selectedThought,
      subject: subject || 'Untitled thought',
      description,
      category: editFormData.category || categories[0] || DEFAULT_CATEGORIES[0],
      entryDate: editFormData.entryDate || new Date().toISOString().slice(0, 10),
      favorite: Boolean(editFormData.favorite),
      descriptionAlign: editFormData.descriptionAlign || 'right',
      textColor: editFormData.textColor || '',
      cardColor: editFormData.cardColor || 'default',
      isBold: Boolean(editFormData.isBold),
      isItalic: Boolean(editFormData.isItalic),
      updatedAt: Date.now(),
    };

    const updatedThoughts = thoughts.map((thought) => (thought.id === selectedThought.id ? updatedThought : thought));
    setThoughts(updatedThoughts);
    setSelectedThought(updatedThought);
    setIsEditingThought(false);
    setStatus('Saved Locally');

    if (token) {
      await syncWithDrive(updatedThoughts, categories, { directPush: true });
    }
  };

  const closeSelectedThought = () => {
    setSelectedThought(null);
    setIsEditingThought(false);
    setCopiedThought(false);
  };

  const favoriteCount = thoughts.filter((thought) => thought.favorite).length;
  const summarizeText = (value, max = 112) => {
    const baseValue = value || 'No description added yet.';
    return baseValue.length > max ? `${baseValue.slice(0, max)}...` : baseValue;
  };

  const getCounts = (text = '') => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = text.length;
    return `${words} words · ${chars} characters`;
  };

  return (
    <div className="app-shell" data-theme={theme}>
      {/* ── Top Bar ── */}
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-icon">
            <img src="/logo.png" alt="Brain icon" width={120} height={120} />
          </div>
          <div>
            <p className="eyebrow">Google Drive backed notebook</p>
            <h1>Thought Organizer</h1>
          </div>
        </div>

        <div className="header-actions">
          {/* Quick Refresh Memory Button */}
          <button
            type="button"
            className="action-button refresh-top-button"
            onClick={handleRefreshMemory}
            disabled={isSyncing}
            title="Refresh memory from Google Drive"
          >
            <RotateCw size={15} className={isSyncing ? 'spin' : ''} />
            <span className="btn-text">Refresh</span>
          </button>

          {/* Quick Theme Toggle Button */}
          <button
            type="button"
            className="action-button theme-quick-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <span className="status-pill">
            {isSyncing && <CloudLightning className="status-icon pulse" />}
            {status.includes('Saved') && <CheckCircle className="status-icon success" />}
            {status.includes('Offline') && <WifiOff className="status-icon" />}
            {status}
          </span>

          {token ? (
            <button type="button" className="action-link" onClick={handleLogout} title="Sign out of Google Drive">
              <LogOut size={16} /> <span className="btn-text">Sign out</span>
            </button>
          ) : (
            <button type="button" className="primary-button" onClick={handleLogin}>
              Connect Drive
            </button>
          )}
        </div>
      </header>

      {/* ── Navigation Tabs ── */}
      <div className="view-tabs" role="tablist" aria-label="Primary views">
        <button
          type="button"
          className={`tab-pill ${activeView === 'home' ? 'active' : ''}`}
          onClick={() => setActiveView('home')}
        >
          <BookOpen size={16} /> Home
        </button>
        <button
          type="button"
          className={`tab-pill ${activeView === 'add' ? 'active' : ''}`}
          onClick={() => setActiveView('add')}
        >
          <FilePlus2 size={16} /> Add Thought
        </button>
        <button
          type="button"
          className={`tab-pill ${activeView === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveView('settings')}
        >
          <Settings size={16} /> Settings
        </button>
      </div>

      {/* ── Main View Container ── */}
      <main className="dashboard">
        {activeView === 'home' && (
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
            toggleFavorite={toggleFavorite}
            onRequestDeleteThought={requestDeleteThought}
            onAddThought={() => setActiveView('add')}
            onCopyThought={handleCopyThought}
          />
        )}

        {activeView === 'add' && (
          <section className="composer-page">
            <div className="composer-layout">
              <div className={`capture-card card-color-${formData.cardColor || 'default'}`}>
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">New thought</p>
                    <h2>Add a thought</h2>
                  </div>
                  <div className="chip">{thoughts.length} entries</div>
                </div>

                <form
                  className="entry-form"
                  onSubmit={handleSaveThought}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveThought();
                    }
                  }}
                >
                  <label className="field">
                    <span>Subject</span>
                    <input
                      value={formData.subject}
                      onChange={(event) => setFormData((current) => ({ ...current, subject: event.target.value }))}
                      placeholder="What sparked this thought?"
                      dir="auto"
                    />
                  </label>

                  {/* ── Description with Rich Formatting Toolbar ── */}
                  <div className="field">
                    <span>Description</span>

                    <div className="rich-toolbar" role="toolbar" aria-label="Text formatting tools">
                      <div className="toolbar-group">
                        <button
                          type="button"
                          className={`toolbar-btn ${formData.descriptionAlign === 'left' ? 'active' : ''}`}
                          onClick={() => setFormData((c) => ({ ...c, descriptionAlign: 'left' }))}
                          title="Align left"
                        >
                          <AlignLeft size={14} />
                        </button>
                        <button
                          type="button"
                          className={`toolbar-btn ${formData.descriptionAlign === 'center' ? 'active' : ''}`}
                          onClick={() => setFormData((c) => ({ ...c, descriptionAlign: 'center' }))}
                          title="Align center"
                        >
                          <AlignCenter size={14} />
                        </button>
                        <button
                          type="button"
                          className={`toolbar-btn ${formData.descriptionAlign === 'right' ? 'active' : ''}`}
                          onClick={() => setFormData((c) => ({ ...c, descriptionAlign: 'right' }))}
                          title="Align right"
                        >
                          <AlignRight size={14} />
                        </button>
                        <button
                          type="button"
                          className={`toolbar-btn ${formData.descriptionAlign === 'justify' ? 'active' : ''}`}
                          onClick={() => setFormData((c) => ({ ...c, descriptionAlign: 'justify' }))}
                          title="Justify text"
                        >
                          <AlignJustify size={14} />
                        </button>
                      </div>

                      <div className="toolbar-divider" />

                      <div className="toolbar-group">
                        <button
                          type="button"
                          className={`toolbar-btn ${formData.isBold ? 'active' : ''}`}
                          onClick={() => {
                            if (addTextareaRef.current?.selectionStart !== addTextareaRef.current?.selectionEnd) {
                              handleInsertTag(addTextareaRef, '**', '**', false);
                            } else {
                              setFormData((c) => ({ ...c, isBold: !c.isBold }));
                            }
                          }}
                          title="Bold"
                        >
                          <Bold size={14} />
                        </button>
                        <button
                          type="button"
                          className={`toolbar-btn ${formData.isItalic ? 'active' : ''}`}
                          onClick={() => {
                            if (addTextareaRef.current?.selectionStart !== addTextareaRef.current?.selectionEnd) {
                              handleInsertTag(addTextareaRef, '*', '*', false);
                            } else {
                              setFormData((c) => ({ ...c, isItalic: !c.isItalic }));
                            }
                          }}
                          title="Italic"
                        >
                          <Italic size={14} />
                        </button>
                        <button
                          type="button"
                          className="toolbar-btn"
                          onClick={() => handleInsertTag(addTextareaRef, '\n• ', '', false)}
                          title="Insert bullet point"
                        >
                          <List size={14} />
                        </button>
                        <button
                          type="button"
                          className="toolbar-btn"
                          onClick={() => handleInsertTag(addTextareaRef, '\n> ', '', false)}
                          title="Insert quote block"
                        >
                          <Quote size={14} />
                        </button>
                      </div>

                      <div className="toolbar-divider" />

                      <div className="toolbar-color-group">
                        <span className="toolbar-label" title="Text Color">
                          <Type size={13} />
                        </span>
                        {TEXT_COLORS.map((tc) => (
                          <button
                            key={tc.id}
                            type="button"
                            className={`color-dot-btn ${formData.textColor === tc.id ? 'active' : ''}`}
                            style={{ backgroundColor: tc.color || 'var(--text-primary)' }}
                            onClick={() => setFormData((c) => ({ ...c, textColor: tc.color }))}
                            title={`Text Color: ${tc.label}`}
                          />
                        ))}
                      </div>
                    </div>

                    <textarea
                      ref={addTextareaRef}
                      rows="6"
                      value={formData.description}
                      onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Add deeper notes, reflections, or context... (Supports **bold**, *italic*, bullets •)"
                      dir="auto"
                      style={{
                        textAlign: formData.descriptionAlign || 'right',
                        color: formData.textColor || undefined,
                        fontWeight: formData.isBold ? '700' : 'normal',
                        fontStyle: formData.isItalic ? 'italic' : 'normal',
                      }}
                    />
                    <div className="textarea-footer">
                      <span className="counter-text">{getCounts(formData.description)}</span>
                      <span className="shortcut-hint">Press Ctrl+Enter to save</span>
                    </div>
                  </div>

                  {/* ── Card Background Color Picker ── */}
                  <div className="field">
                    <div className="field-label-row">
                      <span className="flex-label">
                        <Palette size={14} /> Card Background Color
                      </span>
                      <span className="field-hint">Choose background tint for this card</span>
                    </div>

                    <div className="card-color-picker" role="radiogroup" aria-label="Card Background Color">
                      {CARD_COLORS.map((col) => (
                        <button
                          key={col.id}
                          type="button"
                          role="radio"
                          aria-checked={formData.cardColor === col.id}
                          className={`card-color-swatch swatch-${col.id} ${formData.cardColor === col.id ? 'active' : ''}`}
                          onClick={() => setFormData((current) => ({ ...current, cardColor: col.id }))}
                          title={col.label}
                        >
                          <span className="swatch-indicator" />
                          <span className="swatch-name">{col.label}</span>
                          {formData.cardColor === col.id && <Check size={13} className="swatch-check" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Category Selection Chips ── */}
                  <div className="field">
                    <div className="field-label-row">
                      <span>Category</span>
                      <span className="field-hint">Click a category to select it</span>
                    </div>

                    <div className="category-select-chips" role="radiogroup" aria-label="Select category">
                      {categories.map((category) => (
                        <button
                          key={category}
                          type="button"
                          role="radio"
                          aria-checked={formData.category === category}
                          className={`category-select-chip ${formData.category === category ? 'selected' : ''}`}
                          onClick={() => setFormData((current) => ({ ...current, category }))}
                        >
                          <Tag size={13} />
                          {category}
                          {formData.category === category && <Check size={13} className="chip-check" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field-row">
                    <label className="field compact">
                      <span>Date</span>
                      <input
                        type="date"
                        value={formData.entryDate}
                        onChange={(event) => setFormData((current) => ({ ...current, entryDate: event.target.value }))}
                      />
                    </label>

                    <label className="favorite-toggle compact-fav">
                      <input
                        type="checkbox"
                        checked={formData.favorite}
                        onChange={(event) => setFormData((current) => ({ ...current, favorite: event.target.checked }))}
                      />
                      <Star size={16} className={formData.favorite ? 'filled' : ''} /> Mark as Favorite
                    </label>
                  </div>

                  <div className="form-footer">
                    <button type="submit" className="primary-button save-button">
                      <Save size={16} /> Save thought
                    </button>
                  </div>
                </form>
              </div>

              {/* Sidebar Stats */}
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
            </div>
          </section>
        )}

        {activeView === 'settings' && (
          <SettingsView
            theme={theme}
            setTheme={setTheme}
            categories={categories}
            thoughts={thoughts}
            onAddCategory={handleAddCategory}
            onRequestDeleteCategory={requestDeleteCategory}
            token={token}
            status={status}
            isSyncing={isSyncing}
            handleRefreshMemory={handleRefreshMemory}
            handleLogin={handleLogin}
            handleLogout={handleLogout}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onManualToken={handleManualToken}
          />
        )}
      </main>

      {/* ── Preview / Detail Modal ── */}
      {selectedThought && (
        <div className="preview-backdrop" role="dialog" aria-modal="true" onClick={closeSelectedThought}>
          <div
            className={`preview-panel card-color-${selectedThought.cardColor || 'default'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="preview-head">
              <div>
                {isEditingThought && <p className="eyebrow">Edit thought</p>}
                <h3>{selectedThought.subject || 'Untitled thought'}</h3>
              </div>
              <div className="preview-actions">
                {!isEditingThought && (
                  <>
                    <button
                      type="button"
                      className={`action-button copy-post-btn ${copiedThought ? 'copied' : ''}`}
                      onClick={() => handleCopyThought(selectedThought)}
                      aria-label="Copy thought"
                      title="Copy text to clipboard"
                    >
                      {copiedThought ? (
                        <>
                          <Check size={16} /> <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={16} /> <span>Copy Post</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setIsEditingThought(true)}
                      aria-label="Edit thought"
                      title="Edit thought"
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleFavorite(selectedThought.id);
                      }}
                      aria-label="Toggle favorite in preview"
                      title={selectedThought.favorite ? 'Remove favorite' : 'Mark favorite'}
                    >
                      <Star size={17} className={selectedThought.favorite ? 'filled' : ''} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        requestDeleteThought(selectedThought);
                      }}
                      aria-label="Delete thought in preview"
                      title="Delete thought"
                    >
                      <Trash2 size={17} />
                    </button>
                  </>
                )}
                <button type="button" className="icon-button" onClick={closeSelectedThought} aria-label="Close preview">
                  <X size={18} />
                </button>
              </div>
            </div>

            {isEditingThought ? (
              <form
                className="preview-edit-form"
                onSubmit={handleUpdateThought}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleUpdateThought();
                  }
                }}
              >
                <label className="field">
                  <span>Subject</span>
                  <input
                    value={editFormData.subject}
                    onChange={(event) => setEditFormData((current) => ({ ...current, subject: event.target.value }))}
                    placeholder="Thought subject"
                    dir="auto"
                  />
                </label>

                <div className="field">
                  <span>Description</span>
                  <div className="rich-toolbar" role="toolbar" aria-label="Description formatting tools">
                    <div className="toolbar-group">
                      <button
                        type="button"
                        className={`toolbar-btn ${editFormData.descriptionAlign === 'left' ? 'active' : ''}`}
                        onClick={() => setEditFormData((c) => ({ ...c, descriptionAlign: 'left' }))}
                        title="Align left"
                      >
                        <AlignLeft size={14} />
                      </button>
                      <button
                        type="button"
                        className={`toolbar-btn ${editFormData.descriptionAlign === 'center' ? 'active' : ''}`}
                        onClick={() => setEditFormData((c) => ({ ...c, descriptionAlign: 'center' }))}
                        title="Align center"
                      >
                        <AlignCenter size={14} />
                      </button>
                      <button
                        type="button"
                        className={`toolbar-btn ${editFormData.descriptionAlign === 'right' ? 'active' : ''}`}
                        onClick={() => setEditFormData((c) => ({ ...c, descriptionAlign: 'right' }))}
                        title="Align right"
                      >
                        <AlignRight size={14} />
                      </button>
                      <button
                        type="button"
                        className={`toolbar-btn ${editFormData.descriptionAlign === 'justify' ? 'active' : ''}`}
                        onClick={() => setEditFormData((c) => ({ ...c, descriptionAlign: 'justify' }))}
                        title="Justify text"
                      >
                        <AlignJustify size={14} />
                      </button>
                    </div>

                    <div className="toolbar-divider" />

                    <div className="toolbar-group">
                      <button
                        type="button"
                        className={`toolbar-btn ${editFormData.isBold ? 'active' : ''}`}
                        onClick={() => {
                          if (editTextareaRef.current?.selectionStart !== editTextareaRef.current?.selectionEnd) {
                            handleInsertTag(editTextareaRef, '**', '**', true);
                          } else {
                            setEditFormData((c) => ({ ...c, isBold: !c.isBold }));
                          }
                        }}
                        title="Bold"
                      >
                        <Bold size={14} />
                      </button>
                      <button
                        type="button"
                        className={`toolbar-btn ${editFormData.isItalic ? 'active' : ''}`}
                        onClick={() => {
                          if (editTextareaRef.current?.selectionStart !== editTextareaRef.current?.selectionEnd) {
                            handleInsertTag(editTextareaRef, '*', '*', true);
                          } else {
                            setEditFormData((c) => ({ ...c, isItalic: !c.isItalic }));
                          }
                        }}
                        title="Italic"
                      >
                        <Italic size={14} />
                      </button>
                      <button
                        type="button"
                        className="toolbar-btn"
                        onClick={() => handleInsertTag(editTextareaRef, '\n• ', '', true)}
                        title="Bullet point"
                      >
                        <List size={14} />
                      </button>
                      <button
                        type="button"
                        className="toolbar-btn"
                        onClick={() => handleInsertTag(editTextareaRef, '\n> ', '', true)}
                        title="Quote"
                      >
                        <Quote size={14} />
                      </button>
                    </div>

                    <div className="toolbar-divider" />

                    <div className="toolbar-color-group">
                      <span className="toolbar-label" title="Text Color">
                        <Type size={13} />
                      </span>
                      {TEXT_COLORS.map((tc) => (
                        <button
                          key={tc.id}
                          type="button"
                          className={`color-dot-btn ${editFormData.textColor === tc.id ? 'active' : ''}`}
                          style={{ backgroundColor: tc.color || 'var(--text-primary)' }}
                          onClick={() => setEditFormData((c) => ({ ...c, textColor: tc.color }))}
                          title={`Text Color: ${tc.label}`}
                        />
                      ))}
                    </div>
                  </div>

                  <textarea
                    ref={editTextareaRef}
                    rows="7"
                    value={editFormData.description}
                    onChange={(event) => setEditFormData((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Update the thought... (Supports **bold**, *italic*, bullets •)"
                    dir="auto"
                    style={{
                      textAlign: editFormData.descriptionAlign || 'right',
                      color: editFormData.textColor || undefined,
                      fontWeight: editFormData.isBold ? '700' : 'normal',
                      fontStyle: editFormData.isItalic ? 'italic' : 'normal',
                    }}
                  />
                  <div className="textarea-footer">
                    <span className="counter-text">{getCounts(editFormData.description)}</span>
                    <span className="shortcut-hint">Press Ctrl+Enter to save</span>
                  </div>
                </div>

                <div className="field">
                  <div className="field-label-row">
                    <span className="flex-label">
                      <Palette size={14} /> Card Background Color
                    </span>
                  </div>
                  <div className="card-color-picker" role="radiogroup" aria-label="Card Color">
                    {CARD_COLORS.map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        role="radio"
                        aria-checked={editFormData.cardColor === col.id}
                        className={`card-color-swatch swatch-${col.id} ${editFormData.cardColor === col.id ? 'active' : ''}`}
                        onClick={() => setEditFormData((current) => ({ ...current, cardColor: col.id }))}
                        title={col.label}
                      >
                        <span className="swatch-indicator" />
                        <span className="swatch-name">{col.label}</span>
                        {editFormData.cardColor === col.id && <Check size={13} className="swatch-check" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <div className="field-label-row">
                    <span>Category</span>
                    <span className="field-hint">Click a category to select it</span>
                  </div>
                  <div className="category-select-chips" role="radiogroup" aria-label="Select category">
                    {categories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        role="radio"
                        aria-checked={editFormData.category === category}
                        className={`category-select-chip ${editFormData.category === category ? 'selected' : ''}`}
                        onClick={() => setEditFormData((current) => ({ ...current, category }))}
                      >
                        <Tag size={13} />
                        {category}
                        {editFormData.category === category && <Check size={13} className="chip-check" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field-row">
                  <label className="field compact">
                    <span>Date</span>
                    <input
                      type="date"
                      value={editFormData.entryDate}
                      onChange={(event) => setEditFormData((current) => ({ ...current, entryDate: event.target.value }))}
                    />
                  </label>

                  <label className="favorite-toggle compact-fav">
                    <input
                      type="checkbox"
                      checked={editFormData.favorite}
                      onChange={(event) => setEditFormData((current) => ({ ...current, favorite: event.target.checked }))}
                    />
                    <Star size={16} className={editFormData.favorite ? 'filled' : ''} /> Favorite
                  </label>
                </div>

                <div className="form-footer">
                  <div className="preview-edit-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setEditFormData(makeEditForm(selectedThought, categories));
                        setIsEditingThought(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="primary-button save-button">
                      <Save size={16} /> Save changes
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="preview-content">
                <div
                  className="preview-description"
                  dir="auto"
                  style={{
                    textAlign: selectedThought.descriptionAlign || 'right',
                    color: selectedThought.textColor || undefined,
                    fontWeight: selectedThought.isBold ? '700' : undefined,
                    fontStyle: selectedThought.isItalic ? 'italic' : undefined,
                  }}
                >
                  {renderFormattedContent(selectedThought.description)}
                </div>

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
                  {selectedThought.cardColor && selectedThought.cardColor !== 'default' && (
                    <div className="preview-meta-item">
                      <span>Card Style</span>
                      <strong style={{ textTransform: 'capitalize' }}>{selectedThought.cardColor}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Global Confirm Deletion Modal ── */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        onConfirm={() => {
          if (confirmModal.action) confirmModal.action();
        }}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
