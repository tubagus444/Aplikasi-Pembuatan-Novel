/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureDefaultProject } from './db';
import { Book, FileText, Settings, Sparkles, Database, ChevronLeft, ChevronRight, Plus, ScrollText, LayoutList, Zap, Moon, Sun, Monitor, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from './ThemeContext';
import { ChapterList } from './components/ChapterList';
import { NovelEditor } from './components/NovelEditor';
import { CodexPanel } from './components/CodexPanel';
import { BiblePanel } from './components/BiblePanel';
import { OutlinePanel } from './components/OutlinePanel';
import { ActionsPanel } from './components/ActionsPanel';
import { WritingStats } from './components/WritingStats';
import { GlobalSearch } from './components/GlobalSearch';
import { ExportManager } from './components/ExportManager';
import { RelationshipMapper } from './components/RelationshipMapper';
import { SettingsPanel } from './components/SettingsPanel';
import { GuidePanel } from './components/GuidePanel';
import { Search, Share2, HelpCircle, Download } from 'lucide-react';
import { cn } from './lib/utils';
import { ToastProvider } from './hooks/useToast';
import { ToastContainer } from './components/Toast';

import { ErrorLogPanel } from './components/ErrorLogPanel';
import { ErrorService } from './services/errorService';

type ViewMode = 'write' | 'outline' | 'codex' | 'bible' | 'settings' | 'actions' | 'relationships' | 'guide' | 'errors';

export default function App() {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('write');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Initialize DB and Project
  useEffect(() => {
    // Global Error Handling
    const handleGlobalError = (event: ErrorEvent) => {
      ErrorService.log({
        message: event.message,
        type: 'error',
        source: 'Global (Window)',
        stack: event.error?.stack
      });
    };

    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      ErrorService.log({
        message: event.reason?.message || String(event.reason),
        type: 'error',
        source: 'Promise Rejection',
        stack: event.reason?.stack,
        metadata: { reason: event.reason }
      });
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handlePromiseRejection);

    ensureDefaultProject().then(id => {
      if (id) {
        setProjectId(id);
        db.chapters.where('projectId').equals(id).first().then(ch => {
          if (ch) setActiveChapterId(ch.id!);
        });
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handlePromiseRejection);
    };
  }, []);

  const project = useLiveQuery(() => 
    projectId ? db.projects.get(projectId) : undefined
  , [projectId]);

  const activeChapter = useLiveQuery(() => 
    activeChapterId ? db.chapters.get(activeChapterId) : undefined
  , [activeChapterId]);

  // Handle case where active chapter is deleted from elsewhere (e.g. OutlinePanel)
  useEffect(() => {
    // If activeChapterId is set but activeChapter is explicitly undefined (not found),
    // we should try to switch to a different chapter.
    if (activeChapterId && activeChapter === undefined) {
      db.chapters.where('projectId').equals(projectId!).first().then(ch => {
        if (ch) {
          setActiveChapterId(ch.id!);
        } else {
          setActiveChapterId(null);
        }
      });
    }
  }, [activeChapter, activeChapterId, projectId]);

  const handleExport = async () => {
    if (!projectId) return;
    const allChapters = await db.chapters.where('projectId').equals(projectId).sortBy('order');
    let exportText = `# ${project?.name || 'Untitled Project'}\n\n`;
    allChapters.forEach(ch => {
      exportText += `## ${ch.title}\n\n${ch.content}\n\n`;
    });
    const blob = new Blob([exportText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.name || 'Manuscript'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { theme, toggleTheme } = useTheme();

  if (!projectId) return <div className="h-screen w-screen flex items-center justify-center bg-background text-slate-400 dark:text-slate-500 font-mono text-xs uppercase tracking-widest">Initialising AetherScribe...</div>;

  return (
    <ToastProvider>
      <div className={cn(
        "flex h-screen bg-background text-foreground overflow-hidden font-sans transition-all duration-700",
        isFocusMode && "bg-secondary"
      )}>
        {/* Sidebar Navigation */}
        <AnimatePresence>
          {!isFocusMode && (
            <motion.aside 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: sidebarOpen ? 260 : 0, opacity: sidebarOpen ? 1 : 0 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col relative z-[var(--z-panel)] overflow-hidden shadow-sm shrink-0"
            >
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white shrink-0 shadow-sm">
              <ScrollText size={18} />
            </div>
            <input 
              className="font-bold text-sm tracking-tight bg-transparent focus:outline-none w-full border-none p-0 h-auto text-slate-900 dark:text-slate-100"
              value={project?.name || ''}
              onChange={(e) => projectId && db.projects.update(projectId, { name: e.target.value })}
            />
          </div>
          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em] ml-10">Writer Pro v1.0</p>
          
          <nav role="navigation" className="mt-6 space-y-1">
            <button 
              onClick={() => setViewMode('write')}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all",
                viewMode === 'write' ? "bg-indigo-50 text-indigo-700 border-l-2 border-indigo-500 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              )}
            >
              <FileText size={14} /> Editor
            </button>
            <button 
              onClick={() => setViewMode('outline')}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all",
                viewMode === 'outline' ? "bg-indigo-50 text-indigo-700 border-l-2 border-indigo-500 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              )}
            >
              <LayoutList size={14} /> Planning Board
            </button>
            <button 
              onClick={() => setViewMode('codex')}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all",
                viewMode === 'codex' ? "bg-indigo-50 text-indigo-700 border-l-2 border-indigo-500 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              )}
            >
              <Database size={14} /> Codex
            </button>
            <button 
              onClick={() => setViewMode('bible')}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all",
                viewMode === 'bible' ? "bg-indigo-50 text-indigo-700 border-l-2 border-indigo-500 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              )}
            >
              <Book size={14} /> Story Bible
            </button>
            <button 
              onClick={() => setViewMode('relationships')}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all",
                viewMode === 'relationships' ? "bg-indigo-50 text-indigo-700 border-l-2 border-indigo-500 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              )}
            >
              <Share2 size={14} /> Relations
            </button>
            <button 
              onClick={() => setViewMode('actions')}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all",
                viewMode === 'actions' ? "bg-indigo-50 text-indigo-700 border-l-2 border-indigo-500 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              )}
            >
              <Sparkles size={14} /> AI Snippets
            </button>
            <button 
              onClick={() => setViewMode('guide')}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all",
                viewMode === 'guide' ? "bg-indigo-50 text-indigo-700 border-l-2 border-indigo-500 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              )}
            >
              <HelpCircle size={14} /> Panduan
            </button>
            <button 
              onClick={() => setViewMode('settings')}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all",
                viewMode === 'settings' ? "bg-indigo-50 text-indigo-700 border-l-2 border-indigo-500 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              )}
            >
              <Settings size={14} /> Pengaturan
            </button>
            <button 
              onClick={() => setViewMode('errors')}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all",
                viewMode === 'errors' ? "bg-indigo-50 text-indigo-700 border-l-2 border-indigo-500 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              )}
            >
              <AlertTriangle size={14} /> Log Error
            </button>
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-4 no-scrollbar">
          {viewMode === 'write' && (
            <ChapterList 
              projectId={projectId} 
              activeChapterId={activeChapterId} 
              onSelect={setActiveChapterId} 
            />
          )}
          {viewMode === 'codex' && <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-4 px-4">Worldbuilding Data</p>}
          {viewMode === 'bible' && <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-4 px-4">Core Constraints</p>}
        </div>
      </motion.aside>
      )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative bg-background">
        {/* Focus Toggle (Exit) - only visible in focus mode */}
        <AnimatePresence>
          {isFocusMode && (
            <motion.button 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setIsFocusMode(false)}
              className="fixed top-6 right-6 z-[var(--z-modal)] p-3 rounded-full shadow-2xl transition-all duration-300 bg-slate-900 dark:bg-slate-800 text-white hover:scale-110 border border-slate-700 hover:bg-slate-800 dark:hover:bg-slate-700"
              title="Exit Focus Mode"
            >
              <Plus className="rotate-45" size={24} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Toolbar */}
        {!isFocusMode && (
          <header className="h-14 flex-none border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 md:px-5 gap-2 md:gap-4 bg-background z-[var(--z-overlay)] shadow-sm transition-colors relative">
          <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-md text-slate-400 dark:text-slate-500 hover:text-indigo-600 transition-colors flex-shrink-0"
              aria-label="Toggle Sidebar"
              title="Toggle Sidebar"
            >
              <ChevronRight size={18} className={cn("transition-transform", sidebarOpen && "rotate-180")} />
            </button>
            <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="p-1.5 flex items-center justify-center bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-md text-slate-400 dark:text-slate-500 hover:text-indigo-600 transition-colors flex-shrink-0"
              title="Search (Ctrl+K)"
            >
              <Search size={16} />
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0 mx-1" />
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px] md:max-w-[200px] flex-shrink flex-grow-0">
              {viewMode === 'write' && activeChapter ? `${activeChapter.title}` : viewMode.toUpperCase()}
            </span>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {projectId && <div className="flex-shrink-0 flex items-center mr-1"><WritingStats projectId={projectId} /></div>}
            
            <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

            <div className="flex items-center gap-1 flex-shrink-0">
              <button 
                onClick={toggleTheme}
                aria-label="Toggle Theme"
                className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-md"
                title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
              >
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              </button>
            </div>

            <div className="flex items-center justify-center p-1.5" title="Local Sync Active">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse outline outline-2 outline-emerald-500/20"></div>
            </div>
            
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {viewMode === 'write' && (
                <button 
                  onClick={() => setIsFocusMode(true)} 
                  className="flex items-center justify-center p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-md"
                  title="Enter Focus Mode"
                >
                  <Zap size={16} />
                </button>
              )}
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
        )}

        {/* Dynamic View Content */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {viewMode === 'write' && (
              <motion.div 
                key="editor"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="h-full"
              >
                {activeChapterId && projectId ? (
                  <NovelEditor 
                    chapterId={activeChapterId} 
                    projectId={projectId} 
                    isFocusMode={isFocusMode}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300">
                    <ScrollText size={48} className="mb-4 opacity-20" />
                    <p className="font-serif italic text-lg">Select a chapter to begin your journey.</p>
                  </div>
                )}
              </motion.div>
            )}

            {viewMode === 'outline' && (
              <motion.div 
                key="outline"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full p-10 overflow-y-auto custom-scrollbar"
              >
                <OutlinePanel projectId={projectId} />
              </motion.div>
            )}

            {viewMode === 'codex' && (
              <motion.div 
                key="codex"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full p-10 overflow-y-auto custom-scrollbar"
              >
                <CodexPanel projectId={projectId} />
              </motion.div>
            )}

            {viewMode === 'actions' && (
              <motion.div 
                key="actions"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full p-10 overflow-y-auto custom-scrollbar"
              >
                <ActionsPanel projectId={projectId} />
              </motion.div>
            )}

            {viewMode === 'relationships' && (
              <motion.div 
                key="relationships"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full p-10 overflow-y-auto custom-scrollbar"
              >
                <RelationshipMapper projectId={projectId} />
              </motion.div>
            )}

            {viewMode === 'bible' && (
              <motion.div 
                key="bible"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full p-10 overflow-y-auto custom-scrollbar"
              >
                <BiblePanel projectId={projectId} />
              </motion.div>
            )}

            {viewMode === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full p-10 overflow-y-auto custom-scrollbar"
              >
                <SettingsPanel />
              </motion.div>
            )}

            {viewMode === 'guide' && (
              <motion.div 
                key="guide"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full p-10 overflow-y-auto custom-scrollbar"
              >
                <GuidePanel />
              </motion.div>
            )}

            {viewMode === 'errors' && (
              <motion.div 
                key="errors"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full p-10 overflow-y-auto custom-scrollbar"
              >
                <ErrorLogPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isSearchOpen && projectId && (
          <GlobalSearch 
            projectId={projectId}
            onClose={() => setIsSearchOpen(false)}
            onSelectChapter={(id) => {
              setActiveChapterId(id);
              setViewMode('write');
            }}
            onSelectCodex={(id) => {
              setViewMode('codex');
            }}
          />
        )}

        {isExportOpen && projectId && (
          <ExportManager 
            projectId={projectId} 
            project={project} 
            onClose={() => setIsExportOpen(false)} 
          />
        )}
      </main>
      <ToastContainer />
    </div>
    </ToastProvider>
  );
}
