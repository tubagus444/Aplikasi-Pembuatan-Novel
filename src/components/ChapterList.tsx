/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Plus, FileText, Trash2, Copy, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ChapterStatus } from '../types';

interface ChapterListProps {
  projectId: number;
  activeChapterId: number | null;
  onSelect: (id: number | null) => void;
}

const STATUS_DOTS: Record<ChapterStatus, string> = {
  outline: 'bg-slate-300',
  draft: 'bg-indigo-400',
  edit: 'bg-amber-400',
  polish: 'bg-emerald-400',
  done: 'bg-blue-500'
};

export function ChapterList({ projectId, activeChapterId, onSelect }: ChapterListProps) {
  const chapters = useLiveQuery(() => 
    db.chapters.where('projectId').equals(projectId).sortBy('order')
  , [projectId]);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

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
            <motion.div
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={chapter.id}
              className="relative group px-1"
            >
              <div
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs transition-all text-left font-medium border-l-2 cursor-pointer group",
                  activeChapterId === chapter.id 
                    ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-500 shadow-sm" 
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:bg-slate-800/50 border-transparent"
                )}
                onClick={() => onSelect(chapter.id!)}
              >
                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOTS[chapter.status || 'outline'])} />
                <span className="truncate flex-1">{chapter.title}</span>
                
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => moveChapter(e, chapter, 'up')}
                    className="p-1 hover:bg-white dark:hover:bg-slate-900 rounded text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:text-slate-100"
                    title="Move Up"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button 
                    onClick={(e) => moveChapter(e, chapter, 'down')}
                    className="p-1 hover:bg-white dark:hover:bg-slate-900 rounded text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:text-slate-100"
                    title="Move Down"
                  >
                    <ChevronDown size={12} />
                  </button>
                  <button 
                    onClick={(e) => duplicateChapter(e, chapter)}
                    className="p-1 hover:bg-white dark:hover:bg-slate-900 rounded text-slate-400 dark:text-slate-500 hover:text-indigo-500 transition-colors"
                    title="Duplicate"
                  >
                    <Copy size={12} />
                  </button>
                  <button 
                    onClick={(e) => deleteChapter(e, chapter.id!)}
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
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
