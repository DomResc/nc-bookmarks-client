import React, { useState } from 'react';
import { DarkMode } from '../../types';
import { NC_BLUE } from '../../utils/constants';
import { NEXT_MODE, MODE_LABEL } from '../../utils/theme';
import Spinner from './Spinner';

interface SetupScreenProps {
  onStartLogin: (serverUrl: string) => Promise<void>;
  onCancelLogin: () => void;
  loginState: 'idle' | 'connecting' | 'waiting' | 'error';
  loginError?: string;
  darkMode: DarkMode;
  resolvedDark: boolean;
  onToggleDarkMode: () => void;
}

export default function SetupScreen({ onStartLogin, onCancelLogin, loginState, loginError, darkMode, resolvedDark, onToggleDarkMode }: SetupScreenProps) {
  const [serverUrl, setServerUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const currentLabel = darkMode === 'auto' ? `auto (${resolvedDark ? 'dark' : 'light'})` : MODE_LABEL[darkMode];
  const themeTitle = `Theme: ${currentLabel} — click to switch to ${MODE_LABEL[NEXT_MODE[darkMode]]}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!serverUrl.trim()) { setError('Enter your Nextcloud server URL'); return; }
    let urlObj: URL;
    try { urlObj = new URL(serverUrl.trim()); } catch { setError('Invalid server URL. Use the format https://nextcloud.example.com'); return; }
    if (urlObj.protocol !== 'https:') { setError('An HTTPS URL is required for security reasons'); return; }
    const granted = await chrome.permissions.request({ origins: [`${urlObj.origin}/*`] });
    if (!granted) { setError('Permission denied. Unable to connect to the server.'); return; }
    setError(null);
    await onStartLogin(serverUrl.trim());
  }

  const displayError = error || loginError;

  return (
    <div className="h-full flex flex-col items-center justify-center p-6">
      <div className="flex items-center justify-end w-full mb-4">
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
          title={themeTitle}
        >
          {darkMode === 'dark' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : darkMode === 'light' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          )}
        </button>
      </div>

      <img src="icons/icon-128.png" alt="" width={64} height={64} className="mb-4" />

      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">NC Bookmarks</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
        Connect your Nextcloud server to access your bookmarks
      </p>

      {loginState === 'idle' ? (
        <form onSubmit={handleSubmit} className="w-full space-y-3">
          <div>
            <label htmlFor="serverUrl" className="sr-only">Nextcloud server URL</label>
            <input id="serverUrl" type="url" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://nextcloud.example.com" autoFocus
              className="input-field w-full" />
          </div>
          {displayError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-xs leading-relaxed">{displayError}</div>
          )}
          <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
            Connect
          </button>
        </form>
      ) : loginState === 'connecting' ? (
        <div className="flex flex-col items-center gap-4">
          <Spinner size={32} color={NC_BLUE} />
          <p className="text-sm text-gray-500 dark:text-gray-400">Connecting to the server...</p>
        </div>
      ) : loginState === 'waiting' ? (
        <div className="flex flex-col items-center gap-4 w-full">
          <Spinner size={32} color={NC_BLUE} />
          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium text-center">Log in on Nextcloud</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            A tab has been opened for authentication.<br />Complete the login on Nextcloud, then come back here.
          </p>
          <button onClick={onCancelLogin} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline mt-2">Cancel</button>
        </div>
      ) : loginState === 'error' ? (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">Access denied</p>
          {displayError && <p className="text-xs text-gray-500 dark:text-gray-400 text-center">{displayError}</p>}
          <button onClick={onCancelLogin} className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 underline mt-1">Try again</button>
        </div>
      ) : null}
    </div>
  );
}
