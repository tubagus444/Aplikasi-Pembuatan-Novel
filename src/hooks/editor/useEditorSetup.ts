import { useEditor, ReactRenderer, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import TiptapHistory from '@tiptap/extension-history';
import { SearchAndReplace } from '../../extensions/SearchAndReplace';
import { PassiveCodexHighlight } from '../../extensions/PassiveCodexHighlight';
import { MentionList } from '../../components/editor/MentionList';
import { CustomAIKeymap } from './useEditorAI';
import tippy from 'tippy.js';
import { cn } from '../../lib/utils';
import { CodexEntry } from '../../types';
import { useRef, useEffect } from 'react';

interface UseEditorSetupProps {
  codexEntries: CodexEntry[];
  onCodexClick: (entryId: number, event: MouseEvent) => void;
  onUpdate: (props: { editor: Editor }) => void;
}

export function useEditorSetup({ codexEntries, onCodexClick, onUpdate }: UseEditorSetupProps) {
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
      StarterKit.configure({
        undoRedo: false,
      }),
      TiptapHistory,
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
    content: '',
    onUpdate: (props) => {
      onUpdateRef.current?.(props as any);
    },
    editorProps: {
      attributes: {
        class: cn(
          "relative w-full font-serif text-lg leading-relaxed text-foreground bg-transparent focus:outline-none min-h-[500px]"
        ),
      },
    },
  });

  return editor;
}
