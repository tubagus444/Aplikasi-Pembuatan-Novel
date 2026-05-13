/**
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { History, RotateCcw, Trash2, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { useStorageQuota } from '../hooks/useStorageQuota';

interface SnapshotPanelProps {
  chapterId: number;
  currentContent: string;
  onRestore: (content: string) => void;
}

export function SnapshotPanel({ chapterId, currentContent, onRestore }: SnapshotPanelProps) {
  const { checkStorageQuota } = useStorageQuota();
  const snapshots = useLiveQuery(() => 
    db.snapshots.where('chapterId').equals(chapterId).reverse().sortBy('timestamp')
  , [chapterId]);

  const [label, setLabel] = useState('');

  const takeSnapshot = async () => {
    if (!currentContent.trim()) return;
    await db.snapshots.add({
      chapterId,
      content: currentContent,
      label: label || `Snapshot ${format(new Date(), 'MMM d, HH:mm')}`,
      timestamp: Date.now()
    });
    setLabel('');
    checkStorageQuota();
  };

  const deleteSnapshot = async (id: number) => {
    await db.snapshots.delete(id);
  };

  return (
    <div className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl">
      <header className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
        <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <History size={14} />
          Version History
        </h2>
      </header>

      <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">Capture the current state of your chapter before making major changes.</p>
        <div className="flex gap-2">
          <input 
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Snapshot name..."
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <button 
            onClick={takeSnapshot}
            className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors shadow-sm"
            title="Take Snapshot"
          >
            <Camera size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {snapshots?.map((snap) => (
            <motion.div
              layout
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={snap.id}
              className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2 group hover:border-indigo-200 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{snap.label}</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{format(snap.timestamp, 'MMM d, yyyy HH:mm:ss')}</p>
                </div>
                <button 
                  onClick={() => deleteSnapshot(snap.id!)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              
              <button 
                onClick={() => onRestore(snap.content)}
                className="w-full py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded flex items-center justify-center gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"
              >
                <RotateCcw size={10} />
                Restore this version
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {snapshots?.length === 0 && (
          <div className="text-center py-12">
            <History size={24} className="mx-auto text-slate-200 mb-2 opacity-20" />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">No snapshots saved yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
