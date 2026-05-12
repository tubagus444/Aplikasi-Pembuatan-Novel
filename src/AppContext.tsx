/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, ensureDefaultProject } from './db';
import { useLiveQuery } from 'dexie-react-hooks';

export type ViewMode = 'write' | 'outline' | 'codex' | 'bible' | 'settings' | 'actions' | 'relationships' | 'guide' | 'errors';

interface AppContextType {
  projectId: number | null;
  activeChapterId: number | null;
  setActiveChapterId: (id: number | null) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isFocusMode: boolean;
  setIsFocusMode: (focus: boolean) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  isExportOpen: boolean;
  setIsExportOpen: (open: boolean) => void;
  project: any;
  activeChapter: any;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('write');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Initialize DB and Project
  useEffect(() => {
    ensureDefaultProject().then(id => {
      if (id) {
        setProjectId(id);
        db.chapters.where('projectId').equals(id).first().then(ch => {
          if (ch) setActiveChapterId(ch.id!);
        });
      }
    });
  }, []);

  const project = useLiveQuery(() => 
    projectId ? db.projects.get(projectId) : undefined
  , [projectId]);

  const activeChapter = useLiveQuery(() => 
    activeChapterId ? db.chapters.get(activeChapterId) : undefined
  , [activeChapterId]);

  // Handle case where active chapter is deleted
  useEffect(() => {
    let isMounted = true;

    const syncActiveChapter = async () => {
      if (!activeChapterId || !projectId) return;

      // Double check directly from DB to distinguish between "loading" and "deleted"
      const current = await db.chapters.get(activeChapterId);
      
      if (!current && isMounted) {
        // Only if it's truly gone, find the next available chapter
        const nextCh = await db.chapters.where('projectId').equals(projectId).first();
        if (isMounted) {
          setActiveChapterId(nextCh?.id || null);
        }
      }
    };

    // We only trigger this check when the live query signals a potential "null" state
    if (activeChapter === undefined && activeChapterId) {
      syncActiveChapter();
    }

    return () => { isMounted = false; };
  }, [activeChapter, activeChapterId, projectId]);

  return (
    <AppContext.Provider value={{
      projectId,
      activeChapterId,
      setActiveChapterId,
      viewMode,
      setViewMode,
      sidebarOpen,
      setSidebarOpen,
      isFocusMode,
      setIsFocusMode,
      isSearchOpen,
      setIsSearchOpen,
      isExportOpen,
      setIsExportOpen,
      project,
      activeChapter
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
