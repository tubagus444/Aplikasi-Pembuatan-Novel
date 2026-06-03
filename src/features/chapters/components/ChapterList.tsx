/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db';
import { Plus, FileText, Trash2, Copy, ChevronUp, ChevronDown } from 'lucide-react';
import { cn, countWords } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ChapterStatus } from '@/src/types';
import { STATUS_DOTS } from '@/src/lib/constants';

interface ChapterListProps {
  projectId: number;
  activeChapterId: number | null;
  onSelect: (id: number | null) => void;
}

export function ChapterList({ projectId, activeChapterId, onSelect }: ChapterListProps) {
  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const chapters = useLiveQuery(async () => {
    const all = await db.chapters.where('projectId').equals(projectId).toArray();
    
    // Urutkan dan potong berdasarkan pagination
    const sorted = all.sort((a, b) => a.order - b.order);
    const paginated = sorted.slice(0, visibleCount);
    
    // Hapus konten teks dari state untuk mencegah penumpukan RAM (Lazy Loading)
    // dan hitung wordCount sejak awal
    return paginated.map(ch => ({
      ...ch,
      content: '', // Kosongkan content, kita hanya butuh judul dan metadata untuk list
      _computedWordCount: countWords(ch.content)
    }));
  }, [projectId, visibleCount]);

  const totalChapters = useLiveQuery(() => 
    db.chapters.where('projectId').equals(projectId).count()
  , [projectId]);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + PAGE_SIZE);
  };

  const addChapter = async () => {
    const nextOrder = chapters ? chapters.length : 0;
    const id = await db.chapters.add({
      projectId,
      title: `Chapter ${nextOrder + 1}`,
      content: '',
      summary: '',
      status: 'outline',
      order: nextOrder,
      lastModified: Date.now(),
    });
    onSelect(id as number);
  };

  const deleteChapter = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (deleteConfirmId === id) {
      await db.chapters.delete(id);
      setDeleteConfirmId(null);
      if (activeChapterId === id) {
        const remaining = await db.chapters.where('projectId').equals(projectId).first();
        if (remaining) {
          onSelect(remaining.id!);
        } else {
          onSelect(null);
        }
      }
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  const duplicateChapter = async (e: React.MouseEvent, chapter: any) => {
    e.stopPropagation();
    const id = await db.chapters.add({
      ...chapter,
      id: undefined,
      title: `${chapter.title} (Copy)`,
      lastModified: Date.now(),
      order: chapter.order + 1
    });
    onSelect(id as number);
  };

  const moveChapter = async (e: React.MouseEvent, chapter: any, direction: 'up' | 'down') => {
    e.stopPropagation();
    if (!chapters) return;
    const index = chapters.findIndex(c => c.id === chapter.id);
    if (direction === 'up' && index > 0) {
      const prev = chapters[index - 1];
      await db.chapters.update(chapter.id!, { order: prev.order });
      await db.chapters.update(prev.id!, { order: chapter.order });
    } else if (direction === 'down' && index < chapters.length - 1) {
      const next = chapters[index + 1];
      await db.chapters.update(chapter.id!, { order: next.order });
      await db.chapters.update(next.id!, { order: chapter.order });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-3 mb-2">
        <h2 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <FileText size={12} />
          Outline
        </h2>
        <button 
          onClick={addChapter}
          className="p-1 hover:bg-indigo-50 rounded text-slate-400 dark:text-slate-500 hover:text-indigo-600 transition-all active:scale-90"
          title="New Chapter"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="space-y-1">
        <AnimatePresence>
          {chapters?.map((chapter) => (
            <ChapterListItem
              key={chapter.id}
              chapter={chapter}
              isActive={activeChapterId === chapter.id}
              deleteConfirmId={deleteConfirmId}
              onSelect={onSelect}
              onDelete={deleteChapter}
              onDuplicate={duplicateChapter}
              onMove={moveChapter}
            />
          ))}
        </AnimatePresence>
        
        {totalChapters !== undefined && visibleCount < totalChapters && (
          <div className="pt-2 pb-1 px-1">
            <button
              onClick={handleLoadMore}
              className="w-full py-1.5 text-[10px] uppercase tracking-widest font-bold text-slate-500 hover:text-indigo-600 bg-slate-100 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700"
            >
              Load More ({totalChapters - visibleCount} left)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ChapterListItemProps {
  chapter: any;
  isActive: boolean;
  deleteConfirmId: number | null;
  onSelect: (id: number) => void;
  onDelete: (e: React.MouseEvent, id: number) => void;
  onDuplicate: (e: React.MouseEvent, chapter: any) => void;
  onMove: (e: React.MouseEvent, chapter: any, direction: 'up' | 'down') => void;
}

function ChapterListItem({ chapter, isActive, deleteConfirmId, onSelect, onDelete, onDuplicate, onMove }: ChapterListItemProps) {
  const wordCount = chapter._computedWordCount || 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative group px-1"
    >
      <div
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs transition-all text-left font-medium border-l-2 cursor-pointer group",
          isActive 
            ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-500 shadow-sm" 
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:bg-slate-800/50 border-transparent"
        )}
        onClick={() => onSelect(chapter.id!)}
      >
        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOTS[chapter.status || 'outline'])} />
        <div className="flex-1 min-w-0">
          <div className="truncate">{chapter.title}</div>
          <div className="text-[9px] text-slate-400 dark:text-slate-500 font-normal">
            {wordCount.toLocaleString()} kata
          </div>
        </div>
        
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => onMove(e, chapter, 'up')}
            className="p-1 hover:bg-white dark:hover:bg-slate-900 rounded text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:text-slate-100"
            title="Move Up"
          >
            <ChevronUp size={12} />
          </button>
          <button 
            onClick={(e) => onMove(e, chapter, 'down')}
            className="p-1 hover:bg-white dark:hover:bg-slate-900 rounded text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:text-slate-100"
            title="Move Down"
          >
            <ChevronDown size={12} />
          </button>
          <button 
            onClick={(e) => onDuplicate(e, chapter)}
            className="p-1 hover:bg-white dark:hover:bg-slate-900 rounded text-slate-400 dark:text-slate-500 hover:text-indigo-500 transition-colors"
            title="Duplicate"
          >
            <Copy size={12} />
          </button>
          <button 
            onClick={(e) => onDelete(e, chapter.id!)}
            className={cn(
              "p-1 rounded transition-colors",
              deleteConfirmId === chapter.id 
                ? "bg-red-500 text-white hover:bg-red-600" 
                : "hover:bg-white dark:hover:bg-slate-900 text-slate-400 dark:text-slate-500 hover:text-red-500"
            )}
            title={deleteConfirmId === chapter.id ? "Click again to confirm" : "Delete"}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
