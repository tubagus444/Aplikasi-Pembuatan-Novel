/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/src/db';
import { 
  Loader2, 
  X, 
  ScrollText, 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useUI } from '@/src/contexts/UIContext';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { EditorContent } from '@tiptap/react';
import { SelectionFloatingMenu } from '@/src/features/editor/components/SelectionFloatingMenu';
import { EditorPanelProvider } from '@/src/contexts/EditorPanelContext';
import { useProjectData } from '@/src/hooks/useProjectData';
import { useGlobalEvents } from '@/src/hooks/useGlobalEvents';

// New Modular Components & Hooks
import { useNovelEditor } from '@/src/features/editor/hooks/useNovelEditor';
import { EditorHeader } from '@/src/features/editor/components/EditorHeader';
import { NovelFooter } from '@/src/features/editor/components/NovelFooter';
import { EditorLayout } from '@/src/features/editor/components/EditorLayout';
import { EditorToolbar } from '@/src/features/editor/components/EditorToolbar';
import { AiProcessingOverlay } from '@/src/features/editor/components/AiProcessingOverlay';
import { NovelPanels } from '@/src/features/editor/components/NovelPanels';
import { SearchReplaceBar } from '@/src/features/editor/components/SearchReplaceBar';

interface NovelEditorProps {
  chapterId: number;
  projectId: number;
}

export function NovelEditor(props: NovelEditorProps) {
  return (
    <EditorPanelProvider>
      <NovelEditorInner {...props} />
    </EditorPanelProvider>
  );
}

