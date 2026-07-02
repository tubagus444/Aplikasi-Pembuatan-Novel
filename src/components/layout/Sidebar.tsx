/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Book, FileText, Settings, Sparkles, Database, LayoutList, ScrollText, HelpCircle, Share2, AlertTriangle, BrainCircuit, BarChart2, ShieldCheck, CalendarClock, UserSearch, Network, Activity, Gauge, Telescope, Crosshair, BookMarked, ChevronDown } from 'lucide-react';
import { useProject } from '@/src/contexts/ProjectContext';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { useUI } from '@/src/contexts/UIContext';
import { db } from '@/src/db';
import { cn } from '@/src/lib/utils';
import { ChapterList } from '@/src/features/chapters/components/ChapterList';

type NavItemDef = { mode: string; icon: React.ReactNode; label: string };
type NavGroupDef = { label: string; defaultOpen: boolean; items: NavItemDef[] };

const NAV_GROUPS: NavGroupDef[] = [
  {
    label: 'Menulis',
    defaultOpen: true,
    items: [
      { mode: 'dashboard', icon: <BarChart2 size={14} />, label: 'Dashboard' },
      { mode: 'write', icon: <FileText size={14} />, label: 'Editor' },
      { mode: 'outline', icon: <LayoutList size={14} />, label: 'Papan Rencana' },
    ],
  },
  {
    label: 'Dunia & Lore',
    defaultOpen: false,
    items: [
      { mode: 'codex', icon: <Database size={14} />, label: 'Kamus Data' },
      { mode: 'glossary', icon: <BookMarked size={14} />, label: 'Glosarium' },
      { mode: 'bible', icon: <Book size={14} />, label: 'Buku Cerita' },
      { mode: 'relationships', icon: <Share2 size={14} />, label: 'Relasi Karakter' },
      { mode: 'timeline', icon: <CalendarClock size={14} />, label: 'Timeline Cerita' },
      { mode: 'orphans', icon: <UserSearch size={14} />, label: 'Saran Entitas' },
    ],
  },
  {
    label: 'Analisis',
    defaultOpen: false,
    items: [
      { mode: 'consistency', icon: <ShieldCheck size={14} />, label: 'Cek Konsistensi' },
      { mode: 'continuity', icon: <Network size={14} />, label: 'Peta Kontinuitas' },
      { mode: 'arc', icon: <Activity size={14} />, label: 'Lensa Karakter' },
      { mode: 'prose', icon: <Gauge size={14} />, label: 'Wawasan Prosa' },
      { mode: 'promises', icon: <Crosshair size={14} />, label: 'Janji Plot' },
      { mode: 'search', icon: <Telescope size={14} />, label: 'Cari Adegan' },
    ],
  },
  {
    label: 'Asisten AI',
    defaultOpen: false,
    items: [
      { mode: 'brainstorm', icon: <BrainCircuit size={14} />, label: 'Studio Asisten' },
      { mode: 'actions', icon: <Sparkles size={14} />, label: 'Snippet AI' },
    ],
  },
  {
    label: 'Sistem',
    defaultOpen: false,
    items: [
      { mode: 'settings', icon: <Settings size={14} />, label: 'Pengaturan' },
      { mode: 'guide', icon: <HelpCircle size={14} />, label: 'Panduan' },
      { mode: 'errors', icon: <AlertTriangle size={14} />, label: 'Log Error' },
    ],
  },
];

const NAV_GROUPS_STORAGE_KEY = 'sidebar_nav_groups';

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

  // Collapsible nav groups; open/closed state persisted per user.
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(NAV_GROUPS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const showChapterList = viewMode === 'write' && projectId != null;

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const fallback = NAV_GROUPS.find((g) => g.label === label)?.defaultOpen ?? true;
      const next = { ...prev, [label]: !(prev[label] ?? fallback) };
      try {
        localStorage.setItem(NAV_GROUPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota/serialization errors */
      }
      return next;
    });
  };

  return (
    <aside className="w-[260px] h-full flex flex-col relative shrink-0">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 shrink-0">
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
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <nav
              role="navigation"
              className={cn(
                "px-4 pt-4 space-y-3 min-h-0 overflow-y-auto scrollbar-hover",
                // In write mode nav is capped at half the column so the chapter list always
                // keeps room (and its own scroll); nav scrolls internally when it overflows.
                // Otherwise nav fills the whole column and scrolls.
                showChapterList ? "max-h-[50%]" : "flex-1"
              )}
            >
              {NAV_GROUPS.map((grp) => {
                const containsActive = grp.items.some((it) => it.mode === viewMode);
                const open = (openGroups[grp.label] ?? grp.defaultOpen) || containsActive;
                return (
                  <NavGroup
                    key={grp.label}
                    label={grp.label}
                    open={open}
                    onToggle={() => toggleGroup(grp.label)}
                  >
                    {grp.items.map((it) => (
                      <NavItem
                        key={it.mode}
                        active={viewMode === it.mode}
                        onClick={() => handleViewChange(it.mode)}
                        icon={it.icon}
                        label={it.label}
                      />
                    ))}
                  </NavGroup>
                );
              })}
            </nav>

            {showChapterList && (
              <div className="flex-1 min-h-0 px-2 py-4">
                <ChapterList
                  projectId={projectId!}
                  activeChapterId={activeChapterId}
                  onSelect={(id) => {
                    setActiveChapterId(id);
                    if (window.innerWidth < 768) {
                      setSidebarOpen(false);
                    }
                  }}
                />
              </div>
            )}
            {viewMode === 'codex' && <p className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-2 px-4 pb-4">Data Dunia</p>}
            {viewMode === 'bible' && <p className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-2 px-4 pb-4">Aturan Dasar</p>}
          </div>
    </aside>
  );
}

function NavGroup({ label, open, onToggle, children }: { label: string, open: boolean, onToggle: () => void, children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-3 py-1 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors group/nav"
      >
        <span className="text-[9px] font-bold uppercase tracking-[0.15em]">{label}</span>
        <ChevronDown size={12} className={cn("transition-transform opacity-60 group-hover/nav:opacity-100", open ? "" : "-rotate-90")} />
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
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
