/**
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { db } from '@/src/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, Cpu, Zap, Sparkles, Command, MessageSquare, ChevronRight, PenTool } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';

interface ActionsPanelProps {
  projectId: number;
}

export function ActionsPanel({ projectId }: ActionsPanelProps) {
  const customActions = useLiveQuery(() => 
    db.aiActions.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const [newLabel, setNewLabel] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const addAction = async () => {
    if (!newLabel || !newPrompt) return;
    await db.aiActions.add({
      projectId,
      label: newLabel.trim(),
      prompt: newPrompt.trim()
    });
    setNewLabel('');
    setNewPrompt('');
  };

  const deleteAction = async (id: number) => {
    await db.aiActions.delete(id);
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-10 pb-20 w-full">
      {/* Header */}
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide uppercase border border-indigo-100 dark:border-indigo-800/50">
          <Sparkles size={14} />
          <span>AI Snippets</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-serif text-slate-900 dark:text-slate-100 tracking-tight">
          Custom AI Actions
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed">
          Design personal AI shortcuts tailored to your writing style. Highlight text in the editor, and your custom snippets will appear in the floating menu.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Creator Form */}
        <section className="lg:col-span-5 h-fit sticky top-10">
          <div className={cn(
            "bg-white dark:bg-slate-900 border rounded-2xl p-6 shadow-sm transition-all duration-300",
            isFocused ? "border-indigo-400 dark:border-indigo-500 ring-4 ring-indigo-50 dark:ring-indigo-950/50" : "border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800/50"
          )}>
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <PenTool size={18} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Create Snippet
              </h2>
            </div>
            
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Command size={12} /> Button Label
                </label>
                <input 
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-400"
                  placeholder="e.g. Make it Gritty"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare size={12} /> AI Prompt Instruction
                </label>
                <textarea 
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-900 transition-all min-h-[140px] resize-none leading-relaxed placeholder:text-slate-400"
                  placeholder="e.g. Rewrite the selected text to sound more gritty and mysterious. Use shorter sentences and focus on sensory details."
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
              </div>
              
              <button 
                onClick={addAction}
                disabled={!newLabel.trim() || !newPrompt.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all active:scale-[0.98] shadow-sm hover:shadow-md"
              >
                <Plus size={16} />
                Save Snippet
              </button>
            </div>
          </div>
        </section>

        {/* Existing Snippets List */}
        <section className="lg:col-span-7">
          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout">
              {customActions && customActions.length > 0 ? (
                customActions.map((action, idx) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05 }}
                    key={action.id}
                    className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:border-indigo-200 dark:hover:border-indigo-800/50 hover:shadow-sm transition-all"
                  >
                    <div className="space-y-3 flex-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md shrink-0">
                          <Cpu size={14} />
                        </div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{action.label}</h3>
                      </div>
                      <div className="flex items-start gap-2 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50">
                        <ChevronRight size={14} className="shrink-0 mt-0.5 text-slate-400" />
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {action.prompt}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteAction(action.id!)}
                      className="shrink-0 p-2 text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors self-end sm:self-start opacity-0 group-hover:opacity-100 focus:opacity-100"
                      aria-label="Delete snippet"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center text-center py-20 px-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50"
                >
                  <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-6">
                    <Zap size={24} className="text-slate-300 dark:text-slate-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">No snippets yet</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
                    Create custom AI rules to help you rewrite, expand, or brainstorm specific text formats.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

      </div>
    </div>
  );
}
