/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { 
  Loader2, 
  X, 
  ScrollText, 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useUI } from '../contexts/UIContext';
import { EditorContent } from '@tiptap/react';
import { SelectionFloatingMenu } from './SelectionFloatingMenu';
import { EditorPanelProvider } from '../EditorPanelContext';
import { useProjectData } from '../hooks/useProjectData';
import { useGlobalEvents } from '../hooks/useGlobalEvents';

// New Modular Components & Hooks
import { useNovelEditor } from '../hooks/useNovelEditor';
import { EditorHeader } from './editor/EditorHeader';
import { EditorFooter } from './editor/EditorFooter';
import { EditorLayout } from './editor/EditorLayout';
import { AiProcessingOverlay } from './editor/AiProcessingOverlay';
import { NovelPanels } from './editor/NovelPanels';
import { SearchReplaceBar } from './editor/SearchReplaceBar';

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
  const { isFocusMode, setIsFocusMode } = useUI();
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

  const { codexEntries, aiActions, bibleRules, isLoading } = useProjectData(projectId);

  const {
    editor,
    title,
    handleTitleChange,
    isAiProcessing,
    activeCodexPopup,
    setActiveCodexPopup,
    runAiAction,
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
    searchStats,
    closeSearch
  } = useNovelEditor({
    chapterId,
    chapter,
    codexEntries: codexEntries || [],
    bibleRules: bibleRules || [],
    aiActions: aiActions || [],
    isTypewriterMode,
    containerRef
  });

  // Editor-specific Global Events (Ctrl+H, etc)
  useGlobalEvents({
    onToggleEditorSearch: () => setIsSearchOpen(!isSearchOpen),
    isEditorSearchOpen: isSearchOpen
  });

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
      footer={
        <EditorFooter 
          editor={editor} 
          isTypewriterMode={isTypewriterMode} 
          setIsTypewriterMode={setIsTypewriterMode} 
          isFocusMode={isFocusMode}
          setIsFocusMode={setIsFocusMode}
          isSearchOpen={isSearchOpen}
          setIsSearchOpen={setIsSearchOpen}
        />
      }
      panels={
        <NovelPanels 
          projectId={projectId} 
          chapterId={chapterId} 
          editor={editor} 
          codexEntries={codexEntries || []} 
          bibleRules={bibleRules || []} 
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
          <SelectionFloatingMenu editor={editor} onAiAction={runAiAction} customActions={aiActions} />
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
                className="fixed z-[100] bg-slate-900 border border-slate-700 text-white p-4 rounded-xl shadow-2xl w-64 text-sm pointer-events-auto"
                style={{ left: Math.min(activeCodexPopup.x + 10, window.innerWidth - 280), top: safeY }}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-indigo-400 uppercase text-[10px] tracking-widest">{entry.category}</span>
                  <button onClick={() => setActiveCodexPopup(null)} className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 rounded-full p-0.5"><X size={12} /></button>
                </div>
                <h4 className="font-bold text-base mb-1 text-slate-100">{entry.name}</h4>
                <p className="font-serif italic text-slate-300 text-xs leading-relaxed line-clamp-4">{entry.description || 'No description available.'}</p>
                {entry.aliases && entry.aliases.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap gap-1">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 w-full mb-1">Aliases</span>
                    {entry.aliases.map(a => <span key={a} className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">{a}</span>)}
                  </div>
                )}
              </motion.div>
            );
          })()}
        </AnimatePresence>

        <EditorContent editor={editor} />

        <AiProcessingOverlay isProcessing={isAiProcessing} />
      </div>
    </EditorLayout>
  );
}
