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

/**
 * Cache hasil per-paragraf di level MODUL — bertahan saat editor di-unmount
 * (pindah panel) sehingga: (1) garis bawah dipulihkan tanpa memanggil AI lagi,
 * dan (2) paragraf yang isinya tak berubah tak pernah diperiksa ulang (nol token).
 * Kunci: chapterId → (teks paragraf → temuan). Entri kosong tetap disimpan agar
 * paragraf yang sudah bersih pun tak diperiksa berulang. Reset saat refresh penuh.
 */
const chapterCache = new Map<number, Map<string, InlineQuoteFinding[]>>();

function getChapterMap(chapterId: number): Map<string, InlineQuoteFinding[]> {
  let m = chapterCache.get(chapterId);
  if (!m) { m = new Map(); chapterCache.set(chapterId, m); }
  return m;
}

function isEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === 'true'; } catch { return false; }
}

/**
 * Lapisan AI OPSIONAL untuk konsistensi inline (Fase 2). Default mati → nol token.
 *
 * Saat aktif: setelah berhenti mengetik (idle), memeriksa HANYA paragraf tempat
 * kursor berada terhadap Codex/Bible via checkConsistency (KB ter-cache provider),
 * lalu mendorong kutipan kontradiktif ke garis bawah. Hemat token: per-paragraf,
 * debounce, hasil di-cache lintas remount (pindah panel = pulih gratis), abort key
 * terpisah dari panel.
 */
export function useEditorAIConsistency(
  editor: Editor | null,
  quoteFindingsRef: React.MutableRefObject<InlineQuoteFinding[]>,
  chapterId: number,
  data: AIConsistencyData,
): boolean {
  const dataRef = useRef(data);
  dataRef.current = data;

  const [enabled, setEnabled] = useState<boolean>(isEnabled);
  /** true selagi AI memeriksa paragraf — dipakai untuk indikator di editor. */
  const [checking, setChecking] = useState(false);
  const lastCheckedRef = useRef<string>('');

  // Toggle disimpan di Settings; reaksi lewat event 'storage' (di-dispatch saat toggle/Simpan).
  useEffect(() => {
    const onStorage = () => setEnabled(isEnabled());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Bersihkan garis bawah AI saat dimatikan atau ganti bab (cache tetap disimpan).
  useEffect(() => {
    lastCheckedRef.current = '';
    if (!enabled) {
      cancelAI(ACTION_TYPE);
      quoteFindingsRef.current = [];
      if (editor && !editor.isDestroyed) {
        editor.view.dispatch(editor.state.tr.setMeta('forceUpdateConsistency', true));
      }
    }
  }, [enabled, chapterId, editor, quoteFindingsRef]);

  useEffect(() => {
    if (!editor || !enabled) return;
    let timer: any = null;
    let cancelled = false;

    /**
     * Susun ulang quoteFindingsRef dari cache: gabungkan temuan semua paragraf yang
     * MASIH ADA di dokumen (otomatis membuang temuan paragraf yang sudah diedit/hilang),
     * lalu picu render garis bawah. Tanpa memanggil AI.
     */
    const refresh = () => {
      if (cancelled || editor.isDestroyed) return;
      const map = chapterCache.get(chapterId);
      const flat: InlineQuoteFinding[] = [];
      if (map && map.size) {
        const present = new Set<string>();
        editor.state.doc.descendants(node => {
          if (node.isTextblock) {
            const t = node.textContent.trim();
            if (t) present.add(t);
          }
        });
        for (const [paraText, findings] of map) {
          if (present.has(paraText)) flat.push(...findings);
        }
      }
      quoteFindingsRef.current = flat;
      editor.view.dispatch(editor.state.tr.setMeta('forceUpdateConsistency', true));
    };

    // Pulihkan garis bawah dari cache saat mount/aktif — pindah panel = gratis.
    refresh();

    const runCheck = async () => {
      if (cancelled || editor.isDestroyed) return;
      const para = editor.state.selection.$from.parent;
      const text = para && para.isTextblock ? para.textContent.trim() : '';
      if (text.length < MIN_PARAGRAPH || text === lastCheckedRef.current) return;
      lastCheckedRef.current = text;

      const map = getChapterMap(chapterId);
      // Cache hit (termasuk hasil kosong) → pulihkan tampilan tanpa token.
      if (map.has(text)) { refresh(); return; }

      const d = dataRef.current;
      cancelAI(ACTION_TYPE); // batalkan pemeriksaan paragraf sebelumnya yang masih jalan
      setChecking(true);
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
        map.set(text, mapped); // simpan (termasuk [] bila bersih) agar tak diperiksa ulang
        refresh();
      } catch {
        // AbortError/koneksi: diam — jangan ganggu alur menulis. Jangan cache
        // kegagalan; reset penanda agar paragraf ini bisa diperiksa ulang nanti.
        lastCheckedRef.current = '';
      } finally {
        if (!cancelled) setChecking(false);
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
  }, [editor, enabled, chapterId, quoteFindingsRef]);

  return checking && enabled;
}
