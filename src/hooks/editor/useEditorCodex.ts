import { useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { CodexEntry } from '../../types';

export function useEditorCodexSync(editor: Editor | null, codexEntries: CodexEntry[]) {
  // Force update Codex when entries change
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.view.dispatch(editor.state.tr.setMeta('forceUpdateCodex', true));
    }
  }, [codexEntries, editor]);
}
