/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Editor } from '@tiptap/core';
import { 
  MessageSquareText, 
  History,
  GripVertical,
  Gauge,
  Undo,
  Redo,
  Zap,
  Type,
  Search,
  Minus,
  Plus
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useEditorPanel } from '@/src/contexts/EditorPanelContext';

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
  const { activePanel, setActivePanel, saveStatus } = useEditorPanel();
  
  const togglePanel = (panel: any) => {
    setActivePanel(activePanel === panel ? 'none' : panel);
  };

  const wordCount = editor?.state.doc.textContent.trim().split(/\s+/).filter(Boolean).length || 0;
  const charCount = editor?.state.doc.textContent.length || 0;

  return (
    <div className="h-12 border-t border-slate-200 dark:border-slate-800 bg-background/90 backdrop-blur-md px-6 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest z-10 transition-colors">
      {/* Left: Stats & Zoom */}
      <div className="flex gap-4 items-center">
        <span className="bg-slate-100 dark:bg-slate-800/50 px-3 py-1 rounded-full text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors cursor-default">
          KATA: {wordCount}
        </span>
        <span className="hidden sm:inline hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-default">KARAKTER: {charCount}</span>

        <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block"></div>
        
        {/* Zoom Controls */}
        <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-full px-1 py-0.5 border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
          <button 
            onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
            className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-all active:scale-95"
            title="Perkecil Zoom"
          >
            <Minus size={12} strokeWidth={3} />
          </button>
          <span className="w-10 text-center font-mono text-[10px] text-slate-600 dark:text-slate-300 font-bold select-none cursor-ew-resize" title="Ukuran Teks">
            {zoomLevel}%
          </span>
          <button 
            onClick={() => setZoomLevel(Math.min(250, zoomLevel + 10))}
            className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-all active:scale-95"
            title="Perbesar Zoom"
          >
            <Plus size={12} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* Middle: Save Status */}
      <div className="flex items-center justify-center">
        <span className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all duration-300 border border-transparent", 
          saveStatus === 'Menyimpan...' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/20' : 
          saveStatus === 'Tersimpan' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-900/20 opacity-100' : 'opacity-0'
        )}>
          <div className={cn("w-1.5 h-1.5 rounded-full", saveStatus === 'Menyimpan...' ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
          {saveStatus || 'Tersimpan'}
        </span>
      </div>

      {/* Right: Controls & Toggles */}
      <div className="flex gap-2 items-center">
        <div className="flex items-center justify-center p-1.5 mr-1" title="SINKRONISASI AKTIF">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse outline outline-2 outline-emerald-500/10"></div>
        </div>

        <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block"></div>

        <div className="flex gap-1 items-center">
          <button
            onClick={() => setIsFocusMode(!isFocusMode)}
            className={cn(
              "p-1.5 rounded text-slate-500 hover:text-indigo-600 transition-colors",
              isFocusMode ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" : "hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
            title="Focus Mode (Ctrl+Alt+F)"
          >
            <Zap size={14} />
          </button>

          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={cn(
              "p-1.5 rounded text-slate-500 hover:text-indigo-600 transition-colors",
              isSearchOpen ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" : "hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
            title="Search & Replace (Ctrl+H)"
          >
            <Search size={14} />
          </button>
          
          <button
            aria-label="Undo"
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().undo()}
            className="p-1.5 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo size={14} />
          </button>
          <button
            aria-label="Redo"
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().redo()}
            className="p-1.5 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo size={14} />
          </button>
        </div>

        <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1"></div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsTypewriterMode(!isTypewriterMode)}
            className={cn(
              "p-1.5 rounded transition-colors group relative",
              isTypewriterMode ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
            title="Mode Mesin Tik"
          >
            <Type size={14} />
          </button>

          <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1"></div>

          <button 
            onClick={() => togglePanel('snapshots')}
            className={cn(
              "p-1.5 rounded transition-all",
              activePanel === 'snapshots' ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 shadow-sm" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
            title="Riwayat Versi"
          >
            <History size={16} />
          </button>
          <button 
            onClick={() => togglePanel('insights')}
            className={cn(
              "p-1.5 rounded transition-all",
              activePanel === 'insights' ? "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 shadow-sm" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
            title="Analisis Prosa"
          >
            <Gauge size={16} />
          </button>
          
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1"></div>

          <button 
            onClick={() => togglePanel('assistant')}
            className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full transition-all border",
              activePanel === 'assistant' 
                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20" 
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:text-slate-100"
            )}
            title="Asisten AI"
          >
            <MessageSquareText size={14} />
            <span className="hidden lg:inline">Asisten AI</span>
          </button>
        </div>
      </div>
    </div>
  );
}
