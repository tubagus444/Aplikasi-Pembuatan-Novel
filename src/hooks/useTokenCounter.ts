import { useState, useEffect, useRef, useCallback } from 'react';

export function useTokenCounter(text: string, model: string = 'gpt-4o', debounceMs: number = 500) {
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize worker
    workerRef.current = new Worker(new URL('../workers/tokenWorker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'TOKEN_COUNT') {
        setTokenCount(e.data.tokens);
        setIsCalculating(false);
      }
    };

    return () => {
      workerRef.current?.terminate();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const calculateTokens = useCallback((textToCount: string, modelToUse: string) => {
    setIsCalculating(true);
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'COUNT_TOKENS', text: textToCount, model: modelToUse });
    }
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
