import { useState, useEffect, useRef, useCallback } from 'react';

let sharedWorker: Worker | null = null;
const listeners = new Set<(e: MessageEvent) => void>();
const errorListeners = new Set<(e: Event) => void>();

function getSharedWorker(): Worker {
  if (!sharedWorker) {
    sharedWorker = new Worker(new URL('../workers/tokenWorker.ts', import.meta.url), { type: 'module' });
    
    sharedWorker.onerror = (error) => {
      // C11: JANGAN re-dispatch ErrorEvent('error') ke window — itu memicu handler error
      // global (main.tsx) & ErrorBoundary → layar crash penuh hanya karena worker
      // penghitung token gagal, plus tulis-ganda ke db.errors. Cukup log lokal + reset
      // status; penghitung token bukan fitur kritis (meter saja).
      console.error('Token worker error:', error.message || error);
      errorListeners.forEach(listener => listener(error));
    };

    sharedWorker.onmessage = (e: MessageEvent) => {
      listeners.forEach(listener => listener(e));
    };
  }
  return sharedWorker;
}

export function useTokenCounter(text: string, model: string = 'gpt-4o', debounceMs: number = 500) {
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize shared worker
    const worker = getSharedWorker();

    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'TOKEN_COUNT') {
        setTokenCount(e.data.tokens);
        setIsCalculating(false);
      }
    };

    const handleError = () => {
      setIsCalculating(false);
    };

    listeners.add(handleMessage);
    errorListeners.add(handleError);

    return () => {
      listeners.delete(handleMessage);
      errorListeners.delete(handleError);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const calculateTokens = useCallback((textToCount: string, modelToUse: string) => {
    setIsCalculating(true);
    const worker = getSharedWorker();
    worker.postMessage({ type: 'COUNT_TOKENS', text: textToCount, model: modelToUse });
  }, []);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!text) {
      setTokenCount(0);
      setIsCalculating(false);
      return;
    }

    timeoutRef.current = setTimeout(() => {
      calculateTokens(text, model);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, model, debounceMs, calculateTokens]);

  return { tokenCount, isCalculating };
}
