import React from 'react';

export function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;

  try {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-700 rounded px-0.5">
            {part}
          </mark>
        );
      }
      return part;
    });
  } catch {
    return text;
  }
}
