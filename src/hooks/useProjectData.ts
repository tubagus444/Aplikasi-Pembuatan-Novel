import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db';
import { CodexEntry, AIAction, StoryBibleRule } from '@/src/types';

export function useProjectData(projectId: number) {
  const codexEntries = useLiveQuery(() => 
    db.codex.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const aiActions = useLiveQuery(() => 
    db.aiActions.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const bibleRules = useLiveQuery(() =>
    db.bible.where('projectId').equals(projectId).toArray()
  , [projectId]);

  return {
    codexEntries: codexEntries || [],
    aiActions: aiActions || [],
    bibleRules: bibleRules || [],
    isLoading: codexEntries === undefined || aiActions === undefined || bibleRules === undefined
  };
}
