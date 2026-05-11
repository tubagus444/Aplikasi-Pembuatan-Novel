/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Sparkles, LayoutList, GripVertical, Trash2, UserCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { processChat } from '../services/ai';
import { ChapterStatus } from '../types';
import { cn } from '../lib/utils';
import { STATUS_COLORS } from '../lib/constants';

interface OutlinePanelProps {
  projectId: number;
}

export function OutlinePanel({ projectId }: OutlinePanelProps) {
  const chapters = useLiveQuery(() => 
    db.chapters.where('projectId').equals(projectId).sortBy('order')
  , [projectId]);

  const [isGenerating, setIsGenerating] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  
  // Drag and Drop state
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
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

  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId || !chapters) return;

    const oldIndex = chapters.findIndex(c => c.id === draggedId);
    const newIndex = chapters.findIndex(c => c.id === targetId);

    if (oldIndex === -1 || newIndex === -1) return;

    const newChapters = [...chapters];
    const [moved] = newChapters.splice(oldIndex, 1);
    newChapters.splice(newIndex, 0, moved);

    // Update orders in DB atomically
    await db.transaction('rw', db.chapters, async () => {
      const updates = newChapters.map((ch, index) => 
        db.chapters.update(ch.id!, { order: index })
      );
      await Promise.all(updates);
    });
  };

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

  const generateBeats = async (chapterId: number, currentTitle: string, currentSummary: string) => {
    setIsGenerating(chapterId);
    try {
      const allCodex = await db.codex.where('projectId').equals(projectId).toArray();
      const bibleRules = await db.bible.where('projectId').equals(projectId).toArray();
      const allChapters = await db.chapters.where('projectId').equals(projectId).sortBy('order');
      const currentChapter = allChapters.find(c => c.id === chapterId);
      const currentOrder = currentChapter ? currentChapter.order : 0;
      
      const projectContext = allChapters
        .filter(c => Math.abs(c.order - currentOrder) <= 3)
        .map(c => {
          let summary = c.summary || 'None';
          if (summary.length > 200) {
            summary = summary.substring(0, 200) + '...';
          }
          return `Chapter: ${c.title}\nSummary: ${summary}`;
        }).join('\n\n');

      const prompt = `Based on the overall story outline:\n\n${projectContext}\n\nPlease generate a bulleted list of 3-5 scene beats/plot points for the chapter titled "${currentTitle}". Keep it concise and focus on advancing the plot. Avoid mentioning that you are an AI. Only output the beats.`;

      const reply = await processChat({
        message: prompt,
        history: [],
        bibleRules,
        codexEntries: allCodex,
        contextText: ""
      });

      const newSummary = (currentSummary ? currentSummary + '\n\n' : '') + reply;
      await db.chapters.update(chapterId, { summary: newSummary });
    } catch (err) {
      console.error(err);
      alert('Failed to generate beats.');
    } finally {
      setIsGenerating(null);
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
          <motion.div 
            key={chapter.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            draggable
            onDragStart={(e: any) => handleDragStart(e, chapter.id!)}
            onDragOver={handleDragOver}
            onDrop={(e: any) => handleDrop(e, chapter.id!)}
            onDragEnd={handleDragEnd as any}
            className={cn(
              "group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col relative",
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
                  onChange={(e) => updateField(chapter.id!, 'title', e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()} // Let user drag from anywhere on the card OR ensure they must grab the handle
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <button 
                onClick={() => deleteChapter(chapter.id!)}
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

            <div className="flex items-center gap-2 mb-4">
              <select 
                value={chapter.status || 'outline'}
                onChange={(e) => updateField(chapter.id!, 'status', e.target.value)}
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
              
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-full px-2 py-1 flex-1">
                <UserCircle size={12} className="text-slate-400 dark:text-slate-500" />
                <input 
                  className="bg-transparent text-[10px] font-bold text-slate-600 dark:text-slate-400 focus:outline-none w-full placeholder:text-slate-300 uppercase tracking-wider"
                  placeholder="POV..."
                  value={chapter.pov || ''}
                  onChange={(e) => updateField(chapter.id!, 'pov', e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 flex flex-col pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mb-2 flex items-center justify-between">
                <span>Directives & Beats</span>
                <button 
                  onClick={() => generateBeats(chapter.id!, chapter.title, chapter.summary || '')}
                  disabled={isGenerating === chapter.id}
                  className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <Sparkles size={12} />
                  <span>{isGenerating === chapter.id ? '...' : 'AI Beats'}</span>
                </button>
              </label>
              <textarea 
                className="w-full flex-1 min-h-[140px] text-[13px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-3 resize-none focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 transition-all font-serif italic"
                placeholder="Story beats..."
                value={chapter.summary || ''}
                onChange={(e) => updateField(chapter.id!, 'summary', e.target.value)}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
