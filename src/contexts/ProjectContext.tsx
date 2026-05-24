/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, ensureDefaultProject } from '@/src/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ErrorService } from '@/src/services/errorService';

interface ProjectContextType {
  projectId: number | null;
  project: any;
  isLoading: boolean;
  switchProject: (id: number) => Promise<void>;
  createProject: (name: string) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    ensureDefaultProject().then(id => {
      if (id) {
        setProjectId(id);
      }
      setIsLoading(false);
    });
  }, []);

  const project = useLiveQuery(() => 
    projectId ? db.projects.get(projectId) : undefined
  , [projectId]);

  const switchProject = async (id: number) => {
    try {
      await db.projects.update(id, { lastOpened: Date.now() });
      setProjectId(id);
    } catch (error) {
      ErrorService.log({
        message: 'Failed to switch project',
        type: 'error',
        source: 'ProjectContext',
        metadata: { id, error }
      });
      throw error;
    }
  };

  const createProject = async (name: string) => {
    try {
      const newId = await db.projects.add({
        name,
        description: 'New Manuscript',
        createdAt: Date.now(),
        lastOpened: Date.now(),
      });
      
      await db.chapters.add({
        projectId: newId,
        title: 'Chapter 1',
        content: '',
        order: 0,
        lastModified: Date.now(),
      });

      await switchProject(newId);
    } catch (error) {
      ErrorService.log({
        message: 'Failed to create project',
        type: 'error',
        source: 'ProjectContext',
        metadata: { name, error }
      });
      throw error;
    }
  };

  const deleteProject = async (id: number) => {
    try {
      if (projectId === id) {
        const other = await db.projects.where('id').notEqual(id).first();
        if (other) {
          await switchProject(other.id!);
        } else {
          const defaultId = await ensureDefaultProject();
          if (defaultId) setProjectId(defaultId);
        }
      }
      
      await db.transaction('rw', [db.projects, db.chapters, db.codex, db.bible, db.aiActions, db.snapshots, db.timeline, db.relationships, db.chatSessions], async () => {
        // Ambil semua chapter ID yang dimiliki project ini untuk menghapus snapshots-nya
        const chapters = await db.chapters.where('projectId').equals(id).toArray();
        const chapterIds = chapters.map(c => c.id!).filter(Boolean);
        
        // Hapus snapshots untuk chapter-chapter tersebut
        if (chapterIds.length > 0) {
          await db.snapshots.where('chapterId').anyOf(chapterIds).delete();
        }

        await db.chapters.where('projectId').equals(id).delete();
        await db.codex.where('projectId').equals(id).delete();
        await db.bible.where('projectId').equals(id).delete();
        await db.aiActions.where('projectId').equals(id).delete();
        await db.timeline.where('projectId').equals(id).delete();
        await db.relationships.where('projectId').equals(id).delete();
        await db.chatSessions.where('projectId').equals(id).delete();
        await db.projects.delete(id);
      });
    } catch (error) {
      ErrorService.log({
        message: 'Failed to delete project',
        type: 'error',
        source: 'ProjectContext',
        metadata: { id, error }
      });
      throw error;
    }
  };

  return (
    <ProjectContext.Provider value={{
      projectId,
      project,
      isLoading,
      switchProject,
      createProject,
      deleteProject
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
