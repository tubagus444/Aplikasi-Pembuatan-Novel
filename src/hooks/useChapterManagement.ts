import { useState } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';

export function useChapterManagement(projectId: number) {
  const chapters = useLiveQuery(() => 
    db.chapters.where('projectId').equals(projectId).sortBy('order')
  , [projectId]);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const updateField = (id: number, field: string, value: any) => {
    db.chapters.update(id, { [field]: value });
  };

  const deleteChapter = async (id: number) => {
    if (deleteConfirmId === id) {
      await db.chapters.delete(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  const addChapter = async () => {
    const nextOrder = chapters ? chapters.length : 0;
    await db.chapters.add({
      projectId,
      title: `Chapter ${nextOrder + 1}`,
      content: '',
      summary: '',
      status: 'outline',
      order: nextOrder,
      lastModified: Date.now(),
    });
  };

  return {
    chapters,
    deleteConfirmId,
    updateField,
    deleteChapter,
    addChapter
  };
}
