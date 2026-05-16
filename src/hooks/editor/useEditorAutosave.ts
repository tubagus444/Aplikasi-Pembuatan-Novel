import { useState, useRef, useCallback, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { db } from '../../db';
import { useEditorPanel } from '@/src/contexts/EditorPanelContext';

interface UseEditorAutosaveProps {
  chapterId: number;
  chapter: any;
  editor: Editor | null;
}

export function useEditorAutosave({ chapterId, chapter, editor }: UseEditorAutosaveProps) {
  const { setSaveStatus } = useEditorPanel();
  const [title, setTitle] = useState('');
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chapterIdRef = useRef(chapterId);
  const isMountedRef = useRef(true);
  const skipNextUpdateRef = useRef(false);

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
        const html = editor?.getHTML();
        if (html && chapterIdRef.current) {
          performSave(chapterIdRef.current, html);
        }
      }
    };
  }, [editor, performSave]);

  // Sync title and content when chapter changes
  useEffect(() => {
    if (chapter && editor) {
      const oldId = chapterIdRef.current;
      const newId = chapter.id;

      if (oldId !== newId) {
        // 1. Force save pending changes for old chapter
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          performSave(oldId, editor.getHTML());
        }

        // 2. Officially switch to new chapter
        chapterIdRef.current = newId;

        // 3. Update editor content
        skipNextUpdateRef.current = true;
        editor.commands.setContent(chapter.content);
        if ((editor.commands as any).clearHistory) {
          (editor.commands as any).clearHistory();
        }
        
        if (title !== chapter.title) {
          setTitle(chapter.title);
        }
      } else if (editor.isEmpty && chapter.content) {
        // Initial load for the same chapter (e.g. refresh or first load)
        skipNextUpdateRef.current = true;
        editor.commands.setContent(chapter.content);
        if (title !== chapter.title) {
          setTitle(chapter.title);
        }
      }
    }
  }, [chapter?.id, editor, performSave]);

  const onEditorUpdate = useCallback(({ editor: currentEditor }: { editor: Editor }) => {
    if (skipNextUpdateRef.current) {
      skipNextUpdateRef.current = false;
      return;
    }
    
    const html = currentEditor.getHTML();
    const idToSave = chapterIdRef.current;
    
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('Menyimpan...');
    
    saveTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        performSave(idToSave, html);
        saveTimeoutRef.current = null;
      }
    }, 1000);
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
