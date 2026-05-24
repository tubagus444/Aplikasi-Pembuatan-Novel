/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { 
  Plus, 
  GripVertical, 
  Trash2, 
  UserCircle, 
  Target, 
  LayoutGrid, 
  Columns, 
  Search, 
  BookOpen, 
  Filter,
  Activity, 
  Sparkles,
  Eye,
  EyeOff,
  CheckCircle2,
  TrendingUp,
  Bookmark,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, countWords } from '@/src/lib/utils';
import { STATUS_COLORS, STATUS_DOTS } from '@/src/lib/constants';
import { useChapterManagement } from '@/src/features/chapters/hooks/useChapterManagement';
import { useChapterDragAndDrop } from '@/src/features/chapters/hooks/useChapterDragAndDrop';
import { useNavigation } from '@/src/contexts/NavigationContext';

const STATUS_LANES: { id: 'outline' | 'draft' | 'edit' | 'polish' | 'done'; label: string; description: string; colorClass: string }[] = [
  { id: 'outline', label: 'Outline', description: 'Struktur ide & plot cerita', colorClass: 'border-t-2 border-slate-300 dark:border-slate-700' },
  { id: 'draft', label: 'Drafting', description: 'Bab dalam proses penulisan', colorClass: 'border-t-2 border-indigo-500' },
  { id: 'edit', label: 'Editing', description: 'Revisi & penyempurnaan isi', colorClass: 'border-t-2 border-amber-500' },
  { id: 'polish', label: 'Polishing', description: 'Polesan gaya bahasa & diksi', colorClass: 'border-t-2 border-emerald-500' },
  { id: 'done', label: 'Completed', description: 'Bab selesai & siap dipublikasi', colorClass: 'border-t-2 border-blue-500' }
];

interface OutlinePanelProps {
  projectId: number;
}

