import { useState, useCallback, useEffect } from 'react';
import { Editor } from '@tiptap/react';

export function useEditorSearch(editor: Editor | null) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const [isSemanticMode, setIsSemanticMode] = useState(false);
  const [searchStats, setSearchStats] = useState({ current: 0, total: 0 });

  // Update search extension when query changes
  useEffect(() => {
    if (!editor) return;

    if (!searchQuery) {
        setSearchStats({ current: 0, total: 0 });
        editor.commands.setSearchTerm('');
        if (editor.commands.clearSemanticPhrases) {
           editor.commands.clearSemanticPhrases();
        }
        return;
    }

    if (isSemanticMode) {
      // Clear strict search
      editor.commands.setSearchTerm('');
      
      // Mock semantic logic - in a real app this queries the vector DB
      // We will pretend we found phrases in the document similar to the search query
      const docText = editor.getText();
      const mockPhrases = docText.split(/\s+/).filter(word => 
         word.length > 4 && 
         (searchQuery.toLowerCase().includes(word.toLowerCase().substring(0,3)) || 
          word.toLowerCase().includes(searchQuery.toLowerCase().substring(0,3)))
      ).slice(0, 5).map(text => ({ text, confidence: Math.max(0.4, Math.random()) }));

      if (editor.commands.setSemanticPhrases) {
         editor.commands.setSemanticPhrases(mockPhrases);
      }
      setSearchStats({ current: mockPhrases.length, total: mockPhrases.length });
      
    } else {
      if (editor.commands.clearSemanticPhrases) {
         editor.commands.clearSemanticPhrases();
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
    }
  }, [editor, searchQuery, isCaseSensitive, isRegex, isSemanticMode]);

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
        if (editor.commands.clearSemanticPhrases) editor.commands.clearSemanticPhrases();
        editor.view.dispatch(editor.state.tr.setMeta('searchAndReplace', true));
        editor.commands.focus();
    }
  }, [editor]);

  const handleReplace = useCallback(() => {
    if (!editor || isSemanticMode) return;
    editor.commands.replace();
    // Update stats after replace
    setTimeout(() => {
      const results = (editor.storage as any).searchAndReplace?.results || [];
      setSearchStats({
          current: ((editor.storage as any).searchAndReplace?.currentIndex || 0) + 1,
          total: results.length
      });
    }, 0);
  }, [editor, isSemanticMode]);

  const handleReplaceAll = useCallback(() => {
    if (!editor || isSemanticMode) return;
    editor.commands.replaceAll();
    setSearchStats({ current: 0, total: 0 });
  }, [editor, isSemanticMode]);

  const handleNext = useCallback(() => {
    if (!editor || isSemanticMode) return;
    editor.commands.nextSearchResult();
    const results = (editor.storage as any).searchAndReplace?.results || [];
    setSearchStats({
        current: ((editor.storage as any).searchAndReplace?.currentIndex || 0) + 1,
        total: results.length
    });
  }, [editor, isSemanticMode]);

  const handlePrev = useCallback(() => {
    if (!editor || isSemanticMode) return;
    editor.commands.previousSearchResult();
    const results = (editor.storage as any).searchAndReplace?.results || [];
    setSearchStats({
        current: ((editor.storage as any).searchAndReplace?.currentIndex || 0) + 1,
        total: results.length
    });
  }, [editor, isSemanticMode]);

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
    isSemanticMode,
    setIsSemanticMode,
    searchStats,
    openSearch,
    closeSearch,
    handleReplace,
    handleReplaceAll,
    handleNext,
    handlePrev
  };
}
