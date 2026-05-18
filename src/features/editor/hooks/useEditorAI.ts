import { useState } from 'react';
import { Editor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import { getRelevantContext, getRelevantBibleRules } from '@/src/services/contextEngine';
import { processRewrite } from '@/src/services/ai';
import { useToast } from '@/src/hooks/useToast';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { CodexEntry } from '@/src/types';

// Custom Keymap Extension
export const CustomAIKeymap = Extension.create({
  name: 'customAIKeymap',
  addKeyboardShortcuts() {
    return {
      'Mod-b': ({ editor }) => editor.commands.toggleBold(),
      'Mod-i': ({ editor }) => editor.commands.toggleItalic(),
    }
  },
});

export function useEditorAI(
  editor: Editor | null,
  chapterId: number,
  codexEntries: CodexEntry[],
  bibleRules: any[]
) {
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const { toast } = useToast();
  const { setViewMode } = useNavigation();

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
      if (err.code === 'INVALID_KEY' || err.code === 'QUOTA_EXCEEDED') {
        toast.error(err.message, {
          action: {
            label: 'Buka Pengaturan',
            onClick: () => {
              setViewMode('settings');
            }
          }
        });
      } else {
        toast.error(err.message || 'AI Rewrite failed. Please try again.');
      }
    } finally {
      setIsAiProcessing(false);
    }
  };

  return {
    isAiProcessing,
    runAiAction
  };
}
