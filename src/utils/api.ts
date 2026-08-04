import { Bookmark, Folder } from '../types';
import { API_PATH, FOLDER_PATH } from './constants';

export function getCredentials(username: string, password: string): string {
  // btoa() only accepts Latin-1: encode as UTF-8 first so that credentials
  // containing non-ASCII characters don't throw InvalidCharacterError.
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  return bytesToBase64(bytes);
}

function bytesToBase64(bytes: Uint8Array): string {
  // Chunked conversion: spreading the whole array would overflow the call
  // stack on large inputs (e.g. big favicons).
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

function toFolderEntry(value: unknown): number | string | null {
  if (typeof value === 'number') return value >= 0 ? value : null;
  if (typeof value === 'string') {
    const n = Number(value);
    if (!isNaN(n) && n >= 0) return n;
    return value;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.title === 'string') return obj.title;
    if (typeof obj.id === 'number' && obj.id >= 0) return obj.id;
    if (typeof obj.id === 'string') {
      const n = Number(obj.id);
      return !isNaN(n) && n >= 0 ? n : null;
    }
  }
  return null;
}

function assertHttps(serverUrl: string): void {
  const protocol = new URL(serverUrl).protocol;
  if (protocol !== 'https:') {
    throw new Error('An HTTPS URL is required for security reasons');
  }
}

async function apiFetch(
  serverUrl: string,
  credentials: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  assertHttps(serverUrl);
  const cleanUrl = serverUrl.replace(/\/+$/, '');
  const tryPaths = [
    `${cleanUrl}${path}`,
    `${cleanUrl}/index.php${path}`,
  ];

  for (const url of tryPaths) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {}),
      },
    });

    if (response.ok) return response;
    if (response.status === 401) throw new Error('Invalid credentials');

    if (response.status === 404 && url !== tryPaths[tryPaths.length - 1]) {
      continue;
    }

    if (response.status === 404) {
      throw new Error('Endpoint not found. Check that the Bookmarks app is installed on the server');
    }

    throw new Error(`Server error: ${response.status}`);
  }

  throw new Error('Unable to contact the server');
}

export async function fetchBookmarks(
  serverUrl: string,
  credentials: string
): Promise<Bookmark[]> {
  const response = await apiFetch(serverUrl, credentials, `${API_PATH}?page=-1`);

  const json = await response.json();
  const data = json.data || [];

  const bookmarks: Bookmark[] = data.map((b: Record<string, unknown>) => ({
    id: Number(b.id),
    title: (b.title as string) || '(untitled)',
    url: (b.url as string) || '',
    tags: (b.tags as string[]) || [],
    folders: (Array.isArray(b.folders) ? b.folders.map(toFolderEntry).filter((f): f is number | string => f !== null) : []),
    lastmodified: b.lastmodified != null ? Number(b.lastmodified) : 0,
  }));

  bookmarks.sort((a, b) => b.lastmodified - a.lastmodified);
  return bookmarks;
}

function flattenFolders(items: Record<string, unknown>[]): Folder[] {
  const result: Folder[] = [];
  function walk(list: Record<string, unknown>[], parentId: number) {
    for (const f of list) {
      result.push({
        id: Number(f.id),
        title: (f.title as string) || '(unnamed)',
        parentFolderId: parentId,
      });
      const children = f.children;
      if (Array.isArray(children) && children.length > 0) {
        walk(children as Record<string, unknown>[], Number(f.id));
      }
    }
  }
  walk(items, -1);
  return result;
}

export async function fetchFolders(
  serverUrl: string,
  credentials: string
): Promise<Folder[]> {
  const response = await apiFetch(serverUrl, credentials, FOLDER_PATH);
  const json = await response.json();
  const data = json.data || [];
  return flattenFolders(data);
}

export async function addBookmark(
  serverUrl: string,
  credentials: string,
  data: { title: string; url: string; tags?: string[]; folders?: (string | number)[] }
): Promise<Record<string, unknown>> {
  const response = await apiFetch(serverUrl, credentials, API_PATH, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  return response.json();
}

export async function updateBookmark(
  serverUrl: string,
  credentials: string,
  id: number,
  data: { title?: string; url?: string; tags?: string[]; folders?: (string | number)[] }
): Promise<Record<string, unknown>> {
  const response = await apiFetch(serverUrl, credentials, `${API_PATH}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function deleteBookmark(
  serverUrl: string,
  credentials: string,
  id: number
): Promise<void> {
  await apiFetch(serverUrl, credentials, `${API_PATH}/${id}`, {
    method: 'DELETE',
  });
}

export async function renameFolder(
  serverUrl: string,
  credentials: string,
  id: number,
  title: string
): Promise<Record<string, unknown>> {
  const response = await apiFetch(serverUrl, credentials, `${FOLDER_PATH}/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
  });
  return response.json();
}

export async function createFolder(
  serverUrl: string,
  credentials: string,
  title: string,
  parentFolderId: number = -1
): Promise<Record<string, unknown>> {
  const response = await apiFetch(serverUrl, credentials, FOLDER_PATH, {
    method: 'POST',
    body: JSON.stringify({ title, parent_folder: parentFolderId }),
  });
  return response.json();
}

export async function deleteFolder(
  serverUrl: string,
  credentials: string,
  id: number
): Promise<void> {
  await apiFetch(serverUrl, credentials, `${FOLDER_PATH}/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchFaviconDataUrl(
  serverUrl: string,
  credentials: string,
  id: number
): Promise<string | null> {
  try {
    const response = await apiFetch(serverUrl, credentials, `${API_PATH}/${id}/favicon`);
    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = await response.arrayBuffer();
    const base64 = bytesToBase64(new Uint8Array(buffer));
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function initiateLoginFlow(serverUrl: string): Promise<{ loginUrl: string; pollToken: string; pollEndpoint: string }> {
  assertHttps(serverUrl);
  const cleanUrl = serverUrl.replace(/\/+$/, '');
  const tryPaths = [
    `${cleanUrl}/login/v2`,
    `${cleanUrl}/index.php/login/v2`,
  ];
  for (const url of tryPaths) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (response.ok) {
      const data = await response.json();
      return {
        loginUrl: data.login,
        pollToken: data.poll.token,
        pollEndpoint: data.poll.endpoint,
      };
    }
    if (response.status === 404 && url !== tryPaths[tryPaths.length - 1]) continue;
    throw new Error(`Login flow not supported by the server (${response.status})`);
  }
  throw new Error('Unable to contact the server');
}

export async function pollLoginFlow(pollEndpoint: string, pollToken: string): Promise<{ server: string; loginName: string; appPassword: string } | null> {
  const response = await fetch(pollEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: pollToken }),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Polling failed: ${response.status}`);
  return response.json();
}
