import { useEffect, useRef, useState, useCallback } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const actionItems = items.filter(item => !item.separator);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev + 1) % actionItems.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev - 1 + actionItems.length) % actionItems.length);
        break;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const item = actionItems[focusedIndex];
        if (item && !item.disabled) {
          item.onClick();
          onClose();
        }
        break;
      }
      case 'Tab':
        e.preventDefault();
        onClose();
        break;
    }
  }, [onClose, actionItems, focusedIndex]);

  useEffect(() => {
    const handleClick = () => onClose();
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, handleKeyDown]);

  // Focus the menu on mount so screen readers announce it
  useEffect(() => {
    menuRef.current?.focus();
  }, []);

  let actionIndex = -1;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Context menu"
      tabIndex={-1}
      className="fixed z-50 min-w-[180px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl py-1 text-sm focus:outline-none"
      style={{ top: y, left: x }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return <div key={i} role="separator" className="border-t border-zinc-200 dark:border-zinc-700 my-1" />;
        }
        actionIndex++;
        const isFocused = actionIndex === focusedIndex;
        return (
          <button
            key={i}
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            onMouseEnter={() => {
              const idx = actionItems.indexOf(item);
              if (idx >= 0) setFocusedIndex(idx);
            }}
            disabled={item.disabled}
            aria-disabled={item.disabled}
            className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${
              item.disabled
                ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                : item.danger
                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            } ${isFocused && !item.disabled ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
          >
            {item.icon && <span className="w-3.5 h-3.5 flex items-center justify-center">{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

// Utility to calculate menu position within viewport
export function getMenuPosition(e: React.MouseEvent, menuWidth = 180, menuHeight = 200) {
  const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
  const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);
  return { x, y };
}

// Clipboard utility with fallback
export function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}
