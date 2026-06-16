import { useMemo } from 'react';
import { db } from '@/src/db';
import { useOptimizedLiveQuery } from '@/src/hooks/useOptimizedLiveQuery';
import { mergeCategories, type CategoryDef } from '@/src/lib/codexCategories';
import type { CustomCategory } from '@/src/types';

/**
 * Kategori Codex untuk sebuah proyek: kategori bawaan + kustom (live dari Dexie),
 * sudah digabung & terurut untuk dipakai dropdown/ikon/label.
 */
export function useCodexCategories(projectId: number): {
  custom: CustomCategory[];
  categories: CategoryDef[];
} {
  const custom = useOptimizedLiveQuery(
    () => db.codexCategories.where('projectId').equals(projectId).toArray(),
    [projectId]
  );
  const categories = useMemo(() => mergeCategories(custom), [custom]);
  return { custom: custom ?? [], categories };
}
