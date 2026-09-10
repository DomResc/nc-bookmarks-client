import React, { useState } from 'react';
import useModalA11y from '../hooks/useModalA11y';
import Spinner from './Spinner';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const containerRef = useModalA11y<HTMLDivElement>({ onClose: () => { if (!busy) onCancel(); } });

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50">
      <div
        ref={containerRef}
        className="bg-white dark:bg-gray-800 rounded-2xl p-5 mx-4 w-[320px] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <h3 id="confirm-dialog-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={busy}
            className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleConfirm} disabled={busy}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {busy && <Spinner size={14} />}
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
