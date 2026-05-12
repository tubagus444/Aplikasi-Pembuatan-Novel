/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, ensureDefaultProject } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';

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
    await db.projects.update(id, { lastOpened: Date.now() });
    setProjectId(id);
  };

  const createProject = async (name: string) => {
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
  };

  const deleteProject = async (id: number) => {
    if (projectId === id) {
      const other = await db.projects.where('id').notEqual(id).first();
      if (other) {
        await switchProject(other.id!);
      } else {
        const defaultId = await ensureDefaultProject();
        if (defaultId) setProjectId(defaultId);
      }
    }
    
    await db.transaction('rw', [db.projects, db.chapters, db.codex, db.bible, db.aiActions, db.snapshots, db.timeline, db.relationships], async () => {
      await db.chapters.where('projectId').equals(id).delete();
      await db.codex.where('projectId').equals(id).delete();
      await db.bible.where('projectId').equals(id).delete();
      await db.aiActions.where('projectId').equals(id).delete();
      await db.timeline.where('projectId').equals(id).delete();
      await db.relationships.where('projectId').equals(id).delete();
      await db.projects.delete(id);
    });
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