function NovelEditorInner({ chapterId, projectId }: NovelEditorProps) {
  const [chapter, setChapter] = useState<any>(undefined);
  const [isTypewriterMode, setIsTypewriterMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    const saved = localStorage.getItem('editor_zoom');
    return saved ? parseInt(saved, 10) : 100;
  });

  useEffect(() => {
    localStorage.setItem('editor_zoom', zoomLevel.toString());
  }, [zoomLevel]);

  const { isFocusMode, setIsFocusMode } = useUI();
  const { pendingHighlight, clearPendingHighlight } = useNavigation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    setChapter(undefined); // Start loading
    db.chapters.get(chapterId).then(data => {
      if (isMounted) {
        setChapter(data || null); // null if not found
      }
    });
    return () => { isMounted = false; };
  }, [chapterId]);

  const { codexEntries, aiActions, bibleRules, relationships, isLoading } = useProjectData(projectId);

  const {
    editor,
    title,
    handleTitleChange,
    isAiProcessing,
    retryStatus,
    rewritePreview,
    setRewritePreview,
    runAiAction,
    acceptRewrite,
    insertRewriteBelow,
    discardRewrite,
    activeCodexPopup,
    setActiveCodexPopup,
    handleReplace,
    handleReplaceAll,
    handleNext,
    handlePrev,
    // Search handlers
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    setSearchQuery,
    replaceQuery,
    setReplaceQuery,
    isCaseSensitive,
    setIsCaseSensitive,
    isRegex,
    setIsRegex,
    isSemanticMode,
    setIsSemanticMode,
    searchStats,
    closeSearch
  } = useNovelEditor({
    chapterId,
    chapter,
    codexEntries: codexEntries || [],
    bibleRules: bibleRules || [],
    relationships: relationships || [],
    aiActions: aiActions || [],
    isTypewriterMode,
    containerRef
  });

  // Editor-specific Global Events (Ctrl+H, etc)
  useGlobalEvents({
    onToggleEditorSearch: () => setIsSearchOpen(!isSearchOpen),
    isEditorSearchOpen: isSearchOpen
  });

  // "Loncat ke editor" (mis. dari Cek Konsistensi): buka find bar terisi kutipan,
  // sorot semua kecocokan, lalu pilih+scroll ke yang pertama. Retry singkat sambil
  // konten bab selesai dimuat ke editor.
  useEffect(() => {
    if (!editor || !pendingHighlight || !chapter) return;
    const term = pendingHighlight;
    clearPendingHighlight();
    setSearchQuery(term);
    setIsSearchOpen(true);
    let tries = 0;
    const tryScroll = () => {
      const results = (editor.storage as any).searchAndReplace?.results || [];
      if (results.length > 0) {
        editor.commands.nextSearchResult(); // select + scrollIntoView kecocokan pertama
      } else if (tries++ < 12) {
        setTimeout(tryScroll, 100);
      }
    };
    const t = setTimeout(tryScroll, 80);
    return () => clearTimeout(t);
  }, [editor, pendingHighlight, chapter, clearPendingHighlight, setSearchQuery, setIsSearchOpen]);

  if (chapter === undefined || isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-300 bg-white dark:bg-slate-900">
        <Loader2 size={32} className="animate-spin mb-4 opacity-20" />
        <p className="font-serif italic text-lg">Synchronising Manuscript...</p>
      </div>
    );
  }

  if (chapter === null) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-300 bg-white dark:bg-slate-900">
        <ScrollText size={48} className="mb-4 opacity-20" />
        <p className="font-serif italic text-lg text-center px-8">This chapter has been removed.<br/>Please select another path from the outline.</p>
      </div>
    );
  }

  return (
    <EditorLayout
      isFocusMode={isFocusMode}
      containerRef={containerRef}
      header={<EditorHeader title={title} onTitleChange={handleTitleChange} />}
      toolbar={<EditorToolbar editor={editor} />}
      footer={
        <NovelFooter 
          editor={editor} 
          isTypewriterMode={isTypewriterMode} 
          setIsTypewriterMode={setIsTypewriterMode} 
          isFocusMode={isFocusMode}
          setIsFocusMode={setIsFocusMode}
          isSearchOpen={isSearchOpen}
          setIsSearchOpen={setIsSearchOpen}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
        />
      }
      panels={
        <NovelPanels 
          projectId={projectId} 
          chapterId={chapterId} 
          editor={editor} 
          codexEntries={codexEntries || []} 
          bibleRules={bibleRules || []} 
          relationships={relationships || []}
        />
      }
    >
      <div className="relative w-full">
        <AnimatePresence>
          {isSearchOpen && (
            <SearchReplaceBar
              editor={editor}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              replaceQuery={replaceQuery}
              setReplaceQuery={setReplaceQuery}
              isCaseSensitive={isCaseSensitive}
              setIsCaseSensitive={setIsCaseSensitive}
              isRegex={isRegex}
              setIsRegex={setIsRegex}
              isSemanticMode={isSemanticMode}
              setIsSemanticMode={setIsSemanticMode}
              searchStats={searchStats}
              onClose={closeSearch}
              onReplace={handleReplace}
              onReplaceAll={handleReplaceAll}
              onNext={handleNext}
              onPrev={handlePrev}
            />
          )}
        </AnimatePresence>

        {editor && (
          <SelectionFloatingMenu 
            editor={editor} 
            onAiAction={runAiAction} 
            customActions={aiActions} 
            isAiProcessing={isAiProcessing}
            rewritePreview={rewritePreview}
            onAcceptRewrite={acceptRewrite}
            onInsertBelow={insertRewriteBelow}
            onDiscardRewrite={discardRewrite}
          />
        )}
        
        <AnimatePresence>
          {activeCodexPopup && (() => {
            const entry = codexEntries?.find(e => e.id === activeCodexPopup.id);
            if (!entry) return null;
            const POPUP_HEIGHT = 180;
            const rawY = activeCodexPopup.y + 15;
            const safeY = rawY + POPUP_HEIGHT > window.innerHeight
              ? activeCodexPopup.y - POPUP_HEIGHT - 10
              : rawY;
            return (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed z-[100] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-4 rounded-xl shadow-2xl shadow-slate-200/50 dark:shadow-black/50 w-64 text-sm pointer-events-auto"
                style={{ left: Math.min(activeCodexPopup.x + 10, window.innerWidth - 280), top: safeY }}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase text-[10px] tracking-widest">{entry.category}</span>
                  <button onClick={() => setActiveCodexPopup(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full p-0.5"><X size={12} /></button>
                </div>
                <h4 className="font-bold text-base mb-1 text-slate-800 dark:text-slate-100">{entry.name}</h4>
                <p className="font-serif italic text-slate-600 dark:text-slate-300 text-xs leading-relaxed line-clamp-4">{entry.description || 'No description available.'}</p>
                {entry.aliases && entry.aliases.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 w-full mb-1">Aliases</span>
                    {entry.aliases.map(a => <span key={a} className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">{a}</span>)}
                  </div>
                )}
              </motion.div>
            );
          })()}
        </AnimatePresence>

        <div style={{ zoom: zoomLevel / 100 }} className="transition-all duration-300 origin-top">
          <EditorContent editor={editor} />
        </div>

        <AiProcessingOverlay isProcessing={isAiProcessing} retryStatus={retryStatus} />
      </div>
    </EditorLayout>
  );
}
