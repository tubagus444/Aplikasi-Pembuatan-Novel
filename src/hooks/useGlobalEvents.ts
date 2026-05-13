/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { ErrorService } from '../services/errorService';

interface GlobalEventsProps {
  setIsSearchOpen?: (open: boolean) => void;
  onToggleEditorSearch?: () => void;
  isEditorSearchOpen?: boolean;
}

export function useGlobalEvents({ 
  setIsSearchOpen, 
  onToggleEditorSearch, 
  isEditorSearchOpen 
}: GlobalEventsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global Search (Ctrl+K or Ctrl+F)
      if (setIsSearchOpen && (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault();
        setIsSearchOpen(true);
      }

      // Editor Search & Replace (Ctrl+H)
      if (onToggleEditorSearch && (e.metaKey || e.ctrlKey) && e.key === 'h') {
        e.preventDefault();
        onToggleEditorSearch();
      }

      // Escape Handler
      if (e.key === 'Escape' && isEditorSearchOpen && onToggleEditorSearch) {
        onToggleEditorSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setIsSearchOpen]);
}
