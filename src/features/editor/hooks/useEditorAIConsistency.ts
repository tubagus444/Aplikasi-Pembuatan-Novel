import { useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { CodexEntry, StoryBibleRule, Relationship } from '@/src/types';
import { InlineQuoteFinding } from '@/src/lib/inlineConsistency';
import { checkConsistency, cancelAI } from '@/src/services/ai';

const ENABLED_KEY = 'ai_inline_consistency';
const ACTION_TYPE = 'consistency-inline';
const IDLE_MS = 2500;       // jeda berhenti mengetik sebelum memeriksa
const MIN_PARAGRAPH = 40;   // paragraf terlalu pendek → lewati (hemat token)

interface AIConsistencyData {
  chapterTitle?: string;
  codexEntries: CodexEntry[];
  bibleRules: StoryBibleRule[];
  relationships: Relationship[];
}

function isEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === 'true'; } catch { return false; }
}

/**
 * Lapisan AI OPSIONAL untuk konsistensi inline (Fase 2). Default mati → nol token.
 *
 * Saat aktif: setelah berhenti mengetik (idle), memeriksa HANYA paragraf tempat
 * kursor berada terhadap Codex/Bible via checkConsistency (KB ter-cache provider),
 * lalu mendorong kutipan kontradiktif ke garis bawah. Dibatasi ketat: per-paragraf,
 * debounce, dedup paragraf identik, dan abort key terpisah dari panel.
 */
export function useEditorAIConsistency(
  editor: Editor | null,
  quoteFindingsRef: React.MutableRefObject<InlineQuoteFinding[]>,
  chapterId: number,
  data: AIConsistencyData,
) {
  const dataRef = useRef(data);
  dataRef.current = data;

  const [enabled, setEnabled] = useState<boolean>(isEnabled);
  const lastCheckedRef = useRef<string>('');

  // Toggle disimpan di Settings; reaksi lewat event 'storage' (di-dispatch handleSave).
  useEffect(() => {
    const onStorage = () => setEnabled(isEnabled());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Bersihkan garis bawah AI saat dimatikan atau ganti bab.
  useEffect(() => {
    lastCheckedRef.current = '';
    if (!enabled) {
      cancelAI(ACTION_TYPE);
      if (quoteFindingsRef.current.length && editor && !editor.isDestroyed) {
        quoteFindingsRef.current = [];
        editor.view.dispatch(editor.state.tr.setMeta('forceUpdateConsistency', true));
      } else {
        quoteFindingsRef.current = [];
      }
    }
  }, [enabled, chapterId, editor, quoteFindingsRef]);

  useEffect(() => {
    if (!editor || !enabled) return;
    let timer: any = null;
    let cancelled = false;

    const runCheck = async () => {
      if (cancelled || editor.isDestroyed) return;
      const para = editor.state.selection.$from.parent;
      const text = para && para.isTextblock ? para.textContent.trim() : '';
      if (text.length < MIN_PARAGRAPH || text === lastCheckedRef.current) return;
      lastCheckedRef.current = text;

      const d = dataRef.current;
      cancelAI(ACTION_TYPE); // batalkan pemeriksaan paragraf sebelumnya yang masih jalan
      try {
        const { findings } = await checkConsistency({
          chapterText: text,
          chapterTitle: d.chapterTitle,
          bibleRules: d.bibleRules,
          codexEntries: d.codexEntries,
          relationships: d.relationships,
          actionType: ACTION_TYPE,
        });
        if (cancelled || editor.isDestroyed) return;
        const lower = text.toLowerCase();
        const mapped: InlineQuoteFinding[] = findings
          // Buang kutipan yang tak benar-benar ada di paragraf (anti-halusinasi).
          .filter(f => f.quote && lower.includes(f.quote.trim().toLowerCase()))
          .map(f => ({
            quote: f.quote.trim(),
            severity: f.severity,
            message: [
              f.explanation,
              f.conflictsWith ? `(vs ${f.conflictsWith})` : '',
              f.suggestion ? `→ ${f.suggestion}` : '',
            ].filter(Boolean).join(' '),
          }));
        quoteFindingsRef.current = mapped;
        editor.view.dispatch(editor.state.tr.setMeta('forceUpdateConsistency', true));
      } catch (e: any) {
        // AbortError/koneksi: diam — jangan ganggu alur menulis dengan error inline.
      }
    };

    const onUpdate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(runCheck, IDLE_MS);
    };

    editor.on('update', onUpdate);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      editor.off('update', onUpdate);
      cancelAI(ACTION_TYPE);
    };
  }, [editor, enabled, quoteFindingsRef]);
}
