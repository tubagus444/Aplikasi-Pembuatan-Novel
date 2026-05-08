/**
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Target, TrendingUp, Edit2, Clock, BookOpen, BarChart2 } from 'lucide-react';

interface WritingStatsProps {
  projectId: number;
}

export function WritingStats({ projectId }: WritingStatsProps) {
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [isEditingDaily, setIsEditingDaily] = useState(false);
  const chapters = useLiveQuery(() => 
    db.chapters.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const project = useLiveQuery(() => 
    db.projects.get(projectId)
  , [projectId]);

  const totalWords = useMemo(() => {
    if (!chapters) return 0;
    return chapters.reduce((acc, ch) => {
      const words = ch.content.trim() ? ch.content.trim().split(/\s+/).length : 0;
      return acc + words;
    }, 0);
  }, [chapters]);

  const wordGoal = project?.wordGoal || 50000;
  const dailyGoal = project?.dailyGoal || 1500;
  const progressPercent = Math.min(100, Math.round((totalWords / wordGoal) * 100));
  
  const readTimeMin = Math.ceil(totalWords / 250);
  const avgChapterWords = chapters && chapters.length > 0 ? Math.round(totalWords / chapters.length) : 0;

  const updateGoal = (newGoal: string) => {
    const val = parseInt(newGoal.replace(/,/g, ''));
    if (!isNaN(val) && val > 0) {
      db.projects.update(projectId, { wordGoal: val });
    }
  };

  const updateDailyGoal = (newGoal: string) => {
    const val = parseInt(newGoal.replace(/,/g, ''));
    if (!isNaN(val) && val > 0) {
      db.projects.update(projectId, { dailyGoal: val });
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between px-3">
        <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Target size={12} />
          Manuscript Progress
        </h3>
      </div>

      <div className="px-3 space-y-4">
        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium">
            <div className="flex items-center gap-1">
              <span className="text-slate-600 dark:text-slate-400">{totalWords.toLocaleString()} / </span>
              {isEditingGoal ? (
                <input 
                  autoFocus
                  className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1 focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:text-slate-200"
                  defaultValue={wordGoal}
                  onBlur={(e) => {
                    updateGoal(e.target.value);
                    setIsEditingGoal(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateGoal((e.target as HTMLInputElement).value);
                      setIsEditingGoal(false);
                    }
                  }}
                />
              ) : (
                <button 
                  className="group flex items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-indigo-600 transition-colors"
                  onClick={() => setIsEditingGoal(true)}
                  title="Edit Manuscript Goal"
                >
                  <span className="font-bold underline decoration-dotted decoration-slate-300 group-hover:decoration-indigo-300">
                    {wordGoal.toLocaleString()}
                  </span>
                  <Edit2 size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
              <span className="text-slate-600 dark:text-slate-400 ml-1">words</span>
            </div>
            <span className="text-indigo-600 font-bold">{progressPercent}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 transition-all duration-1000 ease-out" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Extended Stats */}
        <div className="grid grid-cols-2 gap-2">
          {/* Target */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800 col-span-2 flex items-center gap-3">
            <div className="p-1.5 bg-white dark:bg-slate-900 rounded shadow-sm text-indigo-500">
              <TrendingUp size={12} />
            </div>
            <div className="flex-1">
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase leading-none mb-1">Session Target</p>
              {isEditingDaily ? (
                <input 
                  autoFocus
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
                  defaultValue={dailyGoal}
                  onBlur={(e) => {
                    updateDailyGoal(e.target.value);
                    setIsEditingDaily(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateDailyGoal((e.target as HTMLInputElement).value);
                      setIsEditingDaily(false);
                    }
                  }}
                />
              ) : (
                <button 
                  onClick={() => setIsEditingDaily(true)}
                  className="group flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 transition-colors"
                >
                  {dailyGoal.toLocaleString()} words
                  <Edit2 size={8} className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-500" />
                </button>
              )}
            </div>
          </div>

          {/* Time to read */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800 flex flex-col gap-1.5">
             <Clock size={12} className="text-slate-400" />
             <div>
               <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase leading-none mb-1">Read Time</p>
               <p className="text-xs font-bold text-slate-700 dark:text-slate-200">~{readTimeMin} min</p>
             </div>
          </div>

          {/* Avg Length */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800 flex flex-col gap-1.5">
             <BarChart2 size={12} className="text-slate-400" />
             <div>
               <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase leading-none mb-1">Avg Chapter</p>
               <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{avgChapterWords.toLocaleString()} w</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
