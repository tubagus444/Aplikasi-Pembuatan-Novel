import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

/** Kotak pesan error pengecekan koneksi (animasi expand). Dipakai Kredensial API & Ollama. */
export function ConnectionTestError({ message }: { message?: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="mt-1 text-[11px] text-red-500 flex items-start gap-1.5 p-2.5 bg-red-50/50 dark:bg-red-950/15 rounded-lg border border-red-200/50 dark:border-red-900/30 font-mono select-text break-words">
            <AlertTriangle size={14} className="shrink-0 text-red-500 mt-0.5" />
            <span>{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
