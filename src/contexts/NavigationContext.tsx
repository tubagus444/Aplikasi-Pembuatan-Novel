/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ViewMode } from '../types';
import { useProject } from './ProjectContext';

interface NavigationContextType {
  activeChapterId: number | null;
  setActiveChapterId: (id: number | null) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  activeChapter: any;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const { projectId } = useProject();
  const [activeChapterId, setActiveChapterId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('write');

  // Load first chapter when project changes
  useEffect(() => {
    if (projectId) {
      db.chapters.where('projectId').equals(projectId).first().then(ch => {
        if (ch) setActiveChapterId(ch.id!);
      });
      setViewMode('write');
    }
  }, [projectId]);

  const activeChapter = useLiveQuery(() => 
    activeChapterId ? db.chapters.get(activeChapterId) : undefined
  , [activeChapterId]);

  // Handle case where active chapter is deleted
  useEffect(() => {
    let isMounted = true;

    const syncActiveChapter = async () => {
      if (!activeChapterId || !projectId) return;

      const current = await db.chapters.get(activeChapterId);
      
      if (!current && isMounted) {
        const nextCh = await db.chapters.where('projectId').equals(projectId).first();
        if (isMounted) {
          setActiveChapterId(nextCh?.id || null);
        }
      }
    };

    if (activeChapter === undefined && activeChapterId) {
      syncActiveChapter();
    }

    return () => { isMounted = false; };
  }, [activeChapter, activeChapterId, projectId]);

  return (
    <NavigationContext.Provider value={{
      activeChapterId,
      setActiveChapterId,
      viewMode,
      setViewMode,
      activeChapter
    }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
