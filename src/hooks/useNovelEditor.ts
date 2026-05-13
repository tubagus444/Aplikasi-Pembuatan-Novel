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

  useEffect(() => {
    chapterIdRef.current = chapterId;
  }, [chapterId]);

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
      const html = editor.getHTML();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaveStatus('Menyimpan...');
      
      saveTimeoutRef.current = setTimeout(() => {
        db.chapters.update(chapterIdRef.current, { content: html, lastModified: Date.now() }).then(() => {
          setSaveStatus('Tersimpan');
          setTimeout(() => setSaveStatus(''), 2000);
        });
      }, 1000);
    },
    editorProps: {
      attributes: {
        class: cn(
          "relative w-full font-serif text-lg leading-relaxed text-foreground bg-transparent focus:outline-none min-h-[500px]"
        ),
      },
    },
  }, [setSaveStatus]);

  // Sync title and content when chapter changes
  useEffect(() => {
    if (chapter && editor) {
      if (editor.getHTML() !== chapter.content) {
        editor.commands.setContent(chapter.content);
        if ((editor.commands as any).clearHistory) {
          (editor.commands as any).clearHistory();
        }
      }
      if (title !== chapter.title) {
        setTitle(chapter.title);
      }
    }
  }, [chapter?.id, editor]);

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
