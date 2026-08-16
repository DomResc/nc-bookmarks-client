import React, { useMemo, useRef, useState } from 'react';
import { Bookmark, Folder } from '../../types';
import BookmarkItem from './BookmarkItem';
import DropdownMenu from './DropdownMenu';

interface FolderNode {
  id: number;
  title: string;
  children: FolderNode[];
  bookmarks: Bookmark[];
}

interface BookmarkListProps {
  bookmarks: Bookmark[];
  searchQuery: string;
  grouped?: boolean;
  folders?: Folder[];
  onEditBookmark: (bookmark: Bookmark) => void;
  onDeleteBookmark: (bookmark: Bookmark) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
}

// Indentation model: a row at depth d starts at BASE + d*STEP px. The chevron
// is 16px wide, so its center — where the guide line passes — sits at
// 2*BASE + d*STEP. Folder titles start at TITLE_X + d*STEP.
const INDENT_BASE = 8;
const INDENT_STEP = 16;
const TITLE_X = INDENT_BASE + 16 + 6 + 16 + 6; // chevron + gap + icon + gap

// Grouping is done by folder ID: titles are not unique across the tree, so
// same-named folders under different parents must stay distinct.
function buildTree(folders: Folder[], bookmarks: Bookmark[]): { roots: FolderNode[]; uncategorized: Bookmark[] } {
  const byFolderId = new Map<number, Bookmark[]>();
  const uncategorized: Bookmark[] = [];

  for (const b of bookmarks) {
    const folderIds = b.folders.filter((f): f is number => typeof f === 'number');
    if (folderIds.length === 0) {
      uncategorized.push(b);
    } else {
      for (const id of folderIds) {
        if (!byFolderId.has(id)) byFolderId.set(id, []);
        byFolderId.get(id)!.push(b);
      }
    }
  }

  const nodeMap = new Map<number, FolderNode>();
  const roots: FolderNode[] = [];

  for (const f of folders) {
    const node: FolderNode = {
      id: f.id,
      title: f.title,
      children: [],
      bookmarks: byFolderId.get(f.id) || [],
    };
    nodeMap.set(f.id, node);
  }

  for (const f of folders) {
    const node = nodeMap.get(f.id)!;
    if (f.parentFolderId === -1 || !nodeMap.has(f.parentFolderId)) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(f.parentFolderId)!;
      parent.children.push(node);
    }
  }

  roots.sort((a, b) => a.title.localeCompare(b.title));
  for (const node of nodeMap.values()) {
    node.children.sort((a, b) => a.title.localeCompare(b.title));
  }

  return { roots, uncategorized };
}

// Total bookmarks in the subtree, deduplicated: a bookmark living in several
// folders of the same subtree is counted once.
function countSubtreeBookmarks(node: FolderNode, acc: Set<number>): Set<number> {
  for (const b of node.bookmarks) acc.add(b.id);
  for (const c of node.children) countSubtreeBookmarks(c, acc);
  return acc;
}

// Vertical guide lines, one per ancestor level, aligned with the chevrons.
function GuideLines({ depth, includeOwnLevel = false }: { depth: number; includeOwnLevel?: boolean }) {
  const count = includeOwnLevel ? depth + 1 : depth;
  if (count <= 0) return null;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute inset-y-0 w-px bg-gray-200 dark:bg-gray-700 pointer-events-none"
          style={{ left: `${2 * INDENT_BASE + i * INDENT_STEP}px` }}
        />
      ))}
    </>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden
        className="shrink-0 text-[#0082C9] dark:text-[#5eb1e6]">
        <path d="M10 4H4a2 2 0 0 0-2 2v11l3.3-7.4A2 2 0 0 1 7.1 8.6H22V8a2 2 0 0 0-2-2h-8l-2-2z" opacity=".55" />
        <path d="M7.1 10.6h13.7a1 1 0 0 1 .94 1.34l-2.4 6.4a1 1 0 0 1-.94.66H4.7a1 1 0 0 1-.94-1.34l2.4-6.4a1 1 0 0 1 .94-.66z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden
      className="shrink-0 text-[#0082C9] dark:text-[#5eb1e6]">
      <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" />
    </svg>
  );
}

interface FolderTreeNodeProps {
  node: FolderNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  foldersById: Map<number, Folder>;
  folderTitles: Map<number, string>;
  searchQuery: string;
  onOpen: (url: string, background: boolean) => void;
  onEditBookmark: (bookmark: Bookmark) => void;
  onDeleteBookmark: (bookmark: Bookmark) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
}

