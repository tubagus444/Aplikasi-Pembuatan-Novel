import { useEditor, ReactRenderer, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import TextAlign from '@tiptap/extension-text-align';

import { SearchAndReplace } from '@/src/features/editor/extensions/SearchAndReplace';
import { PassiveCodexHighlight } from '@/src/features/editor/extensions/PassiveCodexHighlight';
import { SemanticHighlight } from '@/src/features/editor/extensions/SemanticHighlight';
import { MentionList } from '@/src/features/editor/components/MentionList';
import { CustomAIKeymap } from '@/src/features/editor/hooks/useEditorAI';
import tippy from 'tippy.js';
import { cn } from '@/src/lib/utils';
import { CodexEntry } from '@/src/types';
import { useRef, useEffect } from 'react';

interface UseEditorSetupProps {
  chapterId: number;
  initialContent?: string;
  codexEntries: CodexEntry[];
  onCodexClick: (entryId: number, event: MouseEvent) => void;
  onUpdate: (props: { editor: Editor }) => void;
}

const CustomMention = Mention.extend({
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      HTMLAttributes,
      `${node.attrs.label ?? node.attrs.id}`,
    ];
  },
  renderText({ node }) {
    return `${node.attrs.label ?? node.attrs.id}`;
  },
});

export function useEditorSetup({ chapterId, initialContent, codexEntries, onCodexClick, onUpdate }: UseEditorSetupProps) {
  const codexEntriesRef = useRef<CodexEntry[]>(codexEntries);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    codexEntriesRef.current = codexEntries;
  }, [codexEntries]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      CustomAIKeymap,
      SearchAndReplace.configure({
        disableRegex: false,
        caseSensitive: false,
      }),
      SemanticHighlight,
      PassiveCodexHighlight.configure({
        getCodexEntries: () => codexEntriesRef.current,
        onCodexClick: (entryId, event) => onCodexClick(entryId, event)
      }),
      Placeholder.configure({
        placeholder: 'Mulai menulis cerita Anda...',
      }),
      CustomMention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: {
          items: ({ query }) => {
            const entries = codexEntriesRef.current;
            return entries
              .filter(item => 
                item.name.toLowerCase().includes(query.toLowerCase()) ||
                item.aliases?.some(a => a.toLowerCase().includes(query.toLowerCase()))
              )
              .slice(0, 50);
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
                  theme: 'mention',
                  arrow: false,
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
    content: initialContent || '',
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

  const hasSetInitialContent = useRef(false);

  // Reset the flag when chapterId changes
  useEffect(() => {
    hasSetInitialContent.current = false;
  }, [chapterId]);

  // Apply initial content when it becomes available
  useEffect(() => {
    if (editor && initialContent !== undefined && !hasSetInitialContent.current) {
      if (editor.getHTML() !== initialContent) {
        // emitUpdate:false → muat konten awal tanpa memicu onUpdate (cegah autosave churn). (ED2)
        editor.commands.setContent(initialContent, { emitUpdate: false });
      }
      hasSetInitialContent.current = true;
    }
  }, [editor, initialContent]);

  return editor;
}
