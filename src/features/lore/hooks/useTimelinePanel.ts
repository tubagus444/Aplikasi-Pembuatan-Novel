import { useState } from 'react';
import { db } from '@/src/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { StoryBeat } from '@/src/types';

export function useTimelinePanel(chapterId: number, projectId: number) {
  const beats = useLiveQuery(() => 
    db.timeline.where('chapterId').equals(chapterId).sortBy('order')
  , [chapterId]);

  const [newBeatTitle, setNewBeatTitle] = useState('');
  const [selectedType, setSelectedType] = useState<StoryBeat['type']>('setup');

  const addBeat = async () => {
    if (!newBeatTitle.trim()) return;
    const order = (beats?.length || 0);
    await db.timeline.add({
      chapterId,
      projectId,
      title: newBeatTitle,
      description: '',
      type: selectedType,
      order
    });
    setNewBeatTitle('');
  };

  const deleteBeat = async (id: number) => {
    await db.timeline.delete(id);
  };

  return {
    beats,
    newBeatTitle,
    setNewBeatTitle,
    selectedType,
    setSelectedType,
    addBeat,
    deleteBeat
  };
}
