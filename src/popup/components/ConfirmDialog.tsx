import React from 'react';
import useModalA11y from '../hooks/useModalA11y';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: ConfirmDialogProps) {
  const containerRef = useModalA11y<HTMLDivElement>({ onClose: onCancel });

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
          <button onClick={onCancel}
            className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={onConfirm}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
