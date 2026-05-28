/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useMemo } from 'react';
import { CodexEntry, StoryBibleRule } from '@/src/types';

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
  const [selectedIndex, setSelectedIndex] = useState(0);

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
        setSelectedIndex(0); // Reset selection
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

    return [...ruleSuggestions, ...codexSuggestions].slice(0, 50);
  }, [isOpen, query, codexEntries, bibleRules]);

  const selectMention = useCallback((item: SuggestionItem, fullValue: string) => {
    const before = fullValue.substring(0, cursorPosition);
    const after = fullValue.substring(cursorPosition + 1 + query.length);
    
    const newValue = `${before}@${item.id} ${after}`;
    setIsOpen(false);
    return newValue;
  }, [cursorPosition, query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, fullValue: string, onSelected: (newValue: string) => void) => {
    if (!isOpen || suggestions.length === 0) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % suggestions.length);
      return true;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      return true;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = suggestions[selectedIndex];
      if (selected) {
        const newValue = selectMention(selected, fullValue);
        onSelected(newValue);
      }
      return true;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      return true;
    } else if (e.key === 'Tab') {
      // Also allow Tab for selection
      e.preventDefault();
      const selected = suggestions[selectedIndex];
      if (selected) {
        const newValue = selectMention(selected, fullValue);
        onSelected(newValue);
      }
      return true;
    }

    return false;
  }, [isOpen, suggestions, selectedIndex, selectMention]);

  return {
    isOpen,
    setIsOpen,
    suggestions,
    selectedIndex,
    setSelectedIndex,
    handleInputChange,
    handleKeyDown,
    selectMention,
    query
  };
}
