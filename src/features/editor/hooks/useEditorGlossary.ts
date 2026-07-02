import { useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db';
import { InlineGlossaryFinding } from '@/src/lib/inlineConsistency';
import { findGlossaryIssues } from '@/src/lib/glossary';

const ENABLED_KEY = 'glossary_check';
const DEBOUNCE_MS = 800;

/** Default AKTIF: fitur nol-token/gratis. */
function isEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) !== 'false'; } catch { return true; }
}

/**
 * Glosarium inline (#8) — menandai istilah in-world yang ejaannya tak baku
 * (varian yang dideklarasikan) atau kandidat salah-eja `term`. Deterministik,
 * nol token. Meniru `useEditorSpelling`: hitung dari (teks bab + glosarium proyek)
 * lalu dorong ke `findingsRef` + meta `forceUpdateConsistency` agar
 * `ConsistencyUnderline` menggambar garis bawah teal putus-putus.
 *
 * Toggle di menu "Tampilan" (localStorage `glossary_check`, reaksi via 'storage').
 */
export function useEditorGlossary(
  editor: Editor | null,
  findingsRef: React.MutableRefObject<InlineGlossaryFinding[]>,
  chapterId: number,
  projectId: number,
) {
  const [enabled, setEnabled] = useState<boolean>(isEnabled);
  const glossary = useLiveQuery(
    () => (projectId ? db.glossary.where('projectId').equals(projectId).toArray() : Promise.resolve([])),
    [projectId],
  );
  const glossaryRef = useRef(glossary ?? []);
  glossaryRef.current = glossary ?? [];

  useEffect(() => {
    const onStorage = () => setEnabled(isEnabled());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const recompute = () => {
      if (editor.isDestroyed) return;
      if (!enabled || glossaryRef.current.length === 0) {
        if (findingsRef.current.length) {
          findingsRef.current = [];
          editor.view.dispatch(editor.state.tr.setMeta('forceUpdateConsistency', true));
        }
        return;
      }
      const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', ' ');
      findingsRef.current = findGlossaryIssues(text, glossaryRef.current);
      editor.view.dispatch(editor.state.tr.setMeta('forceUpdateConsistency', true));
    };

    // Hitung langsung, lalu sekali lagi begitu konten benar-benar masuk (reload async).
    recompute();
    let done = false;
    const onTx = () => {
      if (done || editor.isDestroyed) return;
      if (editor.state.doc.content.size > 2) {
        done = true;
        editor.off('transaction', onTx);
        Promise.resolve().then(() => { if (!editor.isDestroyed) recompute(); });
      }
    };
    editor.on('transaction', onTx);

    let timer: any = null;
    const onUpdate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(recompute, DEBOUNCE_MS);
    };
    editor.on('update', onUpdate);

    return () => {
      editor.off('transaction', onTx);
      editor.off('update', onUpdate);
      if (timer) clearTimeout(timer);
    };
  }, [editor, enabled, chapterId, glossary, findingsRef]);
}
