/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { cn } from './lib/utils';
import { ToastContainer } from './components/common/Toast';
import { useProject } from './contexts/ProjectContext';
import { useNavigation } from './contexts/NavigationContext';
import { useUI } from './contexts/UIContext';
import { useGlobalEvents } from './hooks/useGlobalEvents';
import { useAutoBackup } from './hooks/useAutoBackup';
import { useStorageQuota } from './hooks/useStorageQuota';
import { motion } from 'motion/react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MainView } from './components/layout/MainView';
import { ProjectManagerModal } from './components/modals/ProjectManagerModal';
import { GlobalSearch } from './components/GlobalSearch';
import { ExportManager } from './components/ExportManager';
import { Suspense, useEffect } from 'react';

export default function App() {
  const { projectId, project, isLoading } = useProject();
  const { setActiveChapterId, setViewMode } = useNavigation();
  const { 
    isFocusMode, 
    sidebarOpen, 
    isSearchOpen, 
    setIsSearchOpen, 
    isExportOpen, 
    setIsExportOpen 
  } = useUI();

  // Handle global keyboard shortcuts and errors
  useGlobalEvents({ setIsSearchOpen });

  // Initialize Auto-Backup system
  useAutoBackup();

  // Check storage quota on init
  const { checkStorageQuota } = useStorageQuota();
  useEffect(() => {
    if (!isLoading) {
      checkStorageQuota();
    }
  }, [isLoading, checkStorageQuota]);

  if (isLoading || !projectId) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background text-slate-400 dark:text-slate-500 font-mono text-xs uppercase tracking-widest">
        Initialising AetherScribe...
      </div>
    );
  }

  // Calculate shift: if sidebar is closed OR focus mode is on, we shift left by 260px
  const isSidebarActuallyOpen = sidebarOpen && !isFocusMode;
  const xOffset = isSidebarActuallyOpen ? 0 : -260;

  return (
    <div className={cn(
      "h-screen bg-background text-foreground overflow-hidden font-sans transition-colors duration-700 flex flex-col",
      isFocusMode && "bg-secondary"
    )}>
      <div className="flex h-full overflow-hidden relative">
        <motion.div 
          initial={false}
          animate={{ 
            width: isSidebarActuallyOpen ? 260 : 0,
            minWidth: isSidebarActuallyOpen ? 260 : 0
          }}
          transition={{ type: 'spring', damping: 27, stiffness: 220 }}
          className="h-full overflow-hidden relative z-20 flex-none forced-dark:bg-slate-900"
        >
          <div className="w-[260px] h-full">
            <Sidebar />
          </div>
        </motion.div>
        
        <div className="flex-1 min-w-0 flex flex-col relative bg-background border-l border-slate-200 dark:border-slate-800 z-10">
          <Header />
          <MainView />
        </div>
      </div>

      <ToastContainer />
      <ProjectManagerModal />
      
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
    </div>
  );
}
