/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import TiptapHistory from '@tiptap/extension-history';
import { Extension } from '@tiptap/core';
import tippy from 'tippy.js';
import { db } from '../db';
import { PassiveCodexHighlight } from '../extensions/PassiveCodexHighlight';
import { MentionList } from '../components/MentionList';
import { CodexEntry } from '../types';
import { useToast } from './useToast';
import { cn } from '../lib/utils';
import { getRelevantContext, getRelevantBibleRules } from '../services/contextEngine';
import { processRewrite } from '../services/ai';

import { useEditorPanel } from '../EditorPanelContext';

// Custom Keymap Extension
const CustomAIKeymap = Extension.create({
  name: 'customAIKeymap',
  addKeyboardShortcuts() {
    return {
      'Mod-b': ({ editor }) => editor.commands.toggleBold(),
      'Mod-i': ({ editor }) => editor.commands.toggleItalic(),
    }
  },
});

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
  const { setSaveStatus } = useEditorPanel();
  const [title, setTitle] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [activeCodexPopup, setActiveCodexPopup] = useState<{ id: number; x: number; y: number } | null>(null);
  const { toast } = useToast();

  const codexEntriesRef = useRef<CodexEntry[]>(codexEntries);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chapterIdRef = useRef(chapterId);
  const skipNextUpdateRef = useRef(false);
  const isMountedRef = useRef(true);

  // Helper to perform the actual database update
  const performSave = useCallback((id: number, content: string) => {
    if (!id || id <= 0) return Promise.resolve();
    if (!isMountedRef.current) {
      // Just do the update without state changes if unmounted
      return db.chapters.update(id, { content, lastModified: Date.now() });
    }

    setSaveStatus('Menyimpan...');
    return db.chapters.update(id, { content, lastModified: Date.now() }).then(() => {
      if (isMountedRef.current) {
        setSaveStatus('Tersimpan');
        setTimeout(() => {
          if (isMountedRef.current) setSaveStatus('');
        }, 2000);
      }
    }).catch(err => {
      console.error('Failed to save chapter:', err);
      if (isMountedRef.current) setSaveStatus('Gagal menyimpan');
    });
  }, [setSaveStatus]);

  useEffect(() => {
    codexEntriesRef.current = codexEntries;
  }, [codexEntries]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        undoRedo: false,
      }),
      TiptapHistory,
      CustomAIKeymap,
      PassiveCodexHighlight.configure({
        getCodexEntries: () => codexEntriesRef.current,
        onCodexClick: (entryId, event) => {
          setActiveCodexPopup({
            id: entryId,
            x: event.clientX,
            y: event.clientY,
          });
        }
      }),
      Placeholder.configure({
        placeholder: 'Mulai menulis cerita Anda...',
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: {
          items: ({ query }) => {
            const entries = codexEntriesRef.current;
            return entries
              .filter(item => 
                item.name.toLowerCase().startsWith(query.toLowerCase()) ||
                item.aliases?.some(a => a.toLowerCase().startsWith(query.toLowerCase()))
              )
              .slice(0, 5);
          },
          render: () => {
            let component: ReactRenderer;
            let popup: any;

            return {
              onStart: (props: any) => {
                component = new ReactRenderer(MentionList, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) return;

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },
              onUpdate(props: any) {
                component.updateProps(props);
                if (!props.clientRect) return;
                popup[0].setProps({
                  getReferenceClientRect: props.clientRect,
                });
              },
              onKeyDown(props: any) {
                if (props.event.key === 'Escape') {
                  popup[0].hide();
                  return true;
                }
                return (component.ref as any)?.onKeyDown(props);
              },
              onExit() {
                if (popup?.[0]) popup[0].destroy();
                if (component) component.destroy();
              },
            };
          },
        },
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      if (skipNextUpdateRef.current) {
        skipNextUpdateRef.current = false;
        return;
      }
      
      const html = editor.getHTML();
      // Ensure we use the ID that matched the content at the time of typing
      const idToSave = chapterIdRef.current;
      
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaveStatus('Menyimpan...');
      
      saveTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          performSave(idToSave, html);
          saveTimeoutRef.current = null;
        }
      }, 1000);
    },
    editorProps: {
      attributes: {
        class: cn(
          "relative w-full font-serif text-lg leading-relaxed text-foreground bg-transparent focus:outline-none min-h-[500px]"
        ),
      },
    },
  }, [setSaveStatus, performSave]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Final cleanup on unmount
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        const html = editor?.getHTML();
        if (html && chapterIdRef.current) {
          performSave(chapterIdRef.current, html);
        }
      }
    };
  }, [editor, performSave]);

  // Sync title and content when chapter changes
  useEffect(() => {
    if (chapter && editor) {
      const oldId = chapterIdRef.current;
      const newId = chapter.id;

      if (oldId !== newId) {
        // 1. Force save pending changes for old chapter
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          performSave(oldId, editor.getHTML());
        }

        // 2. Officially switch to new chapter
        chapterIdRef.current = newId;

        // 3. Update editor content
        skipNextUpdateRef.current = true;
        editor.commands.setContent(chapter.content);
        if ((editor.commands as any).clearHistory) {
          (editor.commands as any).clearHistory();
        }
        
        if (title !== chapter.title) {
          setTitle(chapter.title);
        }
      } else if (editor.isEmpty && chapter.content) {
        // Initial load for the same chapter (e.g. refresh or first load)
        skipNextUpdateRef.current = true;
        editor.commands.setContent(chapter.content);
        if (title !== chapter.title) {
          setTitle(chapter.title);
        }
      }
    }
  }, [chapter?.id, editor, performSave]);

  // Handle typewriter mode effects
  useEffect(() => {
    if (editor) {
      if (isTypewriterMode) {
        editor.view.dom.style.paddingTop = '40vh';
        editor.view.dom.style.paddingBottom = '40vh';
      } else {
        editor.view.dom.style.paddingTop = '0';
        editor.view.dom.style.paddingBottom = '48px';
      }
    }
  }, [editor, isTypewriterMode]);

  // Handle auto-scroll for typewriter mode and popup management
  useEffect(() => {
    if (!editor) return;
    const handleUpdate = () => {
      setActiveCodexPopup(null);
      if (isTypewriterMode && containerRef.current) {
        const { view } = editor;
        const { selection } = view.state;
        try {
          const coords = view.coordsAtPos(selection.from);
          const containerRect = containerRef.current.getBoundingClientRect();
          const relativeTop = coords.top - containerRect.top + containerRef.current.scrollTop;
          const targetScroll = relativeTop - containerRef.current.clientHeight / 2;
          containerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
        } catch(e) {}
      }
    };
    editor.on('selectionUpdate', handleUpdate);
    editor.on('update', handleUpdate);
    return () => {
      editor.off('selectionUpdate', handleUpdate);
      editor.off('update', handleUpdate);
    }
  }, [editor, isTypewriterMode, containerRef]);

  // Force update Codex when entries change
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.view.dispatch(editor.state.tr.setMeta('forceUpdateCodex', true));
    }
  }, [codexEntries, editor]);

  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    db.chapters.update(chapterId, { title: newTitle });
  }, [chapterId]);

  const runAiAction = async (action: string, provider?: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    
    if (selectedText.length < 5) return;

    setIsAiProcessing(true);
    try {
      const relevantCodex = await getRelevantContext(selectedText, codexEntries || []);
      const relevantBible = await getRelevantBibleRules(selectedText, bibleRules || []);

      const result = await processRewrite({
        action,
        selection: selectedText,
        bibleRules: relevantBible,
        codexEntries: relevantCodex,
        prompt: '',
        chapterId,
        provider
      });

      editor.commands.insertContentAt({ from, to }, result);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'AI Rewrite failed. Please try again.');
    } finally {
      setIsAiProcessing(false);
    }
  };

  return {
    editor,
    title,
    handleTitleChange,
    isAiProcessing,
    activeCodexPopup,
    setActiveCodexPopup,
    runAiAction
  };
}
