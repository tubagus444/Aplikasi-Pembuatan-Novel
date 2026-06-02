/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';

interface AiProcessingOverlayProps {
  isProcessing: boolean;
  retryStatus?: string | null;
}

export function AiProcessingOverlay({ isProcessing, retryStatus }: AiProcessingOverlayProps) {
  return (
    <AnimatePresence>
      {isProcessing && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[50] flex flex-col items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-[2px] rounded-lg gap-3"
        >
          <div className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-xl">
            <Loader2 size={16} className="animate-spin" />
            Resonance Weaving...
          </div>
          {retryStatus && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-medium shadow-md max-w-xs text-center leading-tight border border-amber-200 dark:border-amber-800"
            >
              <div className="w-1.5 h-1.5 min-w-[6px] bg-amber-500 rounded-full animate-pulse" />
              {retryStatus}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
