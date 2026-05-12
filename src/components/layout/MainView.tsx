/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScrollText, Plus, Loader2 } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { NovelEditor } from '../NovelEditor';
import { cn } from '../../lib/utils';

// Lazy load heavy components
const OutlinePanel = lazy(() => import('../OutlinePanel').then(m => ({ default: m.OutlinePanel })));
const CodexPanel = lazy(() => import('../CodexPanel').then(m => ({ default: m.CodexPanel })));
const ActionsPanel = lazy(() => import('../ActionsPanel').then(m => ({ default: m.ActionsPanel })));
const RelationshipMapper = lazy(() => import('../RelationshipMapper').then(m => ({ default: m.RelationshipMapper })));
const BiblePanel = lazy(() => import('../BiblePanel').then(m => ({ default: m.BiblePanel })));
const SettingsPanel = lazy(() => import('../SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const GuidePanel = lazy(() => import('../GuidePanel').then(m => ({ default: m.GuidePanel })));
const ErrorLogPanel = lazy(() => import('../ErrorLogPanel').then(m => ({ default: m.ErrorLogPanel })));
const GlobalSearch = lazy(() => import('../GlobalSearch').then(m => ({ default: m.GlobalSearch })));
const ExportManager = lazy(() => import('../ExportManager').then(m => ({ default: m.ExportManager })));

function LoadingFallback() {
  return (
    <div className="h-full flex flex-col items-center justify-center opacity-50">
      <Loader2 className="animate-spin text-slate-400 mb-2" size={32} />
      <p className="text-sm text-slate-400 font-serif italic">Loading component...</p>
    </div>
  );
}

export function MainView() {
  const { 
    viewMode, 
    projectId, 
    activeChapterId, 
    setActiveChapterId, 
    setViewMode, 
    isFocusMode, 
    setIsFocusMode,
    isSearchOpen,
    setIsSearchOpen,
    isExportOpen,
    setIsExportOpen,
    project
  } = useAppContext();

  return (
    <main className="flex-1 flex flex-col relative bg-background">
      {/* Focus Toggle (Exit) */}
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

      <div className="flex-1 overflow-hidden relative bg-background">
        {/* Persistent Editor: Always mounted but hidden when not in write mode to prevent Tiptap re-initialization overhead */}
        <div 
          className={cn(
            "absolute inset-0 transition-opacity duration-300", 
            viewMode !== 'write' ? "opacity-0 pointer-events-none z-0" : "opacity-100 z-10"
          )}
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
              <p className="font-serif italic text-lg text-slate-400">Select a chapter to begin your journey.</p>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {viewMode === 'outline' && projectId && (
            <ViewContainer key="outline" className="z-20">
              <Suspense fallback={<LoadingFallback />}>
                <OutlinePanel projectId={projectId} />
              </Suspense>
            </ViewContainer>
          )}

          {viewMode === 'codex' && projectId && (
            <ViewContainer key="codex" className="z-20">
              <Suspense fallback={<LoadingFallback />}>
                <CodexPanel projectId={projectId} />
              </Suspense>
            </ViewContainer>
          )}

          {viewMode === 'actions' && projectId && (
            <ViewContainer key="actions" className="z-20">
              <Suspense fallback={<LoadingFallback />}>
                <ActionsPanel projectId={projectId} />
              </Suspense>
            </ViewContainer>
          )}

          {viewMode === 'relationships' && projectId && (
            <ViewContainer key="relationships" className="z-20">
              <Suspense fallback={<LoadingFallback />}>
                <RelationshipMapper projectId={projectId} />
              </Suspense>
            </ViewContainer>
          )}

          {viewMode === 'bible' && projectId && (
            <ViewContainer key="bible" className="z-20">
              <Suspense fallback={<LoadingFallback />}>
                <BiblePanel projectId={projectId} />
              </Suspense>
            </ViewContainer>
          )}

          {viewMode === 'settings' && (
            <ViewContainer key="settings" className="z-20">
              <Suspense fallback={<LoadingFallback />}>
                <SettingsPanel />
              </Suspense>
            </ViewContainer>
          )}

          {viewMode === 'guide' && (
            <ViewContainer key="guide" className="z-20">
              <Suspense fallback={<LoadingFallback />}>
                <GuidePanel />
              </Suspense>
            </ViewContainer>
          )}

          {viewMode === 'errors' && (
            <ViewContainer key="errors" className="z-20">
              <Suspense fallback={<LoadingFallback />}>
                <ErrorLogPanel />
              </Suspense>
            </ViewContainer>
          )}
        </AnimatePresence>
      </div>

      <Suspense fallback={null}>
        {isSearchOpen && projectId && (
          <GlobalSearch 
            projectId={projectId}
            onClose={() => setIsSearchOpen(false)}
            onSelectChapter={(id) => {
              setActiveChapterId(id);
              setViewMode('write');
            }}
            onSelectCodex={() => {
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
      </Suspense>
    </main>
  );
}

function ViewContainer({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn("absolute inset-0 p-10 overflow-y-auto custom-scrollbar bg-background", className)}
    >
      {children}
    </motion.div>
  );
}

// Utility import already handled above
