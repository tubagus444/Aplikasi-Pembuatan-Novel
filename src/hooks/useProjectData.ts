import { useOptimizedLiveQuery } from '@/src/hooks/useOptimizedLiveQuery';
import { db } from '@/src/db';
import { CodexEntry, AIAction, StoryBibleRule } from '@/src/types';

export function useProjectData(projectId: number) {
  const codexEntries = useOptimizedLiveQuery(() => 
    db.codex.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const aiActions = useOptimizedLiveQuery(() => 
    db.aiActions.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const bibleRules = useOptimizedLiveQuery(() =>
    db.bible.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const relationships = useOptimizedLiveQuery(() =>
    db.relationships.where('projectId').equals(projectId).toArray()
  , [projectId]);

  return {
    codexEntries: codexEntries || [],
    aiActions: aiActions || [],
    bibleRules: bibleRules || [],
    relationships: relationships || [],
    isLoading: codexEntries === undefined || aiActions === undefined || bibleRules === undefined || relationships === undefined
  };
}
