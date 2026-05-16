/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Plus, Sparkles, LayoutList, GripVertical, Trash2, UserCircle, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, countWords } from '../lib/utils';
import { STATUS_COLORS } from '../lib/constants';
import { useChapterManagement } from '../hooks/useChapterManagement';
import { useChapterDragAndDrop } from '../hooks/useChapterDragAndDrop';
import { useGenerateBeats } from '../hooks/useGenerateBeats';

interface OutlinePanelProps {
  projectId: number;
}

export function OutlinePanel({ projectId }: OutlinePanelProps) {
  const { chapters, deleteConfirmId, updateField, deleteChapter, addChapter } = useChapterManagement(projectId);
  const { draggedId, handleDragStart, handleDragEnd, handleDragOver, handleDrop } = useChapterDragAndDrop(chapters);
  const { generateBeats, isGenerating } = useGenerateBeats(projectId);

  return (
    <div className="max-w-5xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-10 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h2 className="text-3xl font-serif font-bold text-slate-900 dark:text-slate-100 capitalize">Planning Board</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Outline your chapters, synthesize beats, and structure your narrative.</p>
        </div>
        <button 
          onClick={addChapter}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md active:scale-95"
        >
          <Plus size={16} /> New Chapter
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {chapters?.map((chapter, index) => (
          <ChapterCard
            key={chapter.id}
            chapter={chapter}
            index={index}
            draggedId={draggedId}
            deleteConfirmId={deleteConfirmId}
            isGenerating={isGenerating === chapter.id}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            onUpdateField={updateField}
            onDelete={deleteChapter}
            onGenerateBeats={generateBeats}
          />
        ))}
      </div>
    </div>
  );
}

interface ChapterCardProps {
  chapter: any;
  index: number;
  draggedId: number | null;
  deleteConfirmId: number | null;
  isGenerating: boolean;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetId: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onUpdateField: (id: number, field: string, value: any) => void;
  onDelete: (id: number) => void;
  onGenerateBeats: (chapterId: number, title: string, summary: string) => void;
}

function ChapterCard({ 
  chapter, 
  index, 
  draggedId, 
  deleteConfirmId, 
  isGenerating,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onUpdateField,
  onDelete,
  onGenerateBeats
}: ChapterCardProps) {
  const wordCount = useMemo(() => countWords(chapter.content), [chapter.content]);
  const progressPercent = chapter.wordGoal ? Math.min(100, Math.round((wordCount / chapter.wordGoal) * 100)) : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      draggable
      onDragStart={(e: any) => onDragStart(e, chapter.id!)}
      onDragOver={onDragOver}
      onDrop={(e: any) => onDrop(e, chapter.id!)}
      onDragEnd={onDragEnd as any}
      className={cn(
        "group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col relative overflow-hidden",
        draggedId === chapter.id ? "opacity-50 border-indigo-500 scale-[0.98]" : "opacity-100"
      )}
      style={{ transition: 'opacity 0.2s, transform 0.2s, border-color 0.2s' }}
    >
      <div className="flex items-center justify-between mb-4 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2 flex-1">
          <GripVertical size={16} className="text-slate-300 pointer-events-none" />
          <input 
            className="font-bold text-slate-900 dark:text-slate-100 focus:outline-none border-b border-transparent focus:border-indigo-300 bg-transparent px-1 truncate w-full text-sm"
            value={chapter.title}
            onChange={(e) => onUpdateField(chapter.id!, 'title', e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              {wordCount.toLocaleString()} kata
            </span>
            <button 
              onClick={() => onDelete(chapter.id!)}
              className={cn(
                "p-1.5 transition-all rounded-md opacity-0 group-hover:opacity-100",
                deleteConfirmId === chapter.id 
                  ? "bg-red-500 text-white hover:bg-red-600 opacity-100" 
                  : "text-slate-300 hover:text-red-500 hover:bg-red-50"
              )}
              title={deleteConfirmId === chapter.id ? "Click again to delete" : "Delete"}
            >
              <Trash2 size={14} />
            </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <select 
          value={chapter.status || 'outline'}
          onChange={(e) => onUpdateField(chapter.id!, 'status', e.target.value)}
          className={cn(
            "text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full outline-none transition-colors border border-transparent focus:border-indigo-200",
            STATUS_COLORS[chapter.status || 'outline']
          )}
        >
          <option value="outline">Outline</option>
          <option value="draft">Drafting</option>
          <option value="edit">Editing</option>
          <option value="polish">Polishing</option>
          <option value="done">Completed</option>
        </select>
        
        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-full px-2 py-1 flex-1 min-w-0">
          <UserCircle size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
          <input 
            className="bg-transparent text-[10px] font-bold text-slate-600 dark:text-slate-400 focus:outline-none w-full placeholder:text-slate-300 uppercase tracking-wider truncate"
            placeholder="POV..."
            value={chapter.pov || ''}
            onChange={(e) => onUpdateField(chapter.id!, 'pov', e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-1 w-20">
          <Target size={10} className="text-slate-400 shrink-0" />
          <input 
            className="bg-transparent text-[10px] font-bold text-slate-600 dark:text-slate-400 focus:outline-none w-full placeholder:text-slate-400"
            placeholder="GOAL"
            type="number"
            value={chapter.wordGoal || ''}
            onChange={(e) => onUpdateField(chapter.id!, 'wordGoal', parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col pt-4 border-t border-slate-100 dark:border-slate-800">
        <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mb-2 flex items-center justify-between">
          <span>Directives & Beats</span>
          <button 
            onClick={() => onGenerateBeats(chapter.id!, chapter.title, chapter.summary || '')}
            disabled={isGenerating}
            className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Sparkles size={12} />
            <span>{isGenerating ? '...' : 'AI Beats'}</span>
          </button>
        </label>
        <textarea 
          className="w-full flex-1 min-h-[140px] text-[13px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-3 resize-none focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 transition-all font-serif italic"
          placeholder="Story beats..."
          value={chapter.summary || ''}
          onChange={(e) => onUpdateField(chapter.id!, 'summary', e.target.value)}
        />
      </div>

      {chapter.wordGoal > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            className={cn(
              "h-full transition-all duration-500",
              progressPercent >= 100 ? "bg-emerald-500" : "bg-indigo-500"
            )}
          />
        </div>
      )}
    </motion.div>
  );
}
