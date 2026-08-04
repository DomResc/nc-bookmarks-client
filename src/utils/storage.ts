import { Bookmark, Folder, Config } from '../types';
import { decrypt, encrypt } from './crypto';

export async function getConfig(): Promise<Config | null> {
  const result = await chrome.storage.local.get(['serverUrl', 'username', 'password']);
  if (!result.serverUrl || !result.username || !result.password) return null;
  return {
    serverUrl: result.serverUrl,
    username: result.username,
    password: await decrypt(result.password),
  };
}

export async function saveConfig(config: Config): Promise<void> {
  await chrome.storage.local.set({
    serverUrl: config.serverUrl,
    username: config.username,
    password: await encrypt(config.password),
  });
}

export async function updateCache(bookmarks: Bookmark[], folders?: Folder[]): Promise<void> {
  const data: Record<string, unknown> = { bookmarks, lastSync: Date.now() };
  if (folders) data.folders = folders;
  await chrome.storage.local.set(data);
}

export async function clearCache(): Promise<void> {
  await chrome.storage.local.remove(['bookmarks', 'folders', 'lastSync', 'favicons']);
}

export async function clearConfig(): Promise<void> {
  await chrome.storage.local.remove(['serverUrl', 'username', 'password']);
}
