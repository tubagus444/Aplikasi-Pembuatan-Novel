/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { User, Book, Hash } from 'lucide-react';

interface SuggestionItem {
  id: string;
  name: string;
  type: 'codex' | 'rule';
  category?: string;
  description?: string;
}

interface MentionDropdownProps {
  suggestions: SuggestionItem[];
  onSelect: (item: SuggestionItem) => void;
  onClose: () => void;
}

export function MentionDropdown({ suggestions, onSelect, onClose }: MentionDropdownProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          onSelect(suggestions[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [suggestions, selectedIndex, onSelect, onClose]);

  if (suggestions.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mention Lore or rule</p>
      </div>
      <div className="max-h-60 overflow-y-auto p-1.5 custom-scrollbar">
        {suggestions.map((item, index) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className={cn(
              "w-full px-3 py-2 text-left rounded-lg transition-all flex items-start gap-3",
              index === selectedIndex 
                ? "bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-800" 
                : "hover:bg-slate-50 dark:hover:bg-slate-800"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-md shrink-0",
              item.type === 'rule' 
                ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400" 
                : "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400"
            )}>
              {item.type === 'rule' ? <Hash size={14} /> : (item.category === 'character' ? <User size={14} /> : <Book size={14} />)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                  {item.name}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                  {item.category || item.type}
                </span>
              </div>
              {item.description && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {item.description}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
