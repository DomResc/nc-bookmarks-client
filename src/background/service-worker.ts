import { Bookmark, Folder, Message, MessageResponse, LoginFlowState } from '../types';
import { getConfig, saveConfig, updateCache, clearCache, clearConfig } from '../utils/storage';
import { POLL_TIMEOUT_MS, LOGIN_ALARM_PERIOD_MINUTES, FAVICON_TTL_MS } from '../utils/constants';
import {
  fetchBookmarks,
  fetchFolders,
  addBookmark as apiAddBookmark,
  updateBookmark as apiUpdateBookmark,
  deleteBookmark as apiDeleteBookmark,
  renameFolder as apiRenameFolder,
  deleteFolder as apiDeleteFolder,
  createFolder as apiCreateFolder,
  getCredentials,
  initiateLoginFlow as apiInitiateLoginFlow,
  pollLoginFlow as apiPollLoginFlow,
  fetchFaviconDataUrl,
} from '../utils/api';

const LOGIN_ALARM_NAME = 'login-poll';

// Bookmarks are cached with folder IDs (not titles): titles are not unique
// across the tree, so grouping by ID is the only unambiguous option. The
// popup resolves titles for display via the cached folder list.
function resolveBookmarkFolderIds(bookmarks: Bookmark[], folders: Folder[]): Bookmark[] {
  const validIds = new Set<number>();
  const titleToId = new Map<string, number>();
  for (const f of folders) {
    validIds.add(f.id);
    if (!titleToId.has(f.title)) titleToId.set(f.title, f.id);
  }
  return bookmarks.map((b) => {
    const ids = new Set<number>();
    for (const f of b.folders) {
      if (typeof f === 'number') {
        if (validIds.has(f)) ids.add(f);
      } else {
        const id = titleToId.get(f);
        if (id !== undefined) ids.add(id);
      }
    }
    return { ...b, folders: Array.from(ids) };
  });
}

async function finalizeLogin(
  serverUrl: string,
  username: string,
  password: string
): Promise<{ bookmarks: Bookmark[]; folders: Folder[]; lastSync: number }> {
  const credentials = getCredentials(username, password);
  const [rawBookmarks, folders] = await Promise.all([
    fetchBookmarks(serverUrl, credentials),
    fetchFolders(serverUrl, credentials),
  ]);

  const bookmarks = resolveBookmarkFolderIds(rawBookmarks, folders);

  await updateCache(bookmarks, folders);
  await saveConfig({ serverUrl, username, password });

  return { bookmarks, folders, lastSync: Date.now() };
}

async function handleSync(): Promise<MessageResponse> {
  try {
    const config = await getConfig();
    if (!config) {
      return { success: false, error: 'Configuration not found. Please complete setup.' };
    }

    const credentials = getCredentials(config.username, config.password);
    const [rawBookmarks, folders] = await Promise.all([
      fetchBookmarks(config.serverUrl, credentials),
      fetchFolders(config.serverUrl, credentials),
    ]);

    const bookmarks = resolveBookmarkFolderIds(rawBookmarks, folders);
    await updateCache(bookmarks, folders);

    return { success: true, data: { bookmarks, folders, lastSync: Date.now() } as unknown as Record<string, unknown> };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error during sync';
    return { success: false, error: message };
  }
}

function parseFolderInput(value: string): (string | number)[] {
  const items = value.split(',').map((f) => f.trim()).filter(Boolean).map((f) => {
    const n = Number(f);
    return !isNaN(n) && String(n) === f ? n : f;
  });
  return items;
}

async function handleAddBookmark(payload: Record<string, unknown>): Promise<MessageResponse> {
  try {
    const config = await getConfig();
    if (!config) return { success: false, error: 'Configuration not found.' };

    const title = payload.title as string;
    const url = payload.url as string;
    const tagsStr = payload.tags as string;
    const foldersStr = payload.folders as string;
    const tags = tagsStr ? tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined;
    const folderEntries = foldersStr ? parseFolderInput(foldersStr) : undefined;

    const credentials = getCredentials(config.username, config.password);
    const body: { title: string; url: string; tags?: string[]; folders?: (string | number)[] } = { title, url };
    if (tags && tags.length > 0) body.tags = tags;
    if (folderEntries && folderEntries.length > 0) body.folders = folderEntries;

    await apiAddBookmark(config.serverUrl, credentials, body);

    const [rawBookmarks, folders] = await Promise.all([
      fetchBookmarks(config.serverUrl, credentials),
      fetchFolders(config.serverUrl, credentials),
    ]);
    const bookmarks = resolveBookmarkFolderIds(rawBookmarks, folders);
    await updateCache(bookmarks, folders);
    return { success: true, data: { bookmarks, folders } as unknown as Record<string, unknown> };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error adding the bookmark';
    return { success: false, error: message };
  }
}

