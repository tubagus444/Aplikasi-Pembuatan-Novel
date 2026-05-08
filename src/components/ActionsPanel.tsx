/**
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, Cpu, Zap, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ActionsPanelProps {
  projectId: number;
}

export function ActionsPanel({ projectId }: ActionsPanelProps) {
  const customActions = useLiveQuery(() => 
    db.aiActions.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const [newLabel, setNewLabel] = useState('');
  const [newPrompt, setNewPrompt] = useState('');

  const addAction = async () => {
    if (!newLabel || !newPrompt) return;
    await db.aiActions.add({
      projectId,
      label: newLabel,
      prompt: newPrompt
    });
    setNewLabel('');
    setNewPrompt('');
  };

  const deleteAction = async (id: number) => {
    await db.aiActions.delete(id);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 pb-20">
      <header className="space-y-2">
        <h1 className="text-3xl font-serif italic text-slate-800 dark:text-slate-200">Custom AI Snippets</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Create personal AI shortcuts for your writing style. These will appear when you highlight text in the editor.</p>
      </header>

      {/* Creator Card */}
      <section className="bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-6 shadow-inner">
        <h2 className="text-xs font-bold text-indigo-400 dark:text-indigo-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Plus size={14} />
          Define New Snippet
        </h2>
        <div className="space-y-4">
          <div className="space-y-1 max-w-sm">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Button Label</label>
            <input 
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Tarantino Vibes"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Instruction (The AI Prompt)</label>
            <textarea 
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] resize-none"
              placeholder="e.g. Rewrite this paragraph into a punchy dialogue between two characters who are hiding a secret."
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
            />
          </div>
          <button 
            onClick={addAction}
            disabled={!newLabel || !newPrompt}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
          >
            <Zap size={14} />
            Add to Arsenal
          </button>
        </div>
      </section>

      {/* Lists */}
      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {customActions?.map((action) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={action.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex items-start justify-between group hover:border-indigo-300 transition-colors shadow-sm"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 rounded-md">
                    <Cpu size={16} />
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200">{action.label}</h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 italic">"{action.prompt}"</p>
              </div>
              <button 
                onClick={() => deleteAction(action.id!)}
                className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {customActions?.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <Zap size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
            <p className="text-slate-400 dark:text-slate-500 text-sm italic">You haven't crafted any custom AI snippets yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
