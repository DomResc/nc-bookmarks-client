import React, { useMemo, useState } from 'react';
import { Bookmark, Folder } from '../../types';
import { flattenFolderTree } from '../../utils/folderTree';
import Spinner from './Spinner';
import useModalA11y from '../hooks/useModalA11y';

interface EditBookmarkModalProps {
  bookmark: Bookmark;
  folders: Folder[];
  onClose: () => void;
  onSave: (data: { id: number; title: string; url: string; tags: string; folders: string }) => Promise<void>;
  onCreateFolder: (title: string, parentFolderId: number) => Promise<number>;
}

export default function EditBookmarkModal({ bookmark, folders, onClose, onSave, onCreateFolder }: EditBookmarkModalProps) {
  const [title, setTitle] = useState(bookmark.title);
  const [url, setUrl] = useState(bookmark.url);
  const [tags, setTags] = useState(bookmark.tags.join(', '));

  // The select manages the primary folder only; any other folder memberships
  // are preserved untouched on save (the Nextcloud API replaces the whole
  // folder list on PUT, so they must be re-sent explicitly).
  const folderIds = bookmark.folders.filter((f): f is number => typeof f === 'number');
  const [selectedFolderId, setSelectedFolderId] = useState(folderIds.length > 0 ? String(folderIds[0]) : '');
  const [customFolder, setCustomFolder] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState('');
  const [useCustomFolder, setUseCustomFolder] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useModalA11y<HTMLDivElement>({ onClose: onClose });

  const folderOptions = useMemo(() => flattenFolderTree(folders), [folders]);

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return; }
    if (!url.trim()) { setError('URL is required'); return; }
    setSaving(true);
    setError(null);
    try {
      let primaryId: number | null = selectedFolderId ? Number(selectedFolderId) : null;
      if (useCustomFolder) {
        if (!customFolder.trim()) { setError('Folder name is required'); setSaving(false); return; }
        primaryId = await onCreateFolder(customFolder.trim(), newFolderParentId ? Number(newFolderParentId) : -1);
      }
      const allFolderIds = [...new Set([...(primaryId !== null ? [primaryId] : []), ...folderIds.slice(1)])];
      await onSave({ id: bookmark.id, title: title.trim(), url: url.trim(), tags, folders: allFolderIds.join(',') });
      setSaving(false);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSaving(false);
    }
  }

  return (
    <div className="absolute inset-0 bg-black/40 dark:bg-black/60 flex items-end z-50">
      <div
        ref={containerRef}
        className="w-full bg-white dark:bg-gray-800 rounded-t-2xl p-5 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-bookmark-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="edit-bookmark-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">Edit bookmark</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="edit-title" className="sr-only">Title</label>
            <input id="edit-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" autoFocus
              className="input-field w-full" />
          </div>
          <div>
            <label htmlFor="edit-url" className="sr-only">URL</label>
            <input id="edit-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL"
              className="input-field w-full" />
          </div>
          <div>
            <label htmlFor="edit-tags" className="sr-only">Tags (comma-separated)</label>
            <input id="edit-tags" type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma-separated, optional)"
              className="input-field w-full" />
          </div>
          <div>
            <label htmlFor="edit-folder" className="sr-only">Folder</label>
            {!useCustomFolder ? (
              <div className="flex gap-2">
                <select id="edit-folder" value={selectedFolderId} onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="input-field flex-1"
                >
                  <option value="">No folder</option>
                  {folderOptions.map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {f.depth > 0 ? '  '.repeat(f.depth - 1) + '└ ' : ''}{f.title}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setUseCustomFolder(true)}
                  className="px-2.5 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors whitespace-nowrap"
                  title="New folder"
                >
                  + New
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    id="edit-folder-custom"
                    type="text"
                    value={customFolder}
                    onChange={(e) => setCustomFolder(e.target.value)}
                    placeholder="New folder name"
                    autoFocus
                    className="input-field flex-1"
                  />
                  <button
                    onClick={() => { setUseCustomFolder(false); setCustomFolder(''); setNewFolderParentId(''); }}
                    className="px-2.5 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                <div>
                  <label htmlFor="edit-new-folder-parent" className="sr-only">Parent folder</label>
                  <select
                    id="edit-new-folder-parent"
                    value={newFolderParentId}
                    onChange={(e) => setNewFolderParentId(e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="">No parent folder (top level)</option>
                    {folderOptions.map((f) => (
                      <option key={f.id} value={String(f.id)}>
                        {f.depth > 0 ? '  '.repeat(f.depth - 1) + '└ ' : ''}{f.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
          {error && <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-xs">{error}</div>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} disabled={saving}
              className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
              {saving && <Spinner size={16} />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
