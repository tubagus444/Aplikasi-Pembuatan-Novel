import { useCallback, useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { CodexEntry, StoryBibleRule, Relationship } from '@/src/types';
import { InlineQuoteFinding } from '@/src/lib/inlineConsistency';
import { checkConsistency, cancelAI } from '@/src/services/ai';

const ENABLED_KEY = 'ai_inline_consistency';
const ACTION_TYPE = 'consistency-inline';
const IDLE_MS = 2500;       // jeda berhenti mengetik sebelum cek OTOMATIS
const MIN_PARAGRAPH = 40;   // paragraf terlalu pendek → lewati di mode otomatis

interface AIConsistencyData {
  chapterTitle?: string;
  codexEntries: CodexEntry[];
  bibleRules: StoryBibleRule[];
  relationships: Relationship[];
}

export interface InlineAIConsistency {
  /** true selagi AI memeriksa — untuk indikator di editor. */
  checking: boolean;
  /**
   * Cek MANUAL paragraf di posisi seleksi (dipakai tombol floating menu).
   * Mengembalikan jumlah temuan (≥0), atau -1 bila tak ada teks untuk diperiksa.
   * Melempar bila pemanggilan AI gagal.
   */
  checkAtSelection: () => Promise<number>;
}

/**
 * Cache hasil per-paragraf di level MODUL — bertahan saat editor di-unmount
 * (pindah panel) sehingga garis bawah dipulihkan tanpa memanggil AI lagi, dan
 * paragraf yang isinya tak berubah tak diperiksa ulang (nol token). Entri kosong
 * tetap disimpan. Reset saat refresh penuh. Diisi oleh cek otomatis MAUPUN manual.
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
 * Lapisan AI OPSIONAL untuk konsistensi inline (Fase 2). Memeriksa paragraf
 * terhadap Codex/Bible via checkConsistency, lalu menggarisbawahi kutipan
 * kontradiktif (ungu). Dua pemicu:
 *   • MANUAL (utama) — tombol "Cek Konsistensi" di floating menu (checkAtSelection).
 *     Selalu tersedia, hanya pakai token saat diklik.
 *   • OTOMATIS (opsional) — toggle Settings (default mati): cek paragraf aktif
 *     setelah idle saat menulis.
 * Hasil di-cache lintas remount; garis bawah selalu mencerminkan cache.
 */
export function useEditorAIConsistency(
  editor: Editor | null,
  quoteFindingsRef: React.MutableRefObject<InlineQuoteFinding[]>,
  chapterId: number,
  data: AIConsistencyData,
): InlineAIConsistency {
  const dataRef = useRef(data);
  dataRef.current = data;
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const chapterIdRef = useRef(chapterId);
  chapterIdRef.current = chapterId;

  const [enabled, setEnabled] = useState<boolean>(isEnabled);
  const [checking, setChecking] = useState(false);

  // Toggle disimpan di Settings; reaksi lewat event 'storage'.
  useEffect(() => {
    const onStorage = () => setEnabled(isEnabled());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /**
   * Susun ulang quoteFindingsRef dari cache: gabungkan temuan semua paragraf yang
   * MASIH ADA di dokumen (otomatis membuang temuan paragraf yang sudah diedit/hilang),
   * lalu picu render garis bawah. Tanpa memanggil AI.
   */
  const refresh = useCallback(() => {
    const ed = editorRef.current;
    if (!ed || ed.isDestroyed) return;
    const map = chapterCache.get(chapterIdRef.current);
    const flat: InlineQuoteFinding[] = [];
    if (map && map.size) {
      const present = new Set<string>();
      ed.state.doc.descendants(node => {
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
    ed.view.dispatch(ed.state.tr.setMeta('forceUpdateConsistency', true));
  }, [quoteFindingsRef]);

  /** Periksa satu potongan teks (cache-aware). Mengembalikan jumlah temuan. */
  const performCheck = useCallback(async (text: string): Promise<number> => {
    const ed = editorRef.current;
    if (!ed || ed.isDestroyed || !text) return -1;
    const map = getChapterMap(chapterIdRef.current);
    if (map.has(text)) { refresh(); return map.get(text)!.length; } // cache hit → nol token

    const d = dataRef.current;
    cancelAI(ACTION_TYPE); // batalkan pemeriksaan sebelumnya yang masih jalan
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
      const lower = text.toLowerCase();
      const mapped: InlineQuoteFinding[] = findings
        // Buang kutipan yang tak benar-benar ada di teks (anti-halusinasi).
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
      map.set(text, mapped); // simpan (termasuk []) agar tak diperiksa ulang
      refresh();
      return mapped.length;
    } finally {
      if (!editorRef.current?.isDestroyed) setChecking(false);
    }
  }, [refresh]);

  // Pulihkan garis bawah dari cache setiap editor/bab termuat — pindah panel = gratis.
  useEffect(() => {
    if (editor && !editor.isDestroyed) refresh();
  }, [editor, chapterId, refresh]);

  // Mode OTOMATIS (opsional): cek paragraf aktif setelah idle saat menulis.
  useEffect(() => {
    if (!editor || !enabled) return;
    let timer: any = null;
    let lastChecked = '';

    const runAuto = () => {
      if (editor.isDestroyed) return;
      const para = editor.state.selection.$from.parent;
      const text = para && para.isTextblock ? para.textContent.trim() : '';
      if (text.length < MIN_PARAGRAPH || text === lastChecked) return;
      lastChecked = text;
      performCheck(text).catch(() => { lastChecked = ''; });
    };

    const onUpdate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(runAuto, IDLE_MS);
    };

    editor.on('update', onUpdate);
    return () => {
      if (timer) clearTimeout(timer);
      editor.off('update', onUpdate);
      cancelAI(ACTION_TYPE);
    };
  }, [editor, enabled, chapterId, performCheck]);

  // Cek MANUAL: paragraf di posisi seleksi.
  const checkAtSelection = useCallback(async (): Promise<number> => {
    const ed = editorRef.current;
    if (!ed || ed.isDestroyed) return -1;
    const para = ed.state.selection.$from.parent;
    const text = para && para.isTextblock ? para.textContent.trim() : '';
    if (!text) return -1;
    return performCheck(text);
  }, [performCheck]);

  return { checking, checkAtSelection };
}
