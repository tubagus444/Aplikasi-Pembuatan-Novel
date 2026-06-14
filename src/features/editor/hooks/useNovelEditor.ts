/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback } from 'react';
import { useEditorSetup } from '@/src/features/editor/hooks/useEditorSetup';
import { useEditorSave } from '@/src/features/editor/hooks/useEditorSave';
import { useEditorCodexSync } from '@/src/features/editor/hooks/useEditorCodex';
import { useTypewriterMode } from '@/src/features/editor/hooks/useTypewriterMode';
import { useEditorAI } from '@/src/features/editor/hooks/useEditorAI';
import { useEditorSearch } from '@/src/features/editor/hooks/useEditorSearch';
import { CodexEntry } from '@/src/types';

interface UseNovelEditorProps {
  chapterId: number;
  chapter: any;
  codexEntries: CodexEntry[];
  bibleRules: any[];
  relationships?: import('@/src/types').Relationship[];
  aiActions: any[];
  isTypewriterMode: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useNovelEditor({
  chapterId,
  chapter,
  codexEntries,
  bibleRules,
  relationships = [],
  aiActions,
  isTypewriterMode,
  containerRef
}: UseNovelEditorProps) {

  const [activeCodexPopup, setActiveCodexPopup] = useState<{ id: number; x: number; y: number } | null>(null);

  // Ref stabil: onUpdate editor selalu memanggil versi terbaru onEditorUpdate (ED3).
  const onEditorUpdateRef = useRef<((props: any) => void) | null>(null);
  const handleEditorUpdate = useCallback((props: any) => onEditorUpdateRef.current?.(props), []);

  const editor = useEditorSetup({
    chapterId,
    initialContent: chapter?.content,
    codexEntries,
    onCodexClick: (id, e) => setActiveCodexPopup({ id, x: e.clientX, y: e.clientY }),
    onUpdate: handleEditorUpdate,
  });

  useEditorCodexSync(editor, codexEntries);

  const { title, handleTitleChange, onEditorUpdate } = useEditorSave({
    chapterId,
    chapter,
    editor
  });

  // Wire up the callback (dibaca lewat ref saat update terjadi → selalu versi terbaru)
  onEditorUpdateRef.current = onEditorUpdate;

  // Typewriter
  useTypewriterMode(editor, isTypewriterMode, containerRef, () => setActiveCodexPopup(null));

  // AI
  const { 
    isAiProcessing, 
    retryStatus,
    rewritePreview, 
    setRewritePreview, 
    runAiAction, 
    acceptRewrite, 
    insertRewriteBelow, 
    discardRewrite 
  } = useEditorAI(editor, chapterId, codexEntries, bibleRules, relationships);

  // Search
  const searchProps = useEditorSearch(editor);

  // Keep Codex hook updated with the editor
  // (We passed null originally because we instantiated it before editor, but the effect uses `editor` dependencies in our refactored hook)
  // Actually, `useEditorCodex` takes `editor`. We can just call it AFTER editor setup!
  
  return {
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
    ...searchProps
  };
}