function FolderTreeNode({
  node, depth, expanded, onToggle, foldersById, folderTitles, searchQuery,
  onOpen, onEditBookmark, onDeleteBookmark, onRenameFolder, onDeleteFolder,
}: FolderTreeNodeProps) {
  const key = `${node.id}`;
  const isExpanded = expanded.has(key);
  // Mount-once: content stays mounted after the first expansion so the
  // grid-rows animation can run; before that it stays out of the DOM (avoids
  // fetching favicons for collapsed folders).
  const wasExpandedRef = useRef(false);
  if (isExpanded) wasExpandedRef.current = true;

  const folder = foldersById.get(node.id) || null;
  const count = countSubtreeBookmarks(node, new Set()).size;
  const isEmpty = node.children.length === 0 && node.bookmarks.length === 0;

  return (
    <div>
      <div
        className={`group/folder relative flex items-center pr-1 ${
          depth === 0 ? 'sticky top-0 z-10 bg-white dark:bg-gray-900' : ''
        }`}
        style={{ paddingLeft: `${INDENT_BASE + depth * INDENT_STEP}px` }}
      >
        <GuideLines depth={depth} />
        <button
          onClick={() => onToggle(key)}
          aria-expanded={isExpanded}
          className="relative flex flex-1 min-w-0 items-center gap-1.5 py-1.5 rounded-md text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden
            className={`shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <FolderIcon open={isExpanded} />
          <span className="truncate text-[13px] font-medium text-gray-700 dark:text-gray-200">{node.title}</span>
          <span className="ml-auto mr-1 shrink-0 text-[10px] leading-4 px-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            {count}
          </span>
        </button>
        {folder && (
          <DropdownMenu
            ariaLabel="Folder menu"
            hoverGroup="group-hover/folder"
            triggerIconSize={14}
            triggerClassName="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 transition-opacity"
            wrapperClassName="shrink-0"
            menuClassName="min-w-[130px]"
            items={[
              {
                label: 'Rename',
                onClick: () => onRenameFolder(folder),
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
                onClick: () => onDeleteFolder(folder),
                icon: (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                ),
              },
            ]}
          />
        )}
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-150 ease-out"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          {wasExpandedRef.current && (
            <>
              {node.children.map((child) => (
                <FolderTreeNode
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  expanded={expanded}
                  onToggle={onToggle}
                  foldersById={foldersById}
                  folderTitles={folderTitles}
                  searchQuery={searchQuery}
                  onOpen={onOpen}
                  onEditBookmark={onEditBookmark}
                  onDeleteBookmark={onDeleteBookmark}
                  onRenameFolder={onRenameFolder}
                  onDeleteFolder={onDeleteFolder}
                />
              ))}
              {node.bookmarks.length > 0 && (
                <div
                  className="relative divide-y divide-gray-100 dark:divide-gray-800/50"
                  style={{ paddingLeft: `${TITLE_X - 16 + depth * INDENT_STEP}px` }}
                >
                  <GuideLines depth={depth} includeOwnLevel />
                  {node.bookmarks.map((bm) => (
                    <BookmarkItem
                      key={bm.id}
                      bookmark={bm}
                      searchQuery={searchQuery}
                      onOpen={onOpen}
                      onEdit={onEditBookmark}
                      onDelete={onDeleteBookmark}
                      showFolderChips={false}
                      folderTitles={folderTitles}
                    />
                  ))}
                </div>
              )}
              {isEmpty && (
                <div
                  className="relative py-1.5 text-xs italic text-gray-400 dark:text-gray-500"
                  style={{ paddingLeft: `${TITLE_X + depth * INDENT_STEP}px` }}
                >
                  <GuideLines depth={depth} includeOwnLevel />
                  Empty folder
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BookmarkList({ bookmarks, searchQuery, grouped, folders, onEditBookmark, onDeleteBookmark, onRenameFolder, onDeleteFolder }: BookmarkListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const folderTitles = useMemo(() => {
    const map = new Map<number, string>();
    for (const f of folders || []) map.set(f.id, f.title);
    return map;
  }, [folders]);

  const foldersById = useMemo(() => {
    const map = new Map<number, Folder>();
    for (const f of folders || []) map.set(f.id, f);
    return map;
  }, [folders]);

  function handleOpen(url: string, background: boolean) {
    // Only web URLs may be opened: bookmark data comes from the network and
    // exotic schemes (javascript:, data:, ...) are rejected here.
    try {
      const protocol = new URL(url).protocol;
      if (protocol !== 'http:' && protocol !== 'https:') return;
      if (background) {
        chrome.tabs.create({ url, active: false });
      } else {
        // Navigate the current tab; fall back to a new tab if the active tab
        // cannot be navigated (e.g. a chrome:// page). The popup closes either
        // way, since the bookmark is now in front of the user.
        chrome.tabs.update({ url })
          .catch(() => chrome.tabs.create({ url }))
          .finally(() => window.close());
      }
    } catch {
      /* malformed URL: ignore */
    }
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300 dark:text-gray-600 mb-3">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        {searchQuery ? (
          <>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No results</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">No bookmark matches &ldquo;{searchQuery}&rdquo;</p>
          </>
        ) : (
          <>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No bookmarks</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Add your first bookmark using the button below</p>
          </>
        )}
      </div>
    );
  }

  if (grouped && folders) {
    const { roots, uncategorized } = buildTree(folders, bookmarks);
    const sharedNodeProps = {
      expanded, onToggle: toggleExpanded, foldersById, folderTitles, searchQuery,
      onOpen: handleOpen, onEditBookmark, onDeleteBookmark, onRenameFolder, onDeleteFolder,
    };
    return (
      <div className="py-1">
        {roots.map((node) => (
          <FolderTreeNode key={node.id} node={node} depth={0} {...sharedNodeProps} />
        ))}
        {uncategorized.length > 0 && (
          <div className="divide-y divide-gray-100 dark:divide-gray-800/50 border-t border-gray-100 dark:border-gray-800">
            {uncategorized.map((bm) => (
              <BookmarkItem
                key={bm.id}
                bookmark={bm}
                searchQuery={searchQuery}
                onOpen={handleOpen}
                onEdit={onEditBookmark}
                onDelete={onDeleteBookmark}
                showFolderChips
                folderTitles={folderTitles}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {bookmarks.map((bookmark) => (
        <BookmarkItem key={bookmark.id} bookmark={bookmark} searchQuery={searchQuery} onOpen={handleOpen} onEdit={onEditBookmark} onDelete={onDeleteBookmark} folderTitles={folderTitles} />
      ))}
    </div>
  );
}
