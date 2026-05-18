import { useEffect } from 'react';
import { Editor } from '@tiptap/react';

export function useTypewriterMode(
  editor: Editor | null,
  isTypewriterMode: boolean,
  containerRef: React.RefObject<HTMLDivElement | null>,
  onClosePopup: () => void
) {
  useEffect(() => {
    if (editor) {
      if (isTypewriterMode) {
        editor.view.dom.style.paddingTop = '40vh';
        editor.view.dom.style.paddingBottom = '40vh';
      } else {
        editor.view.dom.style.paddingTop = '0';
        editor.view.dom.style.paddingBottom = '48px';
      }
    }
  }, [editor, isTypewriterMode]);

  useEffect(() => {
    if (!editor) return;
    const handleUpdate = () => {
      onClosePopup(); // e.g. setActiveCodexPopup(null)
      if (isTypewriterMode && containerRef.current) {
        const { view } = editor;
        const { selection } = view.state;
        try {
          const coords = view.coordsAtPos(selection.from);
          const containerRect = containerRef.current.getBoundingClientRect();
          const relativeTop = coords.top - containerRect.top + containerRef.current.scrollTop;
          const targetScroll = relativeTop - containerRef.current.clientHeight / 2;
          containerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
        } catch(e) {}
      }
    };
    editor.on('selectionUpdate', handleUpdate);
    editor.on('update', handleUpdate);
    return () => {
      editor.off('selectionUpdate', handleUpdate);
      editor.off('update', handleUpdate);
    }
  }, [editor, isTypewriterMode, containerRef, onClosePopup]);
}
