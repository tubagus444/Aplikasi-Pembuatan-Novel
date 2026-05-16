/**
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, GripVertical, MessageCircle, Zap, Swords, Trophy, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StoryBeat } from '../../types';

interface TimelinePanelProps {
  chapterId: number;
  projectId: number;
}

const BEAT_TYPES: { type: StoryBeat['type']; icon: any; color: string }[] = [
  { type: 'setup', icon: Info, color: 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50' },
  { type: 'action', icon: Swords, color: 'text-orange-500 bg-orange-50' },
  { type: 'dialogue', icon: MessageCircle, color: 'text-blue-500 bg-blue-50' },
  { type: 'twist', icon: Zap, color: 'text-purple-500 bg-purple-50' },
  { type: 'climax', icon: Trophy, color: 'text-amber-500 bg-amber-50' },
];

export function TimelinePanel({ chapterId, projectId }: TimelinePanelProps) {
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

  return (
    <div className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl">
      <header className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
        <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <GripVertical size={14} />
          Chapter Beats
        </h2>
      </header>

      <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-4">
        <div className="space-y-2">
          <input 
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
            placeholder="What happens in this beat?"
            value={newBeatTitle}
            onChange={(e) => setNewBeatTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addBeat()}
          />
          <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
            {BEAT_TYPES.map(({ type, icon: Icon, color }) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`p-1.5 rounded-md border flex-shrink-0 transition-all ${
                  selectedType === type 
                    ? 'border-indigo-400 ring-2 ring-indigo-50 shadow-sm' 
                    : 'border-slate-100 dark:border-slate-800 grayscale opacity-50 hover:grayscale-0 hover:opacity-100'
                } ${color}`}
                title={type}
              >
                <Icon size={12} />
              </button>
            ))}
          </div>
        </div>
        <button 
          onClick={addBeat}
          className="w-full py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <Plus size={14} />
          Add Story Beat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative custom-scrollbar">
        <div className="absolute left-6 top-8 bottom-8 w-px bg-slate-100 dark:bg-slate-800" />
        
        <AnimatePresence mode="popLayout">
          {beats?.map((beat, idx) => {
            const TypeIcon = BEAT_TYPES.find(t => t.type === beat.type)?.icon || Info;
            const TypeColor = BEAT_TYPES.find(t => t.type === beat.type)?.color || 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50';
            
            return (
              <motion.div
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={beat.id}
                className="relative pl-8 group"
              >
                <div className={`absolute left-[-4px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ring-4 ring-white z-10 ${TypeColor.split(' ')[1]} shadow-sm`} />
                
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 hover:border-indigo-200 transition-colors shadow-sm group-hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className={`p-1 rounded ${TypeColor}`}>
                        <TypeIcon size={10} />
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        Beat {idx + 1} • {beat.type}
                      </span>
                    </div>
                    <button 
                      onClick={() => deleteBeat(beat.id!)}
                      className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">{beat.title}</h3>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {beats?.length === 0 && (
          <div className="text-center py-12 relative z-10">
            <GripVertical size={24} className="mx-auto text-slate-200 mb-2 opacity-20" />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">No beats defined yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
