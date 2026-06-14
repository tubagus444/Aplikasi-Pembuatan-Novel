import { useState, useRef, useCallback, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { db } from '@/src/db';
import { useEditorPanel } from '@/src/contexts/EditorPanelContext';

interface UseEditorSaveProps {
  chapterId: number;
  chapter: any;
  editor: Editor | null;
}

export function useEditorSave({ chapterId, chapter, editor }: UseEditorSaveProps) {
  const { setSaveStatus } = useEditorPanel();
  const [title, setTitle] = useState('');
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chapterIdRef = useRef(chapterId);
  const isMountedRef = useRef(true);
  const htmlRef = useRef(editor?.getHTML() || "");

  const performSave = useCallback((id: number, content: string) => {
    if (!id || id <= 0) return Promise.resolve();
    if (!isMountedRef.current) {
      // Just do the update without state changes if unmounted
      return db.chapters.update(id, { content, lastModified: Date.now() });
    }

    setSaveStatus('Menyimpan...');
    return db.chapters.update(id, { content, lastModified: Date.now() }).then(() => {
      if (isMountedRef.current) {
        setSaveStatus('Tersimpan');
        setTimeout(() => {
          if (isMountedRef.current) setSaveStatus('');
        }, 2000);
      }
    }).catch(err => {
      console.error('Failed to save chapter:', err);
      if (isMountedRef.current) setSaveStatus('Gagal menyimpan');
    });
  }, [setSaveStatus]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Final cleanup on unmount
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        const html = htmlRef.current;
        if (html && chapterIdRef.current) {
          performSave(chapterIdRef.current, html);
        }
      }
    };
  }, [editor, performSave]);

  useEffect(() => {
    if (chapterIdRef.current !== chapterId) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        performSave(chapterIdRef.current, htmlRef.current);
        saveTimeoutRef.current = null;
      }
      chapterIdRef.current = chapterId;
    }
  }, [chapterId, performSave]);

  // Sync title when chapter loads
  useEffect(() => {
    if (chapter) {
      if (title !== chapter.title) {
        setTitle(chapter.title);
      }
    }
  }, [chapter?.title]); // Only dependency needed is title, not content

  const onEditorUpdate = useCallback(({ editor: currentEditor }: { editor: Editor }) => {
    const idToSave = chapterIdRef.current;

    // Tangkap konten terkini SEGERA (bukan di dalam timeout) agar flush saat ganti
    // bab / unmount selalu menyimpan teks terbaru, bukan snapshot lama. Mencegah
    // kehilangan edit terakhir bila user pindah bab/keluar < 1.5s setelah mengetik.
    htmlRef.current = currentEditor.getHTML();

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('Menyimpan...');

    saveTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        performSave(idToSave, htmlRef.current);
        saveTimeoutRef.current = null;
      }
    }, 1500);
  }, [setSaveStatus, performSave]);

  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    db.chapters.update(chapterIdRef.current, { title: newTitle });
  }, []);

  return {
    title,
    handleTitleChange,
    onEditorUpdate,
  };
}
