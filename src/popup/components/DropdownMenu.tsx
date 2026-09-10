import React, { useState, useRef, useEffect, useLayoutEffect, useId, useCallback } from 'react';
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

// Both variants are kept as literal strings: Tailwind's JIT content scanner
// reads the source as text, not the output built at runtime.
const HOVER_VISIBILITY_CLASSES: Record<'group-hover' | 'group-hover/folder', string> = {
  'group-hover': 'opacity-60 group-hover:opacity-100 focus-visible:opacity-100',
  'group-hover/folder': 'opacity-60 group-hover/folder:opacity-100 focus-visible:opacity-100',
};

const DEFAULT_TRIGGER_CLASSNAME =
  'p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 transition-opacity';
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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const updatePosition = useCallback(() => {
    const button = btnRef.current;
    const menu = menuRef.current;
    if (!button || !menu) return;
    const gap = 4;
    const margin = 8;
    const buttonRect = button.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const fitsBelow = buttonRect.bottom + gap + menuRect.height <= window.innerHeight - margin;
    const top = fitsBelow
      ? buttonRect.bottom + gap
      : Math.max(margin, buttonRect.top - gap - menuRect.height);
    const preferredLeft = align === 'right'
      ? buttonRect.right - menuRect.width
      : buttonRect.left;
    const left = Math.min(
      Math.max(margin, preferredLeft),
      Math.max(margin, window.innerWidth - menuRect.width - margin)
    );
    setPos({ top, left });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [open, updatePosition]);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function closeAndRestoreFocus() {
      setOpen(false);
      requestAnimationFrame(() => btnRef.current?.focus());
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAndRestoreFocus();
      }
    }
    function handleScrollOrResize() {
      updatePosition();
    }
    if (open) {
      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
    }
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open, updatePosition]);

  const visibilityClass = open ? 'opacity-100' : HOVER_VISIBILITY_CLASSES[hoverGroup];

  return (
    <div className={wrapperClassName}>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`${triggerClassName} ${visibilityClass}`}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        <svg width={triggerIconSize} height={triggerIconSize} viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={ariaLabel}
          className={`fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[9999] py-1 ${menuClassName}`}
          style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
          onKeyDown={(e) => {
            const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const delta = e.key === 'ArrowDown' ? 1 : -1;
              buttons[(index + delta + buttons.length) % buttons.length]?.focus();
            } else if (e.key === 'Home') {
              e.preventDefault(); buttons[0]?.focus();
            } else if (e.key === 'End') {
              e.preventDefault(); buttons[buttons.length - 1]?.focus();
            } else if (e.key === 'Tab') {
              setOpen(false);
            }
          }}
        >
          {items.map((item, i) => (
            <button
              key={i}
              role="menuitem"
              tabIndex={i === 0 ? 0 : -1}
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
