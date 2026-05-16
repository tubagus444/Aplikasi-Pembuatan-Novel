import { useState, useCallback, useEffect } from 'react';
import { Editor } from '@tiptap/react';

export function useEditorSearch(editor: Editor | null) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const [searchStats, setSearchStats] = useState({ current: 0, total: 0 });

  // Update search extension when query changes
  useEffect(() => {
    if (!editor || !searchQuery) {
        setSearchStats({ current: 0, total: 0 });
        return;
    }

    editor.commands.setSearchTerm(searchQuery);
    editor.commands.setCaseSensitive(isCaseSensitive);
    editor.commands.setRegex(isRegex);
    
    // Trigger decoration update
    editor.view.dispatch(editor.state.tr.setMeta('searchAndReplace', true));
    
    const results = (editor.storage as any).searchAndReplace?.results || [];
    setSearchStats({
        current: ((editor.storage as any).searchAndReplace?.currentIndex || 0) + 1,
        total: results.length
    });
  }, [editor, searchQuery, isCaseSensitive, isRegex]);

  useEffect(() => {
    if (!editor) return;
    editor.commands.setReplaceTerm(replaceQuery);
  }, [editor, replaceQuery]);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    if (editor) {
        editor.commands.setSearchTerm('');
        editor.view.dispatch(editor.state.tr.setMeta('searchAndReplace', true));
        editor.commands.focus();
    }
  }, [editor]);

  const handleReplace = useCallback(() => {
    if (!editor) return;
    editor.commands.replace();
    // Update stats after replace
    setTimeout(() => {
      const results = (editor.storage as any).searchAndReplace?.results || [];
      setSearchStats({
          current: ((editor.storage as any).searchAndReplace?.currentIndex || 0) + 1,
          total: results.length
      });
    }, 0);
  }, [editor]);

  const handleReplaceAll = useCallback(() => {
    if (!editor) return;
    editor.commands.replaceAll();
    setSearchStats({ current: 0, total: 0 });
  }, [editor]);

  const handleNext = useCallback(() => {
    if (!editor) return;
    editor.commands.nextSearchResult();
    const results = (editor.storage as any).searchAndReplace?.results || [];
    setSearchStats({
        current: ((editor.storage as any).searchAndReplace?.currentIndex || 0) + 1,
        total: results.length
    });
  }, [editor]);

  const handlePrev = useCallback(() => {
    if (!editor) return;
    editor.commands.previousSearchResult();
    const results = (editor.storage as any).searchAndReplace?.results || [];
    setSearchStats({
        current: ((editor.storage as any).searchAndReplace?.currentIndex || 0) + 1,
        total: results.length
    });
  }, [editor]);

  return {
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    setSearchQuery,
    replaceQuery,
    setReplaceQuery,
    isCaseSensitive,
    setIsCaseSensitive,
    isRegex,
    setIsRegex,
    searchStats,
    openSearch,
    closeSearch,
    handleReplace,
    handleReplaceAll,
    handleNext,
    handlePrev
  };
}
