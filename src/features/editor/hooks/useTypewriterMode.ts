import { useEffect } from 'react';
import { Editor } from '@tiptap/react';

export function useTypewriterMode(
  editor: Editor | null,
  isTypewriterMode: boolean,
  containerRef: React.RefObject<HTMLDivElement | null>,
  onClosePopup: () => void
) {
  // Set padding top/bottom based on whether typewriter mode is active
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

  // Handle auto-scrolling to keep cursor centered
  useEffect(() => {
    if (!editor) return;

    const scrollToCursor = () => {
      if (!isTypewriterMode || !containerRef.current) return;

      const { view } = editor;
      const { selection } = view.state;

      // Wrap in requestAnimationFrame to wait for TipTap DOM layout to fully stabilize post-update.
      // This ensures we always get the precise, up-to-date coordinates of the cursor.
      requestAnimationFrame(() => {
        if (!editor || !containerRef.current || !editor.view) return;

        try {
          const coords = view.coordsAtPos(selection.from);
          if (coords.top === 0 && coords.bottom === 0) return; // Guard for unrendered state

          const containerRect = containerRef.current.getBoundingClientRect();
          const relativeTop = coords.top - containerRect.top + containerRef.current.scrollTop;
          const cursorHeight = coords.bottom - coords.top;

          // Align the exact vertical center of the active typing line to the vertical center of the viewport
          const targetScroll = relativeTop - (containerRef.current.clientHeight / 2) + (cursorHeight / 2);

          // Use 'auto' instead of 'smooth' to make sure real-time typing does not lag or jitter.
          // This keeps the typewriter line perfectly locked to the screen vertically.
          containerRef.current.scrollTo({ top: targetScroll, behavior: 'auto' });
        } catch (e) {
          // Off-screen or edge cases guard
        }
      });
    };

    const handleUpdate = () => {
      onClosePopup(); // e.g., setActiveCodexPopup(null)
      scrollToCursor();
    };

    // Scroll instantly if typewriter mode has just been turned on
    if (isTypewriterMode) {
      scrollToCursor();
    }

    editor.on('selectionUpdate', handleUpdate);
    editor.on('update', handleUpdate);

    return () => {
      editor.off('selectionUpdate', handleUpdate);
      editor.off('update', handleUpdate);
    };
  }, [editor, isTypewriterMode, containerRef, onClosePopup]);
}

