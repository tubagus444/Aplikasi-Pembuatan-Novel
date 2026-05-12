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
  isProjectManagerOpen: boolean;
  setIsProjectManagerOpen: (open: boolean) => void;
  project: any;
  activeChapter: any;
  switchProject: (id: number) => Promise<void>;
  createProject: (name: string) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;
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
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);

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

  const switchProject = async (id: number) => {
    await db.projects.update(id, { lastOpened: Date.now() });
    setProjectId(id);
    const firstChapter = await db.chapters.where('projectId').equals(id).first();
    setActiveChapterId(firstChapter?.id || null);
    setViewMode('write');
  };

  const createProject = async (name: string) => {
    const newId = await db.projects.add({
      name,
      description: 'New Manuscript',
      createdAt: Date.now(),
      lastOpened: Date.now(),
    });
    
    // Create initial chapter
    await db.chapters.add({
      projectId: newId,
      title: 'Chapter 1',
      content: '',
      order: 0,
      lastModified: Date.now(),
    });

    await switchProject(newId);
  };

  const deleteProject = async (id: number) => {
    if (projectId === id) {
      // Find another project to switch to
      const other = await db.projects.where('id').notEqual(id).first();
      if (other) {
        await switchProject(other.id!);
      } else {
        // If it's the last one, create a default one
        const defaultId = await ensureDefaultProject();
        if (defaultId) setProjectId(defaultId);
      }
    }
    
    // Delete associated data
    await db.transaction('rw', [db.projects, db.chapters, db.codex, db.bible, db.aiActions, db.snapshots, db.timeline, db.relationships], async () => {
      await db.chapters.where('projectId').equals(id).delete();
      await db.codex.where('projectId').equals(id).delete();
      await db.bible.where('projectId').equals(id).delete();
      await db.aiActions.where('projectId').equals(id).delete();
      await db.timeline.where('projectId').equals(id).delete();
      await db.relationships.where('projectId').equals(id).delete();
      // Snapshots are linked to chapters, we'll delete them via chapter cleanup if possible or just wipe them
      // In this case, we'll just delete the project
      await db.projects.delete(id);
    });
  };

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
      isProjectManagerOpen,
      setIsProjectManagerOpen,
      project,
      activeChapter,
      switchProject,
      createProject,
      deleteProject
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
