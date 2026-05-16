import React, { useState, useRef, useEffect } from 'react';
import { Send, Plus, X } from 'lucide-react';
import { db } from '../../db';
import { Chapter, CodexEntry, StoryBibleRule } from '../../types';
import { cn } from '../../lib/utils';
import { MentionDropdown } from '../MentionDropdown';

interface BrainstormInputAreaProps {
  activeSessionId: number;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isLoading: boolean;
  handleSend: () => void;
  // Context & Metadata
  sessionChapterId: number | undefined;
  chapters: Chapter[] | undefined;
  sceneMetadata: any;
  chapterContext: string;
  setSceneMetadata: (data: any) => void;
  setChapterContext: (context: string) => void;
  // Lore Data
  codexEntries: CodexEntry[] | undefined;
  bibleRules: StoryBibleRule[] | undefined;
  sessionChapter: Chapter | undefined;
  // Mention Props
  isMentionOpen: boolean;
  setIsMentionOpen: (open: boolean) => void;
  mentionSuggestions: any[];
  mentionSelectedIndex: number;
  handleMentionInputChange: (val: string, cursorPosition: number) => void;
  handleMentionKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, val: string, setVal: (v: string) => void) => boolean;
  selectMention: (item: any, currentInput: string) => string;
}

export function BrainstormInputArea({
  activeSessionId,
  input,
  setInput,
  isLoading,
  handleSend,
  sessionChapterId,
  chapters,
  sceneMetadata,
  chapterContext,
  setSceneMetadata,
  setChapterContext,
  codexEntries,
  bibleRules,
  sessionChapter,
  isMentionOpen,
  setIsMentionOpen,
  mentionSuggestions,
  mentionSelectedIndex,
  handleMentionInputChange,
  handleMentionKeyDown,
  selectMention
}: BrainstormInputAreaProps) {
  const [showLoreMenu, setShowLoreMenu] = useState(false);
  const loreMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (loreMenuRef.current && !loreMenuRef.current.contains(event.target as Node)) {
        setShowLoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="p-6 bg-transparent">
      <div className="max-w-3xl mx-auto relative group" ref={loreMenuRef}>
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-10 group-focus-within:opacity-25 transition-all duration-500" />
        
        {isMentionOpen && mentionSuggestions.length > 0 && (
          <MentionDropdown 
            suggestions={mentionSuggestions}
            selectedIndex={mentionSelectedIndex}
            onSelect={(item) => {
              const newValue = selectMention(item, input);
              setInput(newValue);
              setIsMentionOpen(false);
              inputRef.current?.focus();
            }}
            onClose={() => setIsMentionOpen(false)}
          />
        )}

        {showLoreMenu && (
          <div className="absolute left-6 bottom-full mb-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-bottom-2 duration-100">
            <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lampirkan dari Lore</p>
            </div>
            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
              {(!codexEntries?.length && !bibleRules?.length) && (
                <p className="px-2 py-4 text-center text-[11px] text-slate-500 italic">Lore masih kosong</p>
              )}
              {bibleRules?.map(rule => (
                <button
                  key={rule.id}
                  onClick={() => {
                    setInput(prev => prev + (prev ? ' ' : '') + `@rule:${rule.key} `);
                    setShowLoreMenu(false);
                    inputRef.current?.focus();
                  }}
                  className="w-full px-2 py-1.5 text-left text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors flex flex-col gap-0.5"
                >
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">#{rule.key}</span>
                  <span className="opacity-60 truncate">{rule.instruction}</span>
                </button>
              ))}
              {codexEntries?.map(entry => (
                  <button
                  key={entry.id}
                  onClick={() => {
                    setInput(prev => prev + (prev ? ' ' : '') + `@codex:${entry.name} `);
                    setShowLoreMenu(false);
                    inputRef.current?.focus();
                  }}
                  className="w-full px-2 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors flex flex-col gap-0.5"
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100">{entry.name}</span>
                  <span className="opacity-60 truncate">{entry.description.substring(0, 40)}...</span>
                </button>
              ))}
              {sessionChapterId && (
                <>
                    <div className="px-2 py-1.5 border-t border-b border-slate-100 dark:border-slate-800 my-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Chapter</p>
                    </div>
                    <button
                      onClick={() => {
                        setInput(prev => prev + (prev ? ' ' : '') + `@chapter-excerpt `);
                        setShowLoreMenu(false);
                        inputRef.current?.focus();
                      }}
                      className="w-full px-2 py-1.5 text-left text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors flex flex-col gap-0.5 text-indigo-600 dark:text-indigo-400 font-medium"
                    >
                      @chapter-excerpt
                    </button>
                    {sessionChapter?.summary && (
                      <button
                        onClick={() => {
                          setInput(prev => prev + (prev ? ' ' : '') + `@chapter-summary `);
                          setShowLoreMenu(false);
                          inputRef.current?.focus();
                        }}
                        className="w-full px-2 py-1.5 text-left text-xs hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors flex flex-col gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium"
                      >
                        @chapter-summary
                      </button>
                    )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
          {/* Persistent Context Header */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 px-4 py-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <select 
                    value={sessionChapterId || ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (activeSessionId) {
                        db.chatSessions.update(activeSessionId, { activeChapterId: val ? Number(val) : undefined });
                      }
                    }}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300 font-medium  focus:ring-indigo-500 max-w-[200px]"
                >
                    <option value="">-- Umum (No Chapter) --</option>
                    {chapters?.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                </select>

                {sceneMetadata && chapterContext && (
                    <div className="flex items-center gap-2 ml-2 text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-1 rounded-md zoom-in-95 animate-in duration-200">
                      <span className="font-bold truncate max-w-[150px]">{sceneMetadata.name}</span>
                      <span className="opacity-70 whitespace-nowrap">· {sceneMetadata.wordCount} words</span>
                      <button 
                          onClick={() => {
                            setSceneMetadata(null);
                            setChapterContext('');
                            if (sceneMetadata.isManual) {
                              if (sceneMetadata.manualType === 'excerpt') {
                                setInput(prev => prev.replace('@chapter-excerpt', '').trim());
                              } else {
                                setInput(prev => prev.replace('@chapter-summary', '').trim());
                              }
                            } else if (activeSessionId) {
                              db.chatSessions.update(activeSessionId, { smartAutoEnabled: false });
                            }
                          }} 
                          className="hover:text-red-600 dark:hover:text-red-400 ml-1 transition-colors"
                          title="Lepas Konteks"
                      >
                          <X size={14}/>
                      </button>
                    </div>
                )}
              </div>
          </div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              const val = e.target.value;
              setInput(val);
              handleMentionInputChange(val, e.target.selectionStart ?? val.length);
            }}
            onKeyDown={e => {
              if (handleMentionKeyDown(e, input, (val) => setInput(val))) {
                return;
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Sampaikan ide liar Anda di sini..."
            className="w-full bg-transparent p-5 text-[15px] focus:outline-none resize-none min-h-[120px] dark:text-slate-200"
          />
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4 text-slate-400">
                <div className="relative">
                  <button 
                    onClick={() => setShowLoreMenu(!showLoreMenu)}
                    className={cn(
                      "hover:text-indigo-500 transition-all p-1 rounded-full",
                      showLoreMenu ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 scale-110" : ""
                    )}
                    title="Lampirkan Lore"
                  >
                    <Plus size={20} />
                  </button>
                </div>
            </div>
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:bg-slate-400 transition-all flex items-center gap-2"
            >
              Kirim Ide <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
