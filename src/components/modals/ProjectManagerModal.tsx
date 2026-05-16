/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, CheckCircle2, Book, ChevronRight, X } from 'lucide-react';
import { db } from '../../db';
import { useProject } from '../../contexts/ProjectContext';
import { useUI } from '../../contexts/UIContext';
import { motion, AnimatePresence } from 'motion/react';

export function ProjectManagerModal() {
  const { 
    projectId: currentProjectId,
    switchProject,
    createProject,
    deleteProject
  } = useProject();

  const { isProjectManagerOpen, setIsProjectManagerOpen } = useUI();

  const projects = useLiveQuery(() => db.projects.orderBy('lastOpened').reverse().toArray());
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (!isProjectManagerOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    await createProject(newProjectName.trim());
    setNewProjectName('');
    setIsCreating(false);
  };

  const handleDelete = async (id: number, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"? This will delete ALL chapters and data associated with this manuscript.`)) {
      await deleteProject(id);
    }
  };

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setIsProjectManagerOpen(false)}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-background rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh] overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Book className="text-indigo-500" size={24} />
              Your Manuscripts
            </h2>
            <p className="text-sm text-slate-500 mt-1">Manage and switch between your writing projects.</p>
          </div>
          <button 
            onClick={() => setIsProjectManagerOpen(false)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {projects?.map((p) => (
              <div 
                key={p.id}
                className={`group relative p-4 rounded-xl border transition-all duration-200 ${
                  currentProjectId === p.id 
                    ? 'bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-500/20' 
                    : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`p-3 rounded-lg ${
                      currentProjectId === p.id ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}>
                      <Book size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {p.name}
                        </h3>
                        {currentProjectId === p.id && (
                          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Last opened {new Date(p.lastOpened).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentProjectId !== p.id && (
                      <>
                        <button 
                          onClick={() => switchProject(p.id!)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white rounded-lg text-xs font-medium transition-colors"
                        >
                          Switch
                          <ChevronRight size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id!, p.name)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                          title="Delete Manuscript"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800">
          {!isCreating ? (
            <button 
              onClick={() => setIsCreating(true)}
              className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center gap-2 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group"
            >
              <Plus size={18} className="group-hover:scale-110 transition-transform" />
              <span className="font-medium text-sm">Create New Manuscript</span>
            </button>
          ) : (
            <form onSubmit={handleCreate} className="space-y-3">
              <input 
                autoFocus
                type="text"
                placeholder="Manuscript Title..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="w-full bg-background border border-indigo-200 dark:border-indigo-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <div className="flex items-center gap-2">
                <button 
                  type="submit"
                  disabled={!newProjectName.trim()}
                  className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-all"
                >
                  Create Manuscript
                </button>
                <button 
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
