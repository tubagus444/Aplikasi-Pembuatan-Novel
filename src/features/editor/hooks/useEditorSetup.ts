import { useEditor, ReactRenderer, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import TextAlign from '@tiptap/extension-text-align';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

import { SearchAndReplace } from '@/src/features/editor/extensions/SearchAndReplace';
import { PassiveCodexHighlight } from '@/src/features/editor/extensions/PassiveCodexHighlight';
import { MentionList } from '@/src/features/editor/components/MentionList';
import { CustomAIKeymap } from '@/src/features/editor/hooks/useEditorAI';
import tippy from 'tippy.js';
import { cn } from '@/src/lib/utils';
import { CodexEntry } from '@/src/types';
import { useRef, useEffect, useState } from 'react';

interface UseEditorSetupProps {
  chapterId: number;
  initialContent?: string;
  codexEntries: CodexEntry[];
  onCodexClick: (entryId: number, event: MouseEvent) => void;
  onUpdate: (props: { editor: Editor }) => void;
}

export function useEditorSetup({ chapterId, initialContent, codexEntries, onCodexClick, onUpdate }: UseEditorSetupProps) {
  const codexEntriesRef = useRef<CodexEntry[]>(codexEntries);
  const onUpdateRef = useRef(onUpdate);
  const isMountedRef = useRef(true);

  // Yjs Refs
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<IndexeddbPersistence | null>(null);
  const [isSynced, setIsSynced] = useState(false);

  // Initialize Yjs synchronously on first render
  if (!ydocRef.current) {
    ydocRef.current = new Y.Doc();
    providerRef.current = new IndexeddbPersistence(`aetherscribe-chapter-${chapterId}`, ydocRef.current);
    
    providerRef.current.on('synced', () => {
      // If the document is totally empty (e.g. migration or new chapter), prepopulate it
      // Wait, Tiptap uses the fragment 'default' normally.
      if (isMountedRef.current) {
        setIsSynced(true);
      }
    });
  }

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      providerRef.current?.destroy();
      ydocRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    codexEntriesRef.current = codexEntries;
  }, [codexEntries]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false,
        undoRedo: false,
      } as any),
      Collaboration.configure({
        document: ydocRef.current!,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      CustomAIKeymap,
      SearchAndReplace.configure({
        disableRegex: false,
        caseSensitive: false,
      }),
      PassiveCodexHighlight.configure({
        getCodexEntries: () => codexEntriesRef.current,
        onCodexClick: (entryId, event) => onCodexClick(entryId, event)
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
    // content: '', // Collaboration ignores initial content in useEditor, we'll set it manually if needed
    onUpdate: (props) => {
      onUpdateRef.current?.(props as any);
    },
    editorProps: {
      attributes: {
        class: cn(
          "relative w-full font-serif text-lg sm:text-[19px] leading-[1.8] text-slate-800 dark:text-slate-300 bg-transparent focus:outline-none min-h-[500px]"
        ),
      },
    },
  });

  // Prepopulate if new or migrated
  useEffect(() => {
    if (isSynced && editor && editor.isEmpty && initialContent && initialContent.length > 5) {
      // Check if Y.Doc is literally empty (no content yet except empty paragraph)
      // Tiptap's isEmpty returns true for `<p></p>`
      editor.commands.setContent(initialContent);
    }
  }, [isSynced, editor, initialContent]);

  return editor;
}
