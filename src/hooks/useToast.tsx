import React, { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { ErrorService } from '@/src/services/errorService';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastOptions {
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toast: {
    success: (msg: string, options?: ToastOptions) => void;
    error: (msg: string, options?: ToastOptions) => void;
    warning: (msg: string, options?: ToastOptions) => void;
    info: (msg: string, options?: ToastOptions) => void;
  };
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastType, message: string, options?: ToastOptions) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, type, message, action: options?.action }]);

    // Log non-success messages to the Error DB
    if (type !== 'success') {
      ErrorService.log({
        message,
        type: type,
        source: 'Toast Notification'
      });
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg: string, options?: ToastOptions) => addToast('success', msg, options),
    error: (msg: string, options?: ToastOptions) => addToast('error', msg, options),
    warning: (msg: string, options?: ToastOptions) => addToast('warning', msg, options),
    info: (msg: string, options?: ToastOptions) => addToast('info', msg, options),
  };

  return (
    <ToastContext.Provider value={{ toast, toasts, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