async function handleEditBookmark(payload: Record<string, unknown>): Promise<MessageResponse> {
  try {
    const config = await getConfig();
    if (!config) return { success: false, error: 'Configuration not found.' };

    const id = Number(payload.id);
    const title = payload.title as string;
    const url = payload.url as string;
    const tagsStr = payload.tags as string;
    const foldersStr = payload.folders as string;
    const credentials = getCredentials(config.username, config.password);

    const body: { title?: string; url?: string; tags?: string[]; folders?: (string | number)[] } = {};
    if (title) body.title = title;
    if (url) body.url = url;
    // Explicit undefined checks: an empty string means the user cleared the
    // field, so an empty array must be sent to remove tags/folders server-side.
    if (tagsStr !== undefined) body.tags = tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean);
    if (foldersStr !== undefined) body.folders = parseFolderInput(foldersStr);

    await apiUpdateBookmark(config.serverUrl, credentials, id, body);

    const [rawBookmarks, folders] = await Promise.all([
      fetchBookmarks(config.serverUrl, credentials),
      fetchFolders(config.serverUrl, credentials),
    ]);
    const bookmarks = resolveBookmarkFolderIds(rawBookmarks, folders);
    await updateCache(bookmarks, folders);
    return { success: true, data: { bookmarks, folders } as unknown as Record<string, unknown> };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error editing the bookmark';
    return { success: false, error: message };
  }
}

async function handleDeleteBookmark(payload: Record<string, unknown>): Promise<MessageResponse> {
  try {
    const config = await getConfig();
    if (!config) return { success: false, error: 'Configuration not found.' };

    const id = Number(payload.id);
    const credentials = getCredentials(config.username, config.password);
    await apiDeleteBookmark(config.serverUrl, credentials, id);

    const [rawBookmarks, folders] = await Promise.all([
      fetchBookmarks(config.serverUrl, credentials),
      fetchFolders(config.serverUrl, credentials),
    ]);
    const bookmarks = resolveBookmarkFolderIds(rawBookmarks, folders);
    await updateCache(bookmarks, folders);
    return { success: true, data: { bookmarks, folders } as unknown as Record<string, unknown> };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error deleting the bookmark';
    return { success: false, error: message };
  }
}

async function handleRenameFolder(payload: Record<string, unknown>): Promise<MessageResponse> {
  try {
    const config = await getConfig();
    if (!config) return { success: false, error: 'Configuration not found.' };

    const id = Number(payload.id);
    const title = payload.title as string;
    const credentials = getCredentials(config.username, config.password);
    await apiRenameFolder(config.serverUrl, credentials, id, title);

    const [rawBookmarks, folders] = await Promise.all([
      fetchBookmarks(config.serverUrl, credentials),
      fetchFolders(config.serverUrl, credentials),
    ]);
    const bookmarks = resolveBookmarkFolderIds(rawBookmarks, folders);
    await updateCache(bookmarks, folders);
    return { success: true, data: { bookmarks, folders } as unknown as Record<string, unknown> };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error renaming the folder';
    return { success: false, error: message };
  }
}

