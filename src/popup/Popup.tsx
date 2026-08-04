import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Bookmark, Folder, DarkMode, MessageResponse, LoginFlowState } from '../types';
import { SYNC_INTERVAL_MS, TOAST_DURATION_MS } from '../utils/constants';
import { applyTheme, resolveDark, DARK_MODE_CYCLE } from '../utils/theme';
import { formatRelativeTime } from '../utils/format';
import SetupScreen from './components/SetupScreen';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import BookmarkList from './components/BookmarkList';
import AddBookmarkModal from './components/AddBookmarkModal';
import EditBookmarkModal from './components/EditBookmarkModal';
import ConfirmDialog from './components/ConfirmDialog';
import RenameFolderModal from './components/RenameFolderModal';
import Toast from './components/Toast';

function sendMessage(action: string, payload?: Record<string, unknown>): Promise<MessageResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as MessageResponse);
      }
    });
  });
}

export default function Popup() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [darkMode, setDarkMode] = useState<DarkMode>('auto');
  const [resolvedDark, setResolvedDark] = useState<boolean>(() => resolveDark('auto'));

  // Login flow state
  const [loginState, setLoginState] = useState<'idle' | 'connecting' | 'waiting' | 'error'>('idle');
  const [loginError, setLoginError] = useState<string | undefined>(undefined);
  const loginTabRef = useRef<number | null>(null);

  // Edit/delete state
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [deletingBookmark, setDeletingBookmark] = useState<Bookmark | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const darkModeRef = useRef(darkMode);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalOpenRef = useRef(false);
  modalOpenRef.current = showAddModal || !!editingBookmark || !!deletingBookmark || !!renamingFolder || !!deletingFolder;

  darkModeRef.current = darkMode;

  function syncTheme(mode: DarkMode) {
    applyTheme(mode);
    setResolvedDark(resolveDark(mode));
  }

  function showToast(message: string, type: 'success' | 'error' | 'warning') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }

  async function refreshData() {
    const cache = await chrome.storage.local.get(['bookmarks', 'folders', 'lastSync']);
    if (cache.bookmarks) { setBookmarks(cache.bookmarks); setLastSync(cache.lastSync || null); }
    if (cache.folders) setFolders(cache.folders);
  }

  const loadFromCache = useCallback(async () => {
    await refreshData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const [local, sync] = await Promise.all([
        chrome.storage.local.get(['serverUrl', 'username', 'password']),
        chrome.storage.sync.get(['darkMode']),
      ]);
      if (cancelled) return;
      const mode = (sync.darkMode as DarkMode) || 'auto';
      setDarkMode(mode);
      syncTheme(mode);
      if (local.serverUrl && local.username && local.password) {
        setConfigured(true);
        try {
          await loadFromCache();
          if (cancelled) return;
          setLoading(false);
          const cache = await chrome.storage.local.get('lastSync');
          const stale = !cache.lastSync || cache.lastSync < Date.now() - SYNC_INTERVAL_MS;
          if (stale) {
            setSyncing(true);
            sendMessage('SYNC')
              .then((res) => {
                if (res.success && res.data) {
                  const d = res.data as { bookmarks: Bookmark[]; folders: Folder[]; lastSync: number };
                  setBookmarks(d.bookmarks); setFolders(d.folders || []); setLastSync(d.lastSync);
                }
              })
              .catch(() => { /* silent */ })
              .finally(() => setSyncing(false));
          }
        } catch { if (!cancelled) setLoading(false); }
      } else {
        setConfigured(false);
        setLoading(false);
        const session = await chrome.storage.session.get('loginFlow');
        const flow = session.loginFlow as LoginFlowState | undefined;
        if (!cancelled && flow?.status === 'pending') {
          setLoginState('waiting');
          // Forces an immediate check instead of waiting for the next alarm
          // tick (up to 1 minute): the alarm still acts as the fallback
          // mechanism if the popup isn't reopened.
          sendMessage('CHECK_LOGIN_NOW').catch(() => { /* silent */ });
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, [loadFromCache]);

  useEffect(() => {
    function onStorageChanged(changes: Record<string, chrome.storage.StorageChange>, area: string) {
      if (area === 'local' && changes.username?.newValue && changes.password?.newValue) {
        setConfigured(true); setLoading(false); loadFromCache();
      }
      if (area === 'sync' && changes.darkMode?.newValue) {
        const mode = changes.darkMode.newValue as DarkMode; setDarkMode(mode); syncTheme(mode);
      }
      if (area === 'session' && changes.loginFlow) {
        const flow = changes.loginFlow.newValue as LoginFlowState | undefined;
        if (flow?.status === 'timeout' || flow?.status === 'error') {
          setLoginState('error');
          setLoginError(flow.error || 'Time expired. The login was not completed.');
          chrome.storage.session.remove('loginFlow');
        }
      }
    }
    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => chrome.storage.onChanged.removeListener(onStorageChanged);
  }, [loadFromCache]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if (darkModeRef.current === 'auto') syncTheme('auto'); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (modalOpenRef.current) return;
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    }
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleStartLogin = useCallback(async (serverUrl: string) => {
    setLoginState('connecting');
    setLoginError(undefined);
    try {
      const response = await sendMessage('INIT_LOGIN_FLOW', { serverUrl });
      if (!response.success) throw new Error(response.error || 'Unable to start the login flow');
      const data = response.data as { loginUrl: string };
      const tab = await chrome.tabs.create({ url: data.loginUrl, active: true });
      loginTabRef.current = tab.id ?? null;
      setLoginState('waiting');
    } catch (err: unknown) {
      setLoginState('error');
      setLoginError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const handleCancelLogin = useCallback(() => {
    sendMessage('CANCEL_LOGIN_FLOW').catch(() => { /* silent */ });
    if (loginTabRef.current) { try { chrome.tabs.remove(loginTabRef.current); } catch { /* empty */ } loginTabRef.current = null; }
    setLoginState('idle');
    setLoginError(undefined);
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true); setError(null);
    try {
      const response = await sendMessage('SYNC');
      if (response.success && response.data) {
        const d = response.data as { bookmarks: Bookmark[]; folders: Folder[]; lastSync: number };
        setBookmarks(d.bookmarks); setFolders(d.folders || []); setLastSync(d.lastSync);
        showToast('Sync complete!', 'success');
      } else setError(response.error || 'Error during sync');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Connection error'); }
    finally { setSyncing(false); }
  }, []);

  const handleAddBookmark = useCallback(async (data: { title: string; url: string; tags: string; folders: string }) => {
    const response = await sendMessage('ADD_BOOKMARK', data);
    if (response.success) { await refreshData(); showToast('Bookmark added!', 'success'); }
    else throw new Error(response.error || 'Error adding the bookmark');
  }, []);

  const handleCreateFolder = useCallback(async (title: string, parentFolderId: number) => {
    const response = await sendMessage('CREATE_FOLDER', { title, parentFolderId });
    if (response.success && response.data) {
      const d = response.data as { id: number; bookmarks: Bookmark[]; folders: Folder[] };
      setBookmarks(d.bookmarks); setFolders(d.folders || []);
      return d.id;
    }
    throw new Error(response.error || 'Error creating the folder');
  }, []);

  const handleEditBookmark = useCallback(async (data: { id: number; title: string; url: string; tags: string; folders: string }) => {
    const response = await sendMessage('EDIT_BOOKMARK', data as unknown as Record<string, unknown>);
    if (response.success) {
      if (response.data) {
        const d = response.data as { bookmarks: Bookmark[]; folders: Folder[] };
        setBookmarks(d.bookmarks); setFolders(d.folders || []);
      } else {
        await refreshData();
      }
      setEditingBookmark(null); showToast('Bookmark updated!', 'success');
    } else throw new Error(response.error || 'Error editing the bookmark');
  }, []);

  const handleDeleteBookmarkConfirm = useCallback(async () => {
    if (!deletingBookmark) return;
    const response = await sendMessage('DELETE_BOOKMARK', { id: deletingBookmark.id });
    if (response.success) { await refreshData(); setDeletingBookmark(null); showToast('Bookmark deleted!', 'success'); }
    else { showToast(response.error || 'Error during deletion', 'error'); setDeletingBookmark(null); }
  }, [deletingBookmark]);

  const handleRenameFolderConfirm = useCallback(async () => {
    if (!renamingFolder || !renameValue.trim()) return;
    const response = await sendMessage('RENAME_FOLDER', { id: renamingFolder.id, title: renameValue.trim() });
    if (response.success) { await refreshData(); setRenamingFolder(null); setRenameValue(''); showToast('Folder renamed!', 'success'); }
    else { showToast(response.error || 'Error during rename', 'error'); setRenamingFolder(null); setRenameValue(''); }
  }, [renamingFolder, renameValue]);

  const handleDeleteFolderConfirm = useCallback(async () => {
    if (!deletingFolder) return;
    const response = await sendMessage('DELETE_FOLDER', { id: deletingFolder.id });
    if (response.success) {
      await refreshData(); setDeletingFolder(null);
      if (response.warning) {
        showToast(response.warning, 'warning');
      } else {
        showToast('Folder deleted!', 'success');
      }
    } else {
      await refreshData();
      showToast(response.error || 'Error during deletion', 'error');
      setDeletingFolder(null);
    }
  }, [deletingFolder]);

  const handleLogout = useCallback(async () => {
    await sendMessage('LOGOUT');
    setConfigured(false); setBookmarks([]); setFolders([]); setLastSync(null); setSearchQuery(''); setError(null);
    showToast('Logged out', 'success');
  }, []);

  const handleToggleDarkMode = useCallback(() => {
    const newMode = DARK_MODE_CYCLE[(DARK_MODE_CYCLE.indexOf(darkMode) + 1) % DARK_MODE_CYCLE.length];
    setDarkMode(newMode); syncTheme(newMode); chrome.storage.sync.set({ darkMode: newMode });
  }, [darkMode]);

  const handleSearch = useCallback((query: string) => { setSearchQuery(query); }, []);

  const foldersById = useMemo(() => {
    const map = new Map<number, string>();
    for (const f of folders) map.set(Number(f.id), f.title);
    return map;
  }, [folders]);

  // The cache stores folder IDs. Entries coming from an older cache version
  // may still be titles: normalize everything to IDs, dropping references to
  // folders that no longer exist.
  const normalizedBookmarks = useMemo(() => {
    const titleToId = new Map<string, number>();
    for (const f of folders) if (!titleToId.has(f.title)) titleToId.set(f.title, f.id);
    return bookmarks.map((b) => ({
      ...b,
      folders: b.folders.map((f) => {
        if (typeof f === 'number') return foldersById.has(f) ? f : null;
        const n = Number(f);
        if (f.trim() !== '' && !isNaN(n) && String(n) === f.trim()) {
          return foldersById.has(n) ? n : null;
        }
        const id = titleToId.get(f);
        return id !== undefined ? id : null;
      }).filter((f): f is number => f !== null),
    }));
  }, [bookmarks, folders, foldersById]);

  const filteredBookmarks = !searchQuery
    ? normalizedBookmarks
    : normalizedBookmarks.filter((b) => {
        const q = searchQuery.toLowerCase();
        return b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q) ||
          b.tags.some((t) => t.toLowerCase().includes(q)) ||
          b.folders.some((id) => (foldersById.get(id) || '').toLowerCase().includes(q));
      });

  if (loading) {
    return (
      <div className="w-[400px] h-[600px] flex flex-col bg-white dark:bg-gray-900">
        <div className="flex items-center justify-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <img src="icons/icon-128.png" alt="" width={28} height={28} className="shrink-0" />
          <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
        <div className="flex-1 p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-gray-50 dark:bg-gray-800/50 animate-pulse" />
              <div className="flex gap-1">
                <div className="h-5 w-12 rounded-full bg-gray-50 dark:bg-gray-800/50 animate-pulse" />
                <div className="h-5 w-16 rounded-full bg-gray-50 dark:bg-gray-800/50 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="w-[400px] h-[600px] bg-white dark:bg-gray-900">
        <SetupScreen
          onStartLogin={handleStartLogin}
          onCancelLogin={handleCancelLogin}
          loginState={loginState}
          loginError={loginError}
          darkMode={darkMode}
          resolvedDark={resolvedDark}
          onToggleDarkMode={handleToggleDarkMode}
        />
      </div>
    );
  }

  return (
    <>
    <div className="w-[400px] h-[600px] flex flex-col bg-white dark:bg-gray-900 relative overflow-hidden">
      <Header syncing={syncing} darkMode={darkMode} resolvedDark={resolvedDark} onSync={handleSync} onLogout={handleLogout} onToggleDarkMode={handleToggleDarkMode} />

      <SearchBar ref={searchInputRef} onSearch={handleSearch} />

      {error && (
        <div className="mx-3 mb-1 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-xs flex items-start justify-between gap-2 shrink-0">
          <span className="leading-relaxed">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-200 shrink-0" aria-label="Dismiss error">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <BookmarkList
          bookmarks={filteredBookmarks}
          searchQuery={searchQuery}
          grouped={!searchQuery}
          folders={folders}
          onEditBookmark={setEditingBookmark}
          onDeleteBookmark={setDeletingBookmark}
          onRenameFolder={(f) => { setRenamingFolder(f); setRenameValue(f.title); }}
          onDeleteFolder={setDeletingFolder}
        />
      </div>

      <div className="px-4 py-1.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
        <span>{bookmarks.length} {bookmarks.length === 1 ? 'bookmark' : 'bookmarks'}</span>
        <span>{lastSync ? `Synced ${formatRelativeTime(lastSync)}` : 'Never synced'}</span>
      </div>

      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
        <button onClick={() => setShowAddModal(true)} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
          + Add this page
        </button>
      </div>

    </div>

      {showAddModal && (
        <AddBookmarkModal folders={folders} onClose={() => setShowAddModal(false)} onSave={handleAddBookmark} onCreateFolder={handleCreateFolder} />
      )}

      {editingBookmark && (
        <EditBookmarkModal bookmark={editingBookmark} folders={folders} onClose={() => setEditingBookmark(null)} onSave={handleEditBookmark} onCreateFolder={handleCreateFolder} />
      )}

      {deletingBookmark && (
        <ConfirmDialog
          title="Delete bookmark"
          message={`Delete "${deletingBookmark.title}"?`}
          onConfirm={handleDeleteBookmarkConfirm}
          onCancel={() => setDeletingBookmark(null)}
        />
      )}

      {renamingFolder && (
        <RenameFolderModal
          value={renameValue}
          onChange={setRenameValue}
          onSave={handleRenameFolderConfirm}
          onCancel={() => { setRenamingFolder(null); setRenameValue(''); }}
        />
      )}

      {deletingFolder && (
        <ConfirmDialog
          title="Delete folder"
          message={`Delete "${deletingFolder.title}"? The folder and everything inside it will be deleted.`}
          confirmLabel="Delete folder"
          onConfirm={handleDeleteFolderConfirm}
          onCancel={() => setDeletingFolder(null)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  );
}