export function OutlinePanel({ projectId }: OutlinePanelProps) {
  const { chapters, deleteConfirmId, updateField, deleteChapter, addChapter } = useChapterManagement(projectId);
  const { draggedId, handleDragStart, handleDragEnd, handleDragOver, handleDrop } = useChapterDragAndDrop(chapters);
  const { setActiveChapterId, setViewMode } = useNavigation();

  // UX Control States
  const [viewLayout, setViewLayout] = useState<'timeline' | 'kanban'>('timeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPovFilter, setSelectedPovFilter] = useState<string | null>(null);
  const [globalExpandSummaries, setGlobalExpandSummaries] = useState(true);
  const [activeDropColumn, setActiveDropColumn] = useState<string | null>(null);

  // 1. Planning board statistics & insights
  const stats = useMemo(() => {
    if (!chapters) return { totalChapters: 0, totalWords: 0, totalGoal: 0, doneCount: 0, progressPercent: 0 };
    
    const totalChapters = chapters.length;
    const totalWords = chapters.reduce((sum, ch) => sum + countWords(ch.content || ''), 0);
    const totalGoal = chapters.reduce((sum, ch) => sum + (ch.wordGoal || 0), 0);
    const doneCount = chapters.filter(ch => ch.status === 'done').length;
    const progressPercent = totalGoal ? Math.min(100, Math.round((totalWords / totalGoal) * 100)) : 0;

    return { totalChapters, totalWords, totalGoal, doneCount, progressPercent };
  }, [chapters]);

  // Unique POVs list for pill navigation
  const uniquePOVs = useMemo(() => {
    if (!chapters) return [];
    return Array.from(new Set(chapters.map(ch => ch.pov?.trim()).filter(Boolean))) as string[];
  }, [chapters]);

  // Filtered Chapters based on search and POV
  const filteredChapters = useMemo(() => {
    if (!chapters) return [];
    return chapters.filter(chapter => {
      const titleMatch = chapter.title?.toLowerCase().includes(searchQuery.toLowerCase());
      const summaryMatch = chapter.summary?.toLowerCase().includes(searchQuery.toLowerCase());
      const povFieldMatch = chapter.pov?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSearch = titleMatch || summaryMatch || povFieldMatch;

      const matchesPov = selectedPovFilter 
        ? chapter.pov?.trim().toLowerCase() === selectedPovFilter.trim().toLowerCase() 
        : true;

      return matchesSearch && matchesPov;
    });
  }, [chapters, searchQuery, selectedPovFilter]);

  // Hanlde drops onto specific Kanban Columns/Lanes
  const handleDropOnColumn = async (e: React.DragEvent, status: 'outline' | 'draft' | 'edit' | 'polish' | 'done') => {
    e.preventDefault();
    if (!draggedId || !chapters) return;
    
    const draggedChapter = chapters.find(c => c.id === draggedId);
    if (draggedChapter && draggedChapter.status !== status) {
      updateField(draggedId, 'status', status);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-24 px-4">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-md">
              <Sparkles size={20} className="animate-pulse" />
            </span>
            <h2 className="text-3xl font-serif font-bold text-slate-950 dark:text-slate-100 capitalize">Planning Board</h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gambarkan draf cerita Bab demi Bab, pantau status menulis, target kata, dan visualisasikan narasi Anda.
          </p>
        </div>
        <button 
          onClick={addChapter}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md hover:shadow-indigo-500/20 active:scale-95 shrink-0"
        >
          <Plus size={16} /> Tambah Bab Baru
        </button>
      </div>

      {/* STATISTICS PANEL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Total & Progres Bab */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Bab Terencana</span>
            <Bookmark size={16} className="text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold font-mono text-slate-900 dark:text-slate-100">{stats.totalChapters}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">total bab</span>
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-800/80 pt-2">
            <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
            <span><strong className="text-slate-700 dark:text-slate-300 font-mono">{stats.doneCount}</strong> dari <strong className="text-slate-700 dark:text-slate-300 font-mono">{stats.totalChapters}</strong> bab telah selesai (Done)</span>
          </div>
        </div>

        {/* Word Count Progress */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Statistik Kata Cerita</span>
            <TrendingUp size={16} className="text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-bold font-mono text-slate-900 dark:text-slate-100">{stats.totalWords.toLocaleString()}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">kata</span>
            {stats.totalGoal > 0 && (
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">/ {stats.totalGoal.toLocaleString()} goal</span>
            )}
          </div>
          <div className="mt-2 border-t border-slate-100 dark:border-slate-800 pt-2">
            {stats.totalGoal > 0 ? (
              <div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold mb-1 uppercase">
                  <span>Progres Target</span>
                  <span>{stats.progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-105 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500 rounded-full",
                      stats.progressPercent >= 100 ? "bg-emerald-500" : "bg-indigo-500"
                    )}
                    style={{ width: `${stats.progressPercent}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <Activity size={12} className="text-amber-500" />
                <span>Belum ada target kata kumulatif yang ditentukan</span>
              </div>
            )}
          </div>
        </div>

        {/* POV Visual Tracker */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Sudut Pandang (POV)</span>
            <UserCircle size={16} className="text-amber-500" />
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[50px] no-scrollbar py-1">
            {uniquePOVs.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {uniquePOVs.map(pov => {
                  const isActive = selectedPovFilter === pov;
                  return (
                    <button
                      key={pov}
                      onClick={() => setSelectedPovFilter(isActive ? null : pov)}
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer",
                        isActive 
                          ? "bg-amber-150 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 shadow-sm"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-350"
                      )}
                    >
                      {pov}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs italic text-slate-400 dark:text-slate-500 mt-1">Masukkan POV pada kartu bab untuk melacak sudut pandang karakter.</p>
            )}
          </div>

          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 border-t border-slate-100 dark:border-slate-800 pt-2 flex items-center justify-between">
            <span>Klik pil POV untuk memfilter isi board</span>
            {selectedPovFilter && (
              <button 
                onClick={() => setSelectedPovFilter(null)}
                className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FILTER & CONTROL TOOLBAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/85 mb-6 gap-4">
        {/* Search Input and active filter indicator */}
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari bab berdasarkan judul, rangkuman, POV..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all shadow-sm"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[10px] hover:text-slate-600 hover:underline font-bold"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Action Toggles to clean summaries & change layout view */}
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0 border-t sm:border-t-0 border-slate-200 pt-3 sm:pt-0">
          {/* Summary toggle button */}
          <button
            onClick={() => setGlobalExpandSummaries(!globalExpandSummaries)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-850 rounded-lg transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-800 cursor-pointer"
            title={globalExpandSummaries ? "Collapse all summaries" : "Expand all summaries"}
          >
            {globalExpandSummaries ? (
              <>
                <EyeOff size={14} />
                <span>Sembunyikan Rangkuman</span>
              </>
            ) : (
              <>
                <Eye size={14} />
                <span>Tampilkan Rangkuman</span>
              </>
            )}
          </button>

          {/* Dual layout switch */}
          <div className="flex items-center bg-slate-200/60 dark:bg-slate-950 p-1 rounded-lg border border-slate-300/40 dark:border-slate-800">
            <button
              onClick={() => { setViewLayout('timeline'); setSelectedPovFilter(null); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer",
                viewLayout === 'timeline' 
                  ? "bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 shadow-sm" 
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              )}
            >
              <LayoutGrid size={13} />
              <span>Timeline Gird</span>
            </button>
            <button
              onClick={() => { setViewLayout('kanban'); setSelectedPovFilter(null); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer",
                viewLayout === 'kanban' 
                  ? "bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 shadow-sm" 
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              )}
            >
              <Columns size={13} />
              <span>Kanban Board</span>
            </button>
          </div>
        </div>
      </div>

      {/* FILTER MESSAGES */}
      {(searchQuery || selectedPovFilter) && (
        <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-4 flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-950/20 px-4 py-2.5 rounded-lg border border-indigo-150 dark:border-indigo-900/30">
          <div className="flex items-center gap-1.5">
            <Filter size={12} />
            <span>
              Menyaring hasil
              {searchQuery && ` untuk kata kunci "${searchQuery}"`}
              {searchQuery && selectedPovFilter && ' dan'}
              {selectedPovFilter && ` untuk POV "${selectedPovFilter}"`}
              . Ditemukan <strong className="font-bold">{filteredChapters.length} bab.</strong>
            </span>
          </div>
          <button 
            onClick={() => { setSearchQuery(''); setSelectedPovFilter(null); }}
            className="underline text-[10px] uppercase font-bold tracking-wider hover:opacity-80"
          >
            Reset Semua Filter
          </button>
        </div>
      )}

      {/* CHANNELS AND VIEWS PANEL */}
      <AnimatePresence mode="wait">
        {viewLayout === 'timeline' ? (
          /* TIMELINE VIEW GRID */
          <motion.div
            key="timeline"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
          >
            {filteredChapters.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredChapters.map((chapter, index) => (
                  <ChapterCard
                    key={chapter.id}
                    chapter={chapter}
                    index={index}
                    draggedId={draggedId}
                    deleteConfirmId={deleteConfirmId}
                    globalExpandSummaries={globalExpandSummaries}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    onUpdateField={updateField}
                    onDelete={deleteChapter}
                    onDirectEdit={() => {
                      setActiveChapterId(chapter.id!);
                      setViewMode('write');
                    }}
                  />
                ))}
              </div>
            ) : (
              <EmptyState view="timeline" onAdd={addChapter} />
            )}
          </motion.div>
        ) : (
          /* KANBAN BOARD VIEW columns */
          <motion.div
            key="kanban"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="overflow-x-auto pb-6"
          >
            <div className="flex gap-4 min-w-[1200px] h-[calc(100vh-320px)] min-h-[480px]">
              {STATUS_LANES.map(lane => {
                const laneChapters = filteredChapters.filter(ch => (ch.status || 'outline') === lane.id);
                const isColumnHovered = activeDropColumn === lane.id;

                return (
                  <div
                    key={lane.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (activeDropColumn !== lane.id) {
                        setActiveDropColumn(lane.id);
                      }
                    }}
                    onDragLeave={() => {
                      setActiveDropColumn(null);
                    }}
                    onDrop={(e) => {
                      handleDropOnColumn(e, lane.id);
                      setActiveDropColumn(null);
                    }}
                    className={cn(
                      "flex-1 flex flex-col bg-slate-50 dark:bg-slate-900/30 rounded-xl border p-3.5 transition-all w-[240px] select-none",
                      isColumnHovered 
                        ? "border-dashed border-indigo-400 dark:border-indigo-750 bg-indigo-50/20 dark:bg-indigo-950/20 ring-2 ring-indigo-500/10" 
                        : "border-slate-200 dark:border-slate-800"
                    )}
                  >
                    {/* Lane Header */}
                    <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-200/60 dark:border-slate-850 relative">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("w-2 h-2 rounded-full", STATUS_DOTS[lane.id] || "bg-slate-400")} />
                          <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wider">{lane.label}</h3>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-150 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold font-mono text-slate-500 dark:text-slate-400">
                            {laneChapters.length}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium leading-tight truncate max-w-[180px]">{lane.description}</p>
                      </div>
                    </div>

                    {/* Lane Body/Cards List */}
                    <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 no-scrollbar pb-2">
                      {laneChapters.length > 0 ? (
                        laneChapters.map((chapter, index) => (
                          <ChapterCard
                            key={chapter.id}
                            chapter={chapter}
                            index={index}
                            isCompactView={true}
                            draggedId={draggedId}
                            deleteConfirmId={deleteConfirmId}
                            globalExpandSummaries={globalExpandSummaries}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onDragEnd={handleDragEnd}
                            onUpdateField={updateField}
                            onDelete={deleteChapter}
                            onDirectEdit={() => {
                              setActiveChapterId(chapter.id!);
                              setViewMode('write');
                            }}
                          />
                        ))
                      ) : (
                        <div className="h-28 rounded-lg border border-dashed border-slate-200 dark:border-slate-800/80 flex flex-col items-center justify-center p-3 text-center text-slate-400 dark:text-slate-600">
                          <p className="text-[10px] italic">Tarik atau letakkan bab di sini</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* COMPONENT: EMPTY STATE SCREEN */
function EmptyState({ view, onAdd }: { view: string, onAdd: () => void }) {
  return (
    <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl max-w-lg mx-auto shadow-sm p-8">
      <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 border border-slate-150 dark:border-slate-700 flex items-center justify-center text-slate-400 rounded-2xl mx-auto mb-4">
        <BookOpen size={24} />
      </div>
      <h3 className="text-base font-bold text-slate-850 dark:text-slate-100 font-serif mb-1">Daftar Bab Kosong</h3>
      <p className="text-xs text-slate-500 dark:text-slate-500 max-w-sm mx-auto mb-6">
        {view === 'kanban' 
          ? "Tidak ada bab yang cocok dengan kata kunci atau filter POV saat ini."
          : "Belum ada bab yang dibuat untuk draf buku Anda. Mari rancang bab pertama Anda!"}
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 active:scale-95 transition-all shadow-sm cursor-pointer"
      >
        <Plus size={14} /> Beri Bab Pertama Anda
      </button>
    </div>
  );
}

/* COMPONENT: CHAPTER CARD */
interface ChapterCardProps {
  chapter: any;
  index: number;
  isCompactView?: boolean;
  draggedId: number | null;
  deleteConfirmId: number | null;
  globalExpandSummaries: boolean;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetId: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onUpdateField: (id: number, field: string, value: any) => void;
  onDelete: (id: number) => void;
  onDirectEdit: () => void;
}

function ChapterCard({ 
  chapter, 
  index, 
  isCompactView = false,
  draggedId, 
  deleteConfirmId, 
  globalExpandSummaries,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onUpdateField,
  onDelete,
  onDirectEdit
}: ChapterCardProps) {
  const wordCount = useMemo(() => countWords(chapter.content || ''), [chapter.content]);
  const progressPercent = chapter.wordGoal ? Math.min(100, Math.round((wordCount / chapter.wordGoal) * 100)) : 0;

  // Local Collapsed override state
  const [localExpanded, setLocalExpanded] = useState<boolean | null>(null);
  
  // Decide whether to show summary text area based on global + override
  const showSummary = localExpanded !== null ? localExpanded : (isCompactView ? false : globalExpandSummaries);

  const isCurrentDragged = draggedId === chapter.id;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: Math.min(6, index) * 0.04 }}
      draggable
      onDragStart={(e: any) => onDragStart(e, chapter.id!)}
      onDragOver={onDragOver}
      onDrop={(e: any) => onDrop(e, chapter.id!)}
      onDragEnd={onDragEnd as any}
      className={cn(
        "group bg-white dark:bg-slate-950 border rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col relative overflow-hidden",
        isCurrentDragged 
          ? "opacity-40 border-indigo-500 scale-[0.98] bg-slate-50 dark:bg-slate-900 pointer-events-none" 
          : "opacity-100 border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700",
        isCompactView ? "p-3.5 gap-2.5" : "p-5 gap-3.5"
      )}
      style={{ transition: 'opacity 0.2s, transform 0.2s, border-color 0.2s' }}
    >
      {/* DRAG HANDLE & TITLE ROW */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div 
            title="Tarik untuk mengurutkan"
            className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-700 hover:text-slate-500 hover:dark:text-slate-550 p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-900 shrink-0 select-none pb-1.5"
          >
            <GripVertical size={13} className="pointer-events-none" />
          </div>
          <input 
            className="font-bold text-slate-950 dark:text-slate-100 focus:outline-none border-b border-transparent focus:border-indigo-400 bg-transparent px-1 pb-0.5 truncate w-full text-xs font-serif"
            value={chapter.title}
            onChange={(e) => onUpdateField(chapter.id!, 'title', e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        
        {/* Total Words Display */}
        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wide bg-slate-50 dark:bg-slate-900/60 border border-slate-150 dark:border-slate-800 px-1.5 py-0.5 rounded select-none shrink-0 font-mono">
          {wordCount.toLocaleString()} kt
        </span>
      </div>

      {/* METADATA CONTROLS ROW */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Status Dropdown */}
        <select 
          value={chapter.status || 'outline'}
          onChange={(e) => onUpdateField(chapter.id!, 'status', e.target.value)}
          className={cn(
            "text-[9px] uppercase font-bold tracking-wider px-2 py-1 rounded-full outline-none border border-transparent focus:border-indigo-200 cursor-pointer select-none transition-colors",
            STATUS_COLORS[chapter.status || 'outline']
          )}
        >
          <option value="outline">Outline</option>
          <option value="draft">Drafting</option>
          <option value="edit">Editing</option>
          <option value="polish">Polishing</option>
          <option value="done">Completed</option>
        </select>
        
        {/* POV Field */}
        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/60 border border-slate-150 dark:border-slate-800/80 rounded-full px-2 py-0.5 flex-1 min-w-[70px]">
          <UserCircle size={10} className="text-slate-450 dark:text-slate-500 shrink-0" />
          <input 
            className="bg-transparent text-[9px] font-bold text-slate-600 dark:text-slate-450 focus:outline-none w-full placeholder:text-slate-350 dark:placeholder:text-slate-650 uppercase tracking-wider truncate"
            placeholder="Karakter POV"
            value={chapter.pov || ''}
            onChange={(e) => onUpdateField(chapter.id!, 'pov', e.target.value)}
          />
        </div>

        {/* Word Goal Input */}
        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/60 border border-slate-150 dark:border-slate-800/80 rounded-full px-2 py-0.5 w-[58px] shrink-0">
          <Target size={9} className="text-slate-450 shrink-0" />
          <input 
            className="bg-transparent text-[9px] font-bold text-slate-600 dark:text-slate-450 focus:outline-none w-full placeholder:text-slate-350 dark:placeholder:text-slate-650 font-mono"
            placeholder="GOAL"
            type="number"
            value={chapter.wordGoal || ''}
            onChange={(e) => onUpdateField(chapter.id!, 'wordGoal', parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      {/* SUMMARY BOX - Collapsible */}
      <div className="flex flex-col border-t border-slate-150 dark:border-slate-850 pt-2.5 flex-grow">
        <div className="flex items-center justify-between text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-550 mb-1.5 select-none">
          <span>Rangkuman Bab</span>
          
          <button 
            type="button" 
            onClick={() => setLocalExpanded(showSummary ? false : true)} 
            className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-md transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-350"
            title={showSummary ? "Sembunyikan detail" : "Tampilkan detail"}
          >
            {showSummary ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {showSummary ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <textarea 
                className="w-full text-xs text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-150/70 dark:border-slate-850/60 rounded-lg p-2 resize-none focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all font-serif italic min-h-[92px] max-h-[140px] leading-relaxed"
                placeholder="Rincian adegan peristiwa narasi di bab ini..."
                value={chapter.summary || ''}
                onChange={(e) => onUpdateField(chapter.id!, 'summary', e.target.value)}
              />
            </motion.div>
          ) : (
            <div 
              onClick={() => setLocalExpanded(true)}
              className="group/summary bg-slate-50/30 hover:bg-slate-50 dark:bg-slate-900/20 dark:hover:bg-slate-900/40 hover:border-slate-300 rounded-lg border border-transparent p-2 cursor-pointer transition-all line-clamp-2"
            >
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-serif italic line-clamp-1 group-hover/summary:text-slate-500 select-none">
                {chapter.summary || "Klik untuk menambahkan ringkasan/catatan..."}
              </span>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* FOOTER: CARD ACTIONS (EDIT SHORTCUT & DELETE BUTTON) */}
      <div className="flex items-center justify-between border-t border-slate-150 dark:border-slate-850 pt-2.5 mt-auto">
        {/* Word goal progress indicator tiny bar */}
        <div className="flex-1 min-w-0 pr-4">
          {chapter.wordGoal > 0 ? (
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[8px] font-bold text-slate-450 dark:text-slate-550 select-none uppercase font-mono">
                <span>Target: {progressPercent}%</span>
                <span>{wordCount}/{chapter.wordGoal}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-900 h-1 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-300 rounded-full",
                    progressPercent >= 100 ? "bg-emerald-500" : "bg-indigo-500"
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          ) : (
            <span className="text-[9px] text-slate-400 dark:text-slate-600 italic select-none">Goal belum diatur</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Direct write button */}
          <button
            onClick={onDirectEdit}
            className="flex items-center gap-1 bg-slate-100 hover:bg-indigo-600 dark:bg-slate-900 text-slate-600 hover:text-white dark:text-slate-400 dark:hover:text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all border border-slate-200/60 dark:border-slate-800 hover:border-indigo-600 dark:hover:border-indigo-600 font-sans tracking-wide cursor-pointer select-none"
            title="Buka di Editor Utama"
          >
            <BookOpen size={11} />
            <span>Tulis</span>
          </button>

          {/* Delete confirmed button */}
          <button 
            type="button"
            onClick={() => onDelete(chapter.id!)}
            className={cn(
              "p-1.5 transition-all rounded-md cursor-pointer select-none border",
              deleteConfirmId === chapter.id 
                ? "bg-red-550 border-red-550 text-white hover:bg-red-650 opacity-100 scale-105" 
                : "border-transparent text-slate-350 hover:text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/20"
            )}
            title={deleteConfirmId === chapter.id ? "Klik lagi untuk menghapus" : "Hapus Bab"}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
