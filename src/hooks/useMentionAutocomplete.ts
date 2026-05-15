/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useMemo } from 'react';
import { CodexEntry, StoryBibleRule } from '../types';

interface SuggestionItem {
  id: string;
  name: string;
  type: 'codex' | 'rule';
  category?: string;
  description?: string;
}

export function useMentionAutocomplete(
  codexEntries: CodexEntry[] = [],
  bibleRules: StoryBibleRule[] = []
) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);

  const handleInputChange = useCallback((value: string, position: number) => {
    // Look for @ character before cursor
    const textBeforeCursor = value.substring(0, position);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);
      // Only trigger if @ is at start of line or preceded by space
      const charBeforeAt = textBeforeCursor[lastAtSymbol - 1];
      
      if (!charBeforeAt || /\s/.test(charBeforeAt)) {
        // If there's a space after @, close it
        if (/\s/.test(textAfterAt)) {
          setIsOpen(false);
          return;
        }

        setIsOpen(true);
        setQuery(textAfterAt);
        setCursorPosition(lastAtSymbol);
        return;
      }
    }

    setIsOpen(false);
  }, []);

  const suggestions = useMemo(() => {
    if (!isOpen) return [];

    const lowerQuery = query.toLowerCase();
    
    const codexSuggestions: SuggestionItem[] = codexEntries
      .filter(e => e.name.toLowerCase().includes(lowerQuery))
      .map(e => ({
        id: `codex:${e.name.replace(/\s+/g, '_')}`,
        name: e.name,
        type: 'codex',
        category: e.category,
        description: e.description
      }));

    const ruleSuggestions: SuggestionItem[] = bibleRules
      .filter(r => r.key.toLowerCase().includes(lowerQuery))
      .map(r => ({
        id: `rule:${r.key}`,
        name: r.key,
        type: 'rule',
        category: 'rule',
        description: r.instruction
      }));

    return [...ruleSuggestions, ...codexSuggestions].slice(0, 10);
  }, [isOpen, query, codexEntries, bibleRules]);

  const selectMention = useCallback((item: SuggestionItem, fullValue: string) => {
    const before = fullValue.substring(0, cursorPosition);
    const after = fullValue.substring(cursorPosition + 1 + query.length);
    
    const newValue = `${before}@${item.id} ${after}`;
    setIsOpen(false);
    return newValue;
  }, [cursorPosition, query]);

  return {
    isOpen,
    setIsOpen,
    suggestions,
    handleInputChange,
    selectMention,
    query
  };
}
