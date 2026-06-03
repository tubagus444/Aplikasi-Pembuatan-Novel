import { useState, useRef } from 'react';
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

export interface RewritePreview {
  original: string;
  rewritten: string;
  from: number;
  to: number;
}

export function useEditorAI(
  editor: Editor | null,
  chapterId: number,
  codexEntries: CodexEntry[],
  bibleRules: any[],
  relationships: import('@/src/types').Relationship[] = []
) {
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const [rewritePreview, setRewritePreview] = useState<RewritePreview | null>(null);
  const { toast } = useToast();
  const { setViewMode } = useNavigation();
  
  const streamBufferRef = useRef<string>('');
  const isStreamingRef = useRef<boolean>(false);

  const runAiAction = async (action: string, provider?: string, customPrompt?: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    
    if (selectedText.length < 5) return;

    setIsAiProcessing(true);
    setRetryStatus(null);
    setRewritePreview(null);
    try {
      const chapterContent = editor.getText();

      streamBufferRef.current = "";
      isStreamingRef.current = true;
      setRewritePreview({
        original: selectedText,
        rewritten: "",
        from,
        to
      });

      const flushBuffer = () => {
        if (!isStreamingRef.current) return;
        setRewritePreview(prev => prev ? { ...prev, rewritten: streamBufferRef.current } : null);
      };

      const flushInterval = setInterval(flushBuffer, 50);

      const result = await processRewrite({
        action,
        selection: selectedText,
        bibleRules: bibleRules,
        codexEntries: codexEntries,
        relationships: relationships,
        prompt: customPrompt || '',
        chapterId,
        provider,
        contextText: chapterContent,
        stream: true,
        onRetry: (attempt, error, currentProvider) => {
          setRetryStatus(`Koneksi melambat (${currentProvider}). Percobaan ulang ke-${attempt}...`);
        },
        onChunk: (chunk) => {
           streamBufferRef.current += chunk;
        }
      });

      isStreamingRef.current = false;
      clearInterval(flushInterval);
      
      const finalRewritten = streamBufferRef.current || result;
      setRewritePreview({
        original: selectedText,
        rewritten: finalRewritten,
        from,
        to
      });
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
      setRetryStatus(null);
    }
  };

  const acceptRewrite = () => {
    if (!editor || !rewritePreview) return;
    const { from, to, rewritten } = rewritePreview;
    
    editor.chain().focus().insertContentAt({ from, to }, rewritten).run();
    setRewritePreview(null);
    toast.success('Tulisan berhasil diperbarui!');
  };

  const insertRewriteBelow = () => {
    if (!editor || !rewritePreview) return;
    const { to, rewritten } = rewritePreview;
    
    // Insert after current block cleanly
    editor.chain().focus().insertContentAt(to, `\n\n${rewritten}`).run();
    setRewritePreview(null);
    toast.success('Hasil tenunan disisipkan di bawah teks asli!');
  };

  const discardRewrite = () => {
    setRewritePreview(null);
    toast.info('Perubahan dibatalkan.');
  };

  return {
    isAiProcessing,
    retryStatus,
    rewritePreview,
    setRewritePreview,
    runAiAction,
    acceptRewrite,
    insertRewriteBelow,
    discardRewrite
  };
}