async function handleDeleteFolder(payload: Record<string, unknown>): Promise<MessageResponse> {
  try {
    const config = await getConfig();
    if (!config) return { success: false, error: 'Configuration not found.' };

    const id = Number(payload.id);
    const credentials = getCredentials(config.username, config.password);
    await apiDeleteFolder(config.serverUrl, credentials, id);

    try {
      const [rawBookmarks, folders] = await Promise.all([
        fetchBookmarks(config.serverUrl, credentials),
        fetchFolders(config.serverUrl, credentials),
      ]);
      const bookmarks = resolveBookmarkFolderIds(rawBookmarks, folders);
      await updateCache(bookmarks, folders);
      return { success: true, data: { bookmarks, folders } as unknown as Record<string, unknown> };
    } catch {
      // Delete succeeded but re-fetch failed — update cache with stale data
      // by manually removing the deleted folder and its descendants.
      const cache = await chrome.storage.local.get(['bookmarks', 'folders']);
      const cachedFolders = (cache.folders || []) as Folder[];
      const cachedBookmarks = (cache.bookmarks || []) as Bookmark[];

      const removedIds = new Set<number>([id]);
      const folderById = new Map(cachedFolders.map(f => [f.id, f]));

      let added = true;
      while (added) {
        added = false;
        for (const f of cachedFolders) {
          if (removedIds.has(f.parentFolderId) && !removedIds.has(f.id)) {
            removedIds.add(f.id);
            added = true;
          }
        }
      }

      const removedTitles = new Set<string>();
      for (const rid of removedIds) {
        const f = folderById.get(rid);
        if (f) removedTitles.add(f.title);
      }

      const updatedFolders = cachedFolders.filter(f => !removedIds.has(f.id));
      const updatedBookmarks = cachedBookmarks.map(b => ({
        ...b,
        folders: b.folders.filter(f => {
          if (typeof f === 'number') return !removedIds.has(f);
          return !removedTitles.has(f as string);
        }),
      }));

      await updateCache(updatedBookmarks, updatedFolders);
      return {
        success: true,
        warning: 'Sync incomplete — some data may be stale until the next manual sync.',
        data: { bookmarks: updatedBookmarks, folders: updatedFolders } as unknown as Record<string, unknown>,
      };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error deleting the folder';
    return { success: false, error: message };
  }
}

async function handleCreateFolder(payload: Record<string, unknown>): Promise<MessageResponse> {
  try {
    const config = await getConfig();
    if (!config) return { success: false, error: 'Configuration not found.' };
    const title = ((payload.title as string) || '').trim();
    if (!title) return { success: false, error: 'Folder name is required.' };
    const parentFolderId = payload.parentFolderId != null ? Number(payload.parentFolderId) : -1;
    const credentials = getCredentials(config.username, config.password);
    const created = await apiCreateFolder(config.serverUrl, credentials, title, parentFolderId);
    const item = (created as Record<string, unknown>).item as Record<string, unknown> | undefined;
    const id = Number(item?.id);

    const [rawBookmarks, folders] = await Promise.all([
      fetchBookmarks(config.serverUrl, credentials),
      fetchFolders(config.serverUrl, credentials),
    ]);
    const bookmarks = resolveBookmarkFolderIds(rawBookmarks, folders);
    await updateCache(bookmarks, folders);
    return { success: true, data: { id, bookmarks, folders } as unknown as Record<string, unknown> };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error creating the folder';
    return { success: false, error: message };
  }
}

async function handleGetTabInfo(): Promise<MessageResponse> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      return { success: false, error: 'No active tab found.' };
    }
    return {
      success: true,
      data: { title: tab.title || '', url: tab.url || '' },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error retrieving the tab';
    return { success: false, error: message };
  }
}

interface FaviconCacheEntry {
  d: string | null;
  t: number;
}

async function handleGetFavicon(payload: Record<string, unknown>): Promise<MessageResponse> {
  const config = await getConfig();
  if (!config) return { success: false, error: 'Configuration not found.' };
  const id = Number(payload.id);
  if (!Number.isInteger(id) || id < 0) {
    return { success: true, data: { dataUrl: null } as unknown as Record<string, unknown> };
  }

  // Persistent cache (survives popup reopen): without it every popup open
  // would trigger one server request per visible bookmark.
  const stored = await chrome.storage.local.get('favicons');
  const favicons = (stored.favicons || {}) as Record<string, FaviconCacheEntry>;
  const cached = favicons[String(id)];
  if (cached && Date.now() - cached.t < FAVICON_TTL_MS) {
    return { success: true, data: { dataUrl: cached.d } as unknown as Record<string, unknown> };
  }

  const credentials = getCredentials(config.username, config.password);
  const dataUrl = await fetchFaviconDataUrl(config.serverUrl, credentials, id);
  favicons[String(id)] = { d: dataUrl, t: Date.now() };
  await chrome.storage.local.set({ favicons });
  return { success: true, data: { dataUrl } as unknown as Record<string, unknown> };
}

async function handleLogout(): Promise<MessageResponse> {
  try {
    const config = await getConfig();
    if (config) {
      try {
        const origin = new URL(config.serverUrl).origin;
        await chrome.permissions.remove({ origins: [`${origin}/*`] });
      } catch {
        /* empty */
      }
    }
    await clearConfig();
    await clearCache();
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error during logout';
    return { success: false, error: message };
  }
}

