import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface DropdownMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface DropdownMenuProps {
  items: DropdownMenuItem[];
  ariaLabel: string;
  hoverGroup?: 'group-hover' | 'group-hover/folder';
  triggerIconSize?: number;
  triggerClassName?: string;
  wrapperClassName?: string;
  menuClassName?: string;
  align?: 'left' | 'right';
}

// Le due varianti restano stringhe letterali: il content-scanner JIT di
// Tailwind legge il sorgente testualmente, non l'output costruito a runtime.
const HOVER_VISIBILITY_CLASSES: Record<'group-hover' | 'group-hover/folder', string> = {
  'group-hover': 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
  'group-hover/folder': 'opacity-0 group-hover/folder:opacity-100 focus-visible:opacity-100',
};

const DEFAULT_TRIGGER_CLASSNAME =
  'p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 transition-opacity';
const DEFAULT_MENU_CLASSNAME = 'min-w-[120px]';

export default function DropdownMenu({
  items,
  ariaLabel,
  hoverGroup = 'group-hover',
  triggerIconSize = 14,
  triggerClassName = DEFAULT_TRIGGER_CLASSNAME,
  wrapperClassName = '',
  menuClassName = DEFAULT_MENU_CLASSNAME,
  align = 'right',
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    // La lista scrollabile riposiziona il pulsante trigger: chiudere il menu
    // evita che resti ancorato a coordinate ormai obsolete.
    function handleScrollOrResize() {
      setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      if (btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        setPos(
          align === 'right'
            ? { top: r.bottom + 4, right: window.innerWidth - r.right }
            : { top: r.bottom + 4, left: r.left }
        );
      }
    }
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open, align]);

  const visibilityClass = open ? 'opacity-100' : HOVER_VISIBILITY_CLASSES[hoverGroup];

  return (
    <div className={wrapperClassName}>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`${triggerClassName} ${visibilityClass}`}
        aria-label={ariaLabel}
      >
        <svg width={triggerIconSize} height={triggerIconSize} viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className={`fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[9999] py-1 ${menuClassName}`}
          style={{ top: pos.top, left: pos.left, right: pos.right }}
        >
          {items.map((item, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick(); }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                item.danger ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
