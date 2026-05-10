import React, { useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { useToast, ToastMessage } from '../hooks/useToast';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const icons = {
  success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
  error: <AlertCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />
};

const bgColors = {
  success: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900',
  error: 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-900',
  warning: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900',
  info: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900'
};

export function Toast({ toast, onDismiss }: { toast: ToastMessage, onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg pointer-events-auto",
        bgColors[toast.type]
      )}
    >
      {icons[toast.type]}
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{toast.message}</p>
      <button 
        onClick={onDismiss} 
        className="ml-auto p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast();
  return (
    <div className="fixed bottom-4 right-4 z-[var(--z-overlay)] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
