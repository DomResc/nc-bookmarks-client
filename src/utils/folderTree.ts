import { Folder } from '../types';

export interface FolderTreeOption {
  id: number;
  title: string;
  depth: number;
}

export function flattenFolderTree(folders: Folder[]): FolderTreeOption[] {
  const validIds = new Set(folders.map((f) => f.id));
  const childrenByParent = new Map<number, Folder[]>();
  for (const f of folders) {
    const parentKey = f.parentFolderId !== -1 && validIds.has(f.parentFolderId) ? f.parentFolderId : -1;
    if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, []);
    childrenByParent.get(parentKey)!.push(f);
  }
  for (const list of childrenByParent.values()) list.sort((a, b) => a.title.localeCompare(b.title));

  const result: FolderTreeOption[] = [];
  function walk(parentId: number, depth: number) {
    for (const f of childrenByParent.get(parentId) || []) {
      result.push({ id: f.id, title: f.title, depth });
      walk(f.id, depth + 1);
    }
  }
  walk(-1, 0);
  return result;
}
