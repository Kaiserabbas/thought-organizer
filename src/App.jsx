import React, { useState, useEffect, useRef } from 'react';
import { GoogleDriveService } from './googleDrive';
import { Brain, CloudLightning, Save, Search, LogOut, CheckCircle, WifiOff } from 'lucide-react';

// TODO: Replace with your actual client ID from Google Cloud Console
const CLIENT_ID = "574535920766-ntjn0mr37h07sd3l1n5c3o2j4na7bqok.apps.googleusercontent.com"; 

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('gdrive_token') || null);
  const [thoughts, setThoughts] = useState(JSON.parse(localStorage.getItem('cached_thoughts')) || []);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState('Idle'); // Idle, Syncing, Saved, Error
  const [fileId, setFileId] = useState(null);
  const tokenClientRef = useRef(null);

  // Initialize Google Identity Services
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
            setStatus('Connected');
          },
        });
        return true;
      }
      return false;
    };

    // Try immediately — GIS might already be loaded
    if (initGoogle()) return;

    // Otherwise wait for it to load
    const interval = setInterval(() => {
      if (initGoogle()) clearInterval(interval);
    }, 200);

    return () => clearInterval(interval);
  }, []);

  // Sync data automatically whenever a valid token is established
  useEffect(() => {
    if (token) {
      syncWithDrive();
    }
  }, [token]);

  // Persist to local storage as fallback/cache
  useEffect(() => {
    localStorage.setItem('cached_thoughts', JSON.stringify(thoughts));
  }, [thoughts]);

  const handleLogin = () => {
    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gdrive_token');
    setToken(null);
    setFileId(null);
    setStatus('Idle');
  };

  const syncWithDrive = async (currentThoughts = thoughts) => {
    if (!token) return;
    setStatus('Syncing...');
    try {
      const folderId = await GoogleDriveService.getOrCreateFolder(token);
      const { fileId: activeFileId, isNew } = await GoogleDriveService.getOrCreateDataFile(token, folderId);
      setFileId(activeFileId);

      if (isNew) {
        await GoogleDriveService.uploadThoughts(token, activeFileId, currentThoughts);
      } else {
        const driveThoughts = await GoogleDriveService.downloadThoughts(token, activeFileId);
        // Merge strategy: prioritize local if newer or combine uniquely
        const merged = mergeThoughts(currentThoughts, driveThoughts);
        setThoughts(merged);
        await GoogleDriveService.uploadThoughts(token, activeFileId, merged);
      }
      setStatus('Saved');
    } catch (err) {
      console.error(err);
      setStatus('Sync Error');
    }
  };

  const mergeThoughts = (local, remote) => {
    const map = new Map();
    remote.forEach(t => map.set(t.id, t));
    local.forEach(t => map.set(t.id, t)); // Local overrides or updates matching IDs
    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  };

  const handleSaveThought = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newThought = {
      id: crypto.randomUUID(),
      text: inputText.trim(),
      timestamp: Date.now(),
    };

    const updatedThoughts = [newThought, ...thoughts];
    setThoughts(updatedThoughts);
    setInputText('');

    if (token) {
      await syncWithDrive(updatedThoughts);
    } else {
      setStatus('Saved Locally (Offline)');
    }
  };

  const filteredThoughts = thoughts.filter(t =>
    t.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex justify-between items-center max-w-4xl w-full mx-auto">
        <div className="flex items-center gap-2">
          <Brain className="w-6 h-6 text-emerald-400" />
          <h1 className="text-xl font-bold tracking-tight">MindVault</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full flex items-center gap-1.5">
            {status === 'Syncing...' && <CloudLightning className="w-3 py-3 animate-pulse text-amber-400" />}
            {status === 'Saved' && <CheckCircle className="w-3 h-3 text-emerald-400" />}
            {status.includes('Offline') && <WifiOff className="w-3 h-3 text-slate-400" />}
            {status}
          </span>
          {token ? (
            <button onClick={handleLogout} className="text-slate-400 hover:text-rose-400 transition flex items-center gap-1 text-sm">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          ) : (
            <button onClick={handleLogin} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-4 py-1.5 rounded-lg transition text-sm">
              Connect Google Drive
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-8 flex flex-col gap-8">
        
        {/* Quick Capture Input Box */}
        <form onSubmit={handleSaveThought} className="relative bg-slate-800 rounded-xl border border-slate-700 shadow-xl focus-within:border-emerald-500 transition-colors duration-200">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="A thought sparks... type it here and press save"
            className="w-full bg-transparent border-0 ring-0 outline-none focus:ring-0 p-4 min-h-[120px] resize-none placeholder-slate-500 text-lg text-slate-100"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSaveThought(e);
              }
            }}
          />
          <div className="flex justify-between items-center border-t border-slate-700/60 px-4 py-2.5 bg-slate-850 rounded-b-xl">
            <span className="text-xs text-slate-500">Press <kbd className="bg-slate-700 px-1 rounded">Enter</kbd> to save quickly</span>
            <button type="submit" className="bg-slate-700 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 p-2 rounded-lg transition-all flex items-center gap-2 text-sm font-medium">
              <Save className="w-4 h-4" /> Capture
            </button>
          </div>
        </form>

        {/* Search & Timeline Filters */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search past thoughts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700 transition"
            />
          </div>

          {/* Thought Timeline stream */}
          <div className="space-y-3">
            {filteredThoughts.length === 0 ? (
              <p className="text-center text-slate-600 py-8 text-sm">No thoughts found. Start sketching your mind above.</p>
            ) : (
              filteredThoughts.map((thought) => (
                <div key={thought.id} className="bg-slate-800/30 border border-slate-800/80 rounded-lg p-4 relative group hover:border-slate-700/60 transition">
                  <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{thought.text}</p>
                  <span className="block text-[10px] text-slate-500 mt-2">
                    {new Date(thought.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
