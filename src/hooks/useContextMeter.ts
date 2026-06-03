import { useState, useEffect, useRef } from 'react';
import { previewContextTokens } from '@/src/services/contextEngine';
import { db } from '@/src/db';

export function useContextMeter(
  projectId: number,
  chapterId: number | null,
  text: string,
  model: string = 'cl100k_base',
  debounceMs: number = 800
) {
  const [tokens, setTokens] = useState({ textTokens: 0, codexTokens: 0, rulesTokens: 0, totalTokens: 0 });
  const [isCalculating, setIsCalculating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!projectId || !chapterId) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsCalculating(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const codexEntries = await db.codex.where('projectId').equals(projectId).toArray();
        const bibleRules = await db.bible.where('projectId').equals(projectId).toArray();
        const result = await previewContextTokens(text, codexEntries, bibleRules, model);
        setTokens(result);
      } catch (err) {
        console.error('Failed to preview context tokens', err);
      } finally {
        setIsCalculating(false);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [text, projectId, chapterId, model, debounceMs]);

  return { tokens, isCalculating };
}
