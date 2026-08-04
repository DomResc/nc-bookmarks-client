import React from 'react';
import useModalA11y from '../hooks/useModalA11y';

interface RenameFolderModalProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function RenameFolderModal({ value, onChange, onSave, onCancel }: RenameFolderModalProps) {
  const containerRef = useModalA11y<HTMLDivElement>({ onClose: onCancel });

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50">
      <div
        ref={containerRef}
        className="bg-white dark:bg-gray-800 rounded-2xl p-5 mx-4 w-[320px] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-folder-title"
      >
        <h3 id="rename-folder-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Rename folder</h3>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSave(); }}
          className="input-field w-full mb-4"
          autoFocus
        />
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={onSave}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Save</button>
        </div>
      </div>
    </div>
  );
}
