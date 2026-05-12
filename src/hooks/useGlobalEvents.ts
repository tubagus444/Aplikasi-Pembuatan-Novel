/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { ErrorService } from '../services/errorService';

interface GlobalEventsProps {
  setIsSearchOpen: (open: boolean) => void;
}

export function useGlobalEvents({ setIsSearchOpen }: GlobalEventsProps) {
  useEffect(() => {
    // Global Error Handling
    const handleGlobalError = (event: ErrorEvent) => {
      ErrorService.log({
        message: event.message,
        type: 'error',
        source: 'Global (Window)',
        stack: event.error?.stack
      });
    };

    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      ErrorService.log({
        message: event.reason?.message || String(event.reason),
        type: 'error',
        source: 'Promise Rejection',
        stack: event.reason?.stack,
        metadata: { reason: event.reason }
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handlePromiseRejection);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handlePromiseRejection);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setIsSearchOpen]);
}
