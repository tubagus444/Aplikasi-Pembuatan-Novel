/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Editor } from '@tiptap/core';
import { Search, Clock } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useEditorPanel } from '@/src/contexts/EditorPanelContext';
import { ViewControlsMenu } from '@/src/features/editor/components/ViewControlsMenu';

interface NovelFooterProps {
  editor: Editor | null;
  isTypewriterMode: boolean;
  setIsTypewriterMode: (val: boolean) => void;
  isFocusMode?: boolean;
  setIsFocusMode: (val: boolean) => void;
  isSearchOpen?: boolean;
  setIsSearchOpen: (val: boolean) => void;
  zoomLevel: number;
  setZoomLevel: (val: number) => void;
}

export function NovelFooter({
  editor,
  isTypewriterMode,
  setIsTypewriterMode,
  isFocusMode,
  setIsFocusMode,
  isSearchOpen,
  setIsSearchOpen,
  zoomLevel,
  setZoomLevel
}: NovelFooterProps) {
  const { saveStatus } = useEditorPanel();

  const wordCount = editor?.state.doc.textContent.trim().split(/\s+/).filter(Boolean).length || 0;
  const charCount = editor?.state.doc.textContent.length || 0;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200)); // ~200 kata/menit

  return (
    <div className="h-12 border-t border-slate-200 dark:border-slate-800 bg-background/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest z-10 transition-colors gap-4">
      {/* Kiri: Status dokumen (read-only) */}
      <div className="flex gap-4 items-center shrink-0">
        <span className="bg-slate-100 dark:bg-slate-800/50 px-3 py-1 rounded-full text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50 cursor-default">
          KATA: {wordCount}
        </span>
        <span className="hidden sm:inline cursor-default">KARAKTER: {charCount}</span>
        {wordCount > 0 && (
          <span className="hidden md:inline-flex items-center gap-1.5 cursor-default" title="Perkiraan waktu baca (~200 kata/menit)">
            <Clock size={11} className="opacity-60" />
            {readingMinutes} MNT
          </span>
        )}

        <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-0.5 hidden sm:block"></div>

        {/* Status simpan */}
        <span className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all duration-300 border border-transparent",
          saveStatus === 'Menyimpan...' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/20' :
          saveStatus === 'Tersimpan' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-900/20 opacity-100' : 'opacity-0'
        )}>
          <div className={cn("w-1.5 h-1.5 rounded-full", saveStatus === 'Menyimpan...' ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
          {saveStatus || 'Tersimpan'}
        </span>

        {/* Indikator sinkronisasi */}
        <div className="flex items-center justify-center" title="SINKRONISASI AKTIF">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse outline outline-emerald-500/10"></div>
        </div>
      </div>

      {/* Kanan: Aksi & tampilan */}
      <div className="flex gap-2 items-center shrink-0">
        <button
          type="button"
          onClick={() => setIsSearchOpen(!isSearchOpen)}
          className={cn(
            "p-1.5 rounded text-slate-500 hover:text-indigo-600 transition-colors",
            isSearchOpen ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" : "hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
          title="Search & Replace (Ctrl+H)"
        >
          <Search size={14} />
        </button>

        <ViewControlsMenu
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
          isFocusMode={isFocusMode}
          setIsFocusMode={setIsFocusMode}
          isTypewriterMode={isTypewriterMode}
          setIsTypewriterMode={setIsTypewriterMode}
        />
      </div>
    </div>
  );
}
