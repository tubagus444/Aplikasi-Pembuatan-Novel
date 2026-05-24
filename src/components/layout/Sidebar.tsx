/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Book, FileText, Settings, Sparkles, Database, LayoutList, ScrollText, HelpCircle, Share2, AlertTriangle, BrainCircuit } from 'lucide-react';
import { useProject } from '@/src/contexts/ProjectContext';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { useUI } from '@/src/contexts/UIContext';
import { db } from '@/src/db';
import { cn } from '@/src/lib/utils';
import { ChapterList } from '@/src/features/chapters/components/ChapterList';

export function Sidebar() {
  const { projectId, project } = useProject();
  const { activeChapterId, setActiveChapterId, viewMode, setViewMode } = useNavigation();
  const { sidebarOpen, setSidebarOpen, isFocusMode } = useUI();

  // Helper to close sidebar on mobile after clicking
  const handleViewChange = (mode: string) => {
    setViewMode(mode as any);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <aside className="w-[260px] h-full flex flex-col relative shrink-0">
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
              <NavItem 
                active={viewMode === 'write'} 
                onClick={() => handleViewChange('write')} 
                icon={<FileText size={14} />} 
                label="Editor" 
              />
              <NavItem 
                active={viewMode === 'brainstorm'} 
                onClick={() => handleViewChange('brainstorm')} 
                icon={<BrainCircuit size={14} />} 
                label="Assistant Studio" 
              />
              <NavItem 
                active={viewMode === 'outline'} 
                onClick={() => handleViewChange('outline')} 
                icon={<LayoutList size={14} />} 
                label="Planning Board" 
              />
              <NavItem 
                active={viewMode === 'codex'} 
                onClick={() => handleViewChange('codex')} 
                icon={<Database size={14} />} 
                label="Codex" 
              />
              <NavItem 
                active={viewMode === 'bible'} 
                onClick={() => handleViewChange('bible')} 
                icon={<Book size={14} />} 
                label="Story Bible" 
              />
              <NavItem 
                active={viewMode === 'relationships'} 
                onClick={() => handleViewChange('relationships')} 
                icon={<Share2 size={14} />} 
                label="Relations" 
              />
              <NavItem 
                active={viewMode === 'actions'} 
                onClick={() => handleViewChange('actions')} 
                icon={<Sparkles size={14} />} 
                label="AI Snippets" 
              />
              <NavItem 
                active={viewMode === 'guide'} 
                onClick={() => handleViewChange('guide')} 
                icon={<HelpCircle size={14} />} 
                label="Panduan" 
              />
              <NavItem 
                active={viewMode === 'settings'} 
                onClick={() => handleViewChange('settings')} 
                icon={<Settings size={14} />} 
                label="Pengaturan" 
              />
              <NavItem 
                active={viewMode === 'errors'} 
                onClick={() => handleViewChange('errors')} 
                icon={<AlertTriangle size={14} />} 
                label="Log Error" 
              />
            </nav>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-4 no-scrollbar">
            {viewMode === 'write' && projectId && (
              <ChapterList 
                projectId={projectId} 
                activeChapterId={activeChapterId} 
                onSelect={(id) => {
                  setActiveChapterId(id);
                  if (window.innerWidth < 768) {
                    setSidebarOpen(false);
                  }
                }} 
              />
            )}
            {viewMode === 'codex' && <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-4 px-4">Worldbuilding Data</p>}
            {viewMode === 'bible' && <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-4 px-4">Core Constraints</p>}
          </div>
    </aside>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all text-left group",
        active 
          ? "bg-indigo-50 text-indigo-700 border-l-2 border-indigo-500 shadow-sm" 
          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50"
      )}
    >
      <span className={cn("transition-colors", active ? "text-indigo-600" : "opacity-70 group-hover:opacity-100")}>
        {icon}
      </span>
      {label}
    </button>
  );
}
