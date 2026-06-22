import { useState } from 'react';
import { db } from '@/src/db';

export function useChapterDragAndDrop(chapters: any[] | undefined) {
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id.toString());
    // Small delay to allow the drag image to be generated before styling
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.style.opacity = '0.5';
      }
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedId(null);
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetId: number, options?: { adoptStatus?: boolean }) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedId || draggedId === targetId || !chapters) return;
    // Default: ikut status target (perilaku papan Kanban). Tampilan Grid mengirim
    // `false` agar drag murni mengurutkan — status tidak berubah diam-diam.
    const adoptStatus = options?.adoptStatus ?? true;

    const oldIndex = chapters.findIndex(c => c.id === draggedId);
    const newIndex = chapters.findIndex(c => c.id === targetId);

    if (oldIndex === -1 || newIndex === -1) return;

    const newChapters = [...chapters];
    const [moved] = newChapters.splice(oldIndex, 1);

    // Jatuh ke kartu di lane berbeda → ikut status lane tersebut (hanya bila adoptStatus).
    const targetChapter = chapters[newIndex];
    if (adoptStatus && moved.status !== targetChapter.status) {
      moved.status = targetChapter.status;
    }

    newChapters.splice(newIndex, 0, moved);

    // Update orders in DB atomically (and status if changed)
    await db.transaction('rw', db.chapters, async () => {
      const updates = newChapters.map((ch, index) => 
        db.chapters.update(ch.id!, { 
          order: index,
          status: ch.status
        })
      );
      await Promise.all(updates);
    });
  };

  return {
    draggedId,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop
  };
}
