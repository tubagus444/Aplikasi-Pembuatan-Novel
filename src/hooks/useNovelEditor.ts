/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { useEditorSetup } from './editor/useEditorSetup';
import { useEditorAutosave } from './editor/useEditorAutosave';
import { useEditorCodexSync } from './editor/useEditorCodex';
import { useTypewriterMode } from './editor/useTypewriterMode';
import { useEditorAI } from './editor/useEditorAI';
import { useEditorSearch } from './editor/useEditorSearch';
import { CodexEntry } from '../types';

interface UseNovelEditorProps {
  chapterId: number;
  chapter: any;
  codexEntries: CodexEntry[];
  bibleRules: any[];
  aiActions: any[];
  isTypewriterMode: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useNovelEditor({
  chapterId,
  chapter,
  codexEntries,
  bibleRules,
  aiActions,
  isTypewriterMode,
  containerRef
}: UseNovelEditorProps) {

  const [activeCodexPopup, setActiveCodexPopup] = useState<{ id: number; x: number; y: number } | null>(null);

  let onEditorUpdateRef: any = null;

  const editor = useEditorSetup({
    codexEntries,
    onCodexClick: (id, e) => setActiveCodexPopup({ id, x: e.clientX, y: e.clientY }),
    onUpdate: (props) => onEditorUpdateRef?.(props),
  });

  useEditorCodexSync(editor, codexEntries);

  const { title, handleTitleChange, onEditorUpdate } = useEditorAutosave({
    chapterId,
    chapter,
    editor
  });

  // Wire up the callback
  onEditorUpdateRef = onEditorUpdate;

  // Typewriter
  useTypewriterMode(editor, isTypewriterMode, containerRef, () => setActiveCodexPopup(null));

  // AI
  const { isAiProcessing, runAiAction } = useEditorAI(editor, chapterId, codexEntries, bibleRules);

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
    activeCodexPopup,
    setActiveCodexPopup,
    runAiAction,
    ...searchProps
  };
}

