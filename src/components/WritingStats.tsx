/**
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Target, TrendingUp, Edit2, Clock, BarChart2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WritingStatsProps {
  projectId: number;
}

export function WritingStats({ projectId }: WritingStatsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [isEditingDaily, setIsEditingDaily] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const chapters = useLiveQuery(() => 
    db.chapters.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const project = useLiveQuery(() => 
    db.projects.get(projectId)
  , [projectId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsEditingGoal(false);
        setIsEditingDaily(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalWords = useMemo(() => {
    if (!chapters) return 0;
    return chapters.reduce((acc, ch) => {
      const plainText = ch.content.replace(/<[^>]*>/g, ' ').trim();
      const words = plainText ? plainText.split(/\s+/).length : 0;
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
    <div className="relative" ref={dropdownRef}>
      {/* Mini Progress Pill */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-full transition-colors group text-left"
        title="Manuscript Progress"
      >
        <Target size={14} className="text-indigo-500 group-hover:scale-110 transition-transform" />
        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mr-0.5">
          {progressPercent}%
        </span>
      </button>

      {/* Popover Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-[280px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden"
            style={{ originY: 0, originX: 1 }}
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Target size={12} />
                  Manuscript Goal
                </h3>
              </div>
              
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-1 min-w-0 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="px-2 py-1 bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700">TARGET</div>
                  {isEditingGoal ? (
                    <input 
                      autoFocus
                      className="w-20 min-w-0 bg-transparent px-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
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
                      className="group flex flex-1 items-center gap-1.5 px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 transition-colors"
                      onClick={() => setIsEditingGoal(true)}
                    >
                      {wordGoal.toLocaleString()}
                      <Edit2 size={10} className="opacity-0 group-hover:opacity-100 text-slate-400 flex-shrink-0" />
                    </button>
                  )}
                </div>
                <span className="text-xs flex-shrink-0 font-medium text-slate-500 dark:text-slate-400">words total</span>
              </div>
            </div>

            <div className="p-4 grid grid-cols-2 gap-3">
              {/* Session Target */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-800 col-span-2 flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-900 rounded-md shadow-sm text-indigo-500">
                  <TrendingUp size={14} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase leading-none mb-1.5">Session Target</p>
                  {isEditingDaily ? (
                    <input 
                      autoFocus
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-0.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
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
                      className="group flex items-center gap-2 text-[13px] font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 transition-colors"
                    >
                      {dailyGoal.toLocaleString()} <span className="text-slate-400 font-normal text-xs">words</span>
                      <Edit2 size={10} className="opacity-0 group-hover:opacity-100 text-slate-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* Time to read */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                 <Clock size={14} className="text-slate-500" />
                 <div>
                   <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase leading-none mb-1">Read Time</p>
                   <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200">~{readTimeMin} min</p>
                 </div>
              </div>

              {/* Avg Length */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                 <BarChart2 size={14} className="text-slate-500" />
                 <div>
                   <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase leading-none mb-1">Avg Chapter</p>
                   <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{avgChapterWords.toLocaleString()}</p>
                 </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
