/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ChevronRight, Search, Moon, Sun, Zap, Download } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { useTheme } from '../../ThemeContext';
import { WritingStats } from '../WritingStats';
import { cn } from '../../lib/utils';

export function Header() {
  const { 
    projectId, 
    viewMode, 
    sidebarOpen, 
    setSidebarOpen, 
    isFocusMode, 
    setIsFocusMode,
    setIsSearchOpen,
    setIsExportOpen,
    activeChapter 
  } = useAppContext();
  
  const { theme, toggleTheme } = useTheme();

  if (isFocusMode) return null;

  return (
    <header className="h-14 flex-none border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 md:px-5 bg-background z-[var(--z-overlay)] shadow-sm transition-colors">
      {/* Left: Navigation Group */}
      <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-md text-slate-400 dark:text-slate-500 hover:text-indigo-600 transition-colors flex-shrink-0"
          aria-label="Toggle Sidebar"
          title="Toggle Sidebar"
        >
          <ChevronRight size={18} className={cn("transition-transform", sidebarOpen && "rotate-180")} />
        </button>
        
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />
        
        <button 
          onClick={() => setIsSearchOpen(true)}
          className="p-1.5 flex items-center justify-center bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-md text-slate-400 dark:text-slate-500 hover:text-indigo-600 transition-colors flex-shrink-0"
          title="Search (Ctrl+K)"
        >
          <Search size={16} />
        </button>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0 mx-1 hidden sm:block" />
        
        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px] md:max-w-[200px] flex-shrink flex-grow-0 ml-1">
          {viewMode === 'write' && activeChapter ? `${activeChapter.title}` : viewMode.toUpperCase()}
        </span>
      </div>
      
      {/* Right: Actions Group */}
      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        {projectId && (
          <div className="flex-shrink-0 flex items-center">
            <WritingStats projectId={projectId} />
          </div>
        )}
        
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

        <div className="flex items-center gap-1 flex-shrink-0">
          <button 
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-md"
            title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          
          <button 
            onClick={() => setIsExportOpen(true)} 
            className="flex items-center justify-center p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-md"
            title="Export Project"
          >
            <Download size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
