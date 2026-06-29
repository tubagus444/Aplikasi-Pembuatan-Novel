import { useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { CodexEntry, TimelineEvent } from '@/src/types';
import { flagCharactersForChapter, InlineChapterRef, InlineConsistencyFlag } from '@/src/lib/inlineConsistency';

function flagsEqual(a: Map<number, InlineConsistencyFlag>, b: Map<number, InlineConsistencyFlag>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    const w = b.get(k);
    if (!w || w.severity !== v.severity || w.message !== v.message) return false;
  }
  return true;
}

/**
 * Hitung ulang tanda konsistensi inline (deterministik) untuk bab aktif dan
 * dorong ke extension lewat ref + meta `forceUpdateConsistency`. Perhitungan
 * ringan (hanya urutan/timeline), jadi boleh sering jalan; dispatch ke editor
 * hanya saat hasilnya benar-benar berubah agar tak ada churn highlight.
 */
export function useEditorConsistency(
  editor: Editor | null,
  flagsRef: React.MutableRefObject<Map<number, InlineConsistencyFlag>>,
  chapterId: number,
  chapters: InlineChapterRef[],
  codexEntries: CodexEntry[],
  timeline: TimelineEvent[],
) {
  useEffect(() => {
    const flags = flagCharactersForChapter(chapterId, chapters, codexEntries, timeline);
    const changed = !flagsEqual(flags, flagsRef.current);
    flagsRef.current = flags;
    if (changed && editor && !editor.isDestroyed) {
      editor.view.dispatch(editor.state.tr.setMeta('forceUpdateConsistency', true));
    }
  }, [editor, chapterId, chapters, codexEntries, timeline, flagsRef]);
}
