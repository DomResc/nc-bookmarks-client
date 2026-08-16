import React, { useEffect, useState } from 'react';
import { Bookmark } from '../../types';
import { highlightText } from '../../utils/highlight';
import DropdownMenu from './DropdownMenu';

const faviconCache = new Map<number, string | null>();

function Favicon({ id }: { id: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(faviconCache.get(id) ?? null);

  useEffect(() => {
    if (faviconCache.has(id)) { setDataUrl(faviconCache.get(id) ?? null); return; }
    let cancelled = false;
    chrome.runtime.sendMessage({ action: 'GET_FAVICON', payload: { id } }, (response) => {
      if (cancelled) return;
      const url = response?.success ? (response.data?.dataUrl as string | null) : null;
      faviconCache.set(id, url);
      setDataUrl(url);
    });
    return () => { cancelled = true; };
  }, [id]);

  if (dataUrl) {
    return <img src={dataUrl} width={16} height={16} className="rounded-xs shrink-0 object-contain mt-0.5" alt="" />;
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-gray-600 shrink-0 mt-0.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

interface BookmarkItemProps {
  bookmark: Bookmark;
  searchQuery: string;
  onOpen: (url: string) => void;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
  showFolderChips?: boolean;
  folderTitles?: Map<number, string>;
}

export default function BookmarkItem({ bookmark, searchQuery, onOpen, onEdit, onDelete, showFolderChips = true, folderTitles }: BookmarkItemProps) {
  const displayUrl = bookmark.url.length > 55
    ? bookmark.url.substring(0, 52) + '...'
    : bookmark.url;

  function handleClick() {
    if (bookmark.url) onOpen(bookmark.url);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (bookmark.url) onOpen(bookmark.url); } }}
      className="px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors relative group"
    >
      <div className="pr-5 flex gap-2">
        <Favicon id={bookmark.id} />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-900 dark:text-gray-100 text-sm leading-snug line-clamp-2">
            {highlightText(bookmark.title, searchQuery)}
          </div>
          <div className="text-gray-400 dark:text-gray-500 text-xs truncate mt-0.5">
            {highlightText(displayUrl, searchQuery)}
          </div>
          {(bookmark.tags.length > 0 || (showFolderChips && bookmark.folders.length > 0)) && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {bookmark.tags.map((tag) => (
                <span key={`tag-${tag}`} className="text-[11px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {highlightText(tag, searchQuery)}
                </span>
              ))}
              {showFolderChips && bookmark.folders.map((folder) => {
                const label = typeof folder === 'number'
                  ? (folderTitles?.get(folder) ?? String(folder))
                  : folder;
                return (
                  <span key={`folder-${folder}`} className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    {highlightText(label, searchQuery)}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <DropdownMenu
        ariaLabel="Menu"
        hoverGroup="group-hover"
        wrapperClassName="absolute right-1 top-2"
        items={[
          {
            label: 'Edit',
            onClick: () => onEdit(bookmark),
            icon: (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            ),
          },
          {
            label: 'Delete',
            danger: true,
            onClick: () => onDelete(bookmark),
            icon: (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            ),
          },
        ]}
      />
    </div>
  );
}