async function handleInitLoginFlow(payload: Record<string, unknown>): Promise<MessageResponse> {
  try {
    const serverUrl = payload.serverUrl as string;
    if (!serverUrl) return { success: false, error: 'Missing server URL' };
    const result = await apiInitiateLoginFlow(serverUrl);

    const serverOrigin = new URL(serverUrl).origin;
    const loginOrigin = new URL(result.loginUrl).origin;
    if (loginOrigin !== serverOrigin) {
      return { success: false, error: 'Invalid login URL: origin differs from the configured server' };
    }

    const loginFlow: LoginFlowState = {
      ...result,
      serverUrl,
      startedAt: Date.now(),
      status: 'pending',
    };
    await chrome.storage.session.set({ loginFlow });
    await chrome.alarms.create(LOGIN_ALARM_NAME, { periodInMinutes: LOGIN_ALARM_PERIOD_MINUTES });

    return {
      success: true,
      data: result as unknown as Record<string, unknown>,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error initializing login';
    return { success: false, error: message };
  }
}

async function handleCancelLoginFlow(): Promise<MessageResponse> {
  try {
    await chrome.alarms.clear(LOGIN_ALARM_NAME);
    await chrome.storage.session.remove('loginFlow');
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error cancelling the login';
    return { success: false, error: message };
  }
}

async function pollAndAdvanceLoginFlow(): Promise<void> {
  const session = await chrome.storage.session.get('loginFlow');
  const flow = session.loginFlow as LoginFlowState | undefined;
  if (!flow || flow.status !== 'pending') {
    await chrome.alarms.clear(LOGIN_ALARM_NAME);
    return;
  }

  if (Date.now() - flow.startedAt > POLL_TIMEOUT_MS) {
    await chrome.storage.session.set({ loginFlow: { ...flow, status: 'timeout' } });
    await chrome.alarms.clear(LOGIN_ALARM_NAME);
    return;
  }

  try {
    const result = await apiPollLoginFlow(flow.serverUrl, flow.pollEndpoint, flow.pollToken);
    if (!result) return; // still pending, retry on the next tick (or the next manual check)

    await finalizeLogin(flow.serverUrl, result.loginName, result.appPassword);
    await chrome.storage.session.set({ loginFlow: { ...flow, status: 'complete' } });
    await chrome.alarms.clear(LOGIN_ALARM_NAME);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error polling the login';
    await chrome.storage.session.set({ loginFlow: { ...flow, status: 'error', error: message } });
    await chrome.alarms.clear(LOGIN_ALARM_NAME);
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== LOGIN_ALARM_NAME) return;
  await pollAndAdvanceLoginFlow();
});

async function handleCheckLoginNow(): Promise<MessageResponse> {
  try {
    await pollAndAdvanceLoginFlow();
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error checking the login';
    return { success: false, error: message };
  }
}

chrome.runtime.onMessage.addListener(
  (message: Message, sender: chrome.runtime.MessageSender, sendResponse: (response: MessageResponse) => void) => {
    if (sender.id !== chrome.runtime.id) {
      sendResponse({ success: false, error: 'Unauthorized sender' });
      return false;
    }

    const handler = async (): Promise<MessageResponse> => {
      switch (message.action) {
        case 'SYNC':
          return handleSync();
        case 'ADD_BOOKMARK':
          return handleAddBookmark(message.payload || {});
        case 'EDIT_BOOKMARK':
          return handleEditBookmark(message.payload || {});
        case 'DELETE_BOOKMARK':
          return handleDeleteBookmark(message.payload || {});
        case 'RENAME_FOLDER':
          return handleRenameFolder(message.payload || {});
        case 'DELETE_FOLDER':
          return handleDeleteFolder(message.payload || {});
        case 'CREATE_FOLDER':
          return handleCreateFolder(message.payload || {});
        case 'GET_TAB_INFO':
          return handleGetTabInfo();
        case 'GET_FAVICON':
          return handleGetFavicon(message.payload || {});
        case 'LOGOUT':
          return handleLogout();
        case 'INIT_LOGIN_FLOW':
          return handleInitLoginFlow(message.payload || {});
        case 'CANCEL_LOGIN_FLOW':
          return handleCancelLoginFlow();
        case 'CHECK_LOGIN_NOW':
          return handleCheckLoginNow();
        default:
          return { success: false, error: `Unknown action: ${message.action}` };
      }
    };

    handler().then(sendResponse);
    return true;
  }
);
