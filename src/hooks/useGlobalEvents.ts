/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { ErrorService } from '@/src/services/errorService';

interface GlobalEventsProps {
  setIsSearchOpen?: (open: boolean) => void;
  onToggleEditorSearch?: () => void;
  isEditorSearchOpen?: boolean;
  onToggleFocusMode?: () => void;
}

export function useGlobalEvents({ 
  setIsSearchOpen, 
  onToggleEditorSearch, 
  isEditorSearchOpen,
  onToggleFocusMode
}: GlobalEventsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global Search (Ctrl+K or Ctrl+F)
      if (setIsSearchOpen && (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'f') && !e.altKey) {
        e.preventDefault();
        setIsSearchOpen(true);
      }

      // Editor Search & Replace (Ctrl+H)
      if (onToggleEditorSearch && (e.metaKey || e.ctrlKey) && e.key === 'h') {
        e.preventDefault();
        onToggleEditorSearch();
      }

      // Focus Mode (Ctrl+Alt+F)
      if (onToggleFocusMode && (e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        onToggleFocusMode();
      }

      // Escape Handler
      if (e.key === 'Escape') {
        if (isEditorSearchOpen && onToggleEditorSearch) {
          onToggleEditorSearch();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setIsSearchOpen]);
}
