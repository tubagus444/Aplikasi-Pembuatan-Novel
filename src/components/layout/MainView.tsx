/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScrollText, Plus } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { NovelEditor } from '../NovelEditor';
import { OutlinePanel } from '../OutlinePanel';
import { CodexPanel } from '../CodexPanel';
import { ActionsPanel } from '../ActionsPanel';
import { RelationshipMapper } from '../RelationshipMapper';
import { BiblePanel } from '../BiblePanel';
import { SettingsPanel } from '../SettingsPanel';
import { GuidePanel } from '../GuidePanel';
import { ErrorLogPanel } from '../ErrorLogPanel';
import { GlobalSearch } from '../GlobalSearch';
import { ExportManager } from '../ExportManager';

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
                  <p className="font-serif italic text-lg text-slate-400">Select a chapter to begin your journey.</p>
                </div>
              )}
            </motion.div>
          )}

          {viewMode === 'outline' && projectId && (
            <ViewContainer key="outline">
              <OutlinePanel projectId={projectId} />
            </ViewContainer>
          )}

          {viewMode === 'codex' && projectId && (
            <ViewContainer key="codex">
              <CodexPanel projectId={projectId} />
            </ViewContainer>
          )}

          {viewMode === 'actions' && projectId && (
            <ViewContainer key="actions">
              <ActionsPanel projectId={projectId} />
            </ViewContainer>
          )}

          {viewMode === 'relationships' && projectId && (
            <ViewContainer key="relationships">
              <RelationshipMapper projectId={projectId} />
            </ViewContainer>
          )}

          {viewMode === 'bible' && projectId && (
            <ViewContainer key="bible">
              <BiblePanel projectId={projectId} />
            </ViewContainer>
          )}

          {viewMode === 'settings' && (
            <ViewContainer key="settings">
              <SettingsPanel />
            </ViewContainer>
          )}

          {viewMode === 'guide' && (
            <ViewContainer key="guide">
              <GuidePanel />
            </ViewContainer>
          )}

          {viewMode === 'errors' && (
            <ViewContainer key="errors">
              <ErrorLogPanel />
            </ViewContainer>
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
    </main>
  );
}

function ViewContainer({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn("h-full p-10 overflow-y-auto custom-scrollbar", className)}
    >
      {children}
    </motion.div>
  );
}

import { cn } from '../../lib/utils';
