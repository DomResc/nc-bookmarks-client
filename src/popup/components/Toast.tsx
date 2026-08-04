import React, { useEffect, useState } from 'react';
import { TOAST_DURATION_MS } from '../../utils/constants';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning';
}

export default function Toast({ message, type }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => setVisible(false), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const icon = type === 'success'
    ? (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-green-400 dark:text-green-600">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ) : type === 'warning'
    ? (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-yellow-400 dark:text-yellow-600">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    )
    : (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-red-400 dark:text-red-600">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );

  return (
    <div
      role="status"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`fixed top-14 left-1/2 z-[60] flex items-center gap-2 max-w-[85%] px-3.5 py-2 bg-gray-900/95 dark:bg-gray-100/95 text-white dark:text-gray-900 text-xs font-medium rounded-lg shadow-lg ring-1 ring-black/5 transition-all duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ transform: `translateX(-50%) translateY(${visible ? 0 : -4}px)` }}
    >
      {icon}
      <span className="truncate">{message}</span>
    </div>
  );
}
