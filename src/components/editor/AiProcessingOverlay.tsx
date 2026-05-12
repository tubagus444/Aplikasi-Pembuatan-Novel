/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';

interface AiProcessingOverlayProps {
  isProcessing: boolean;
}

export function AiProcessingOverlay({ isProcessing }: AiProcessingOverlayProps) {
  return (
    <AnimatePresence>
      {isProcessing && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[50] flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-[2px] rounded-lg"
        >
          <div className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-xl">
            <Loader2 size={16} className="animate-spin" />
            Resonance Weaving...
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
