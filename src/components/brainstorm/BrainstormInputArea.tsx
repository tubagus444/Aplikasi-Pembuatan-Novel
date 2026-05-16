import React, { useState, useRef, useEffect } from 'react';
import { Send, Plus, X, ChevronDown, BookOpen, Check } from 'lucide-react';
import { db } from '../../db';
import { Chapter, CodexEntry, StoryBibleRule } from '../../types';
import { cn } from '../../lib/utils';
import { MentionDropdown } from '../common/MentionDropdown';

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
  const [loreSearchQuery, setLoreSearchQuery] = useState('');
  const loreMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [showChapterMenu, setShowChapterMenu] = useState(false);
  const chapterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (loreMenuRef.current && !loreMenuRef.current.contains(event.target as Node)) {
        setShowLoreMenu(false);
      }
      if (chapterMenuRef.current && !chapterMenuRef.current.contains(event.target as Node)) {
        setShowChapterMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredRules = bibleRules?.filter(rule => 
    rule.key.toLowerCase().includes(loreSearchQuery.toLowerCase()) || 
    rule.instruction.toLowerCase().includes(loreSearchQuery.toLowerCase())
  );

  const filteredCodex = codexEntries?.filter(entry => 
    entry.name.toLowerCase().includes(loreSearchQuery.toLowerCase()) || 
    entry.description.toLowerCase().includes(loreSearchQuery.toLowerCase())
  );

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
            <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-2 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lampirkan dari Lore</p>
              </div>
              <input
                type="search"
                autoFocus
                placeholder="Cari Lore..."
                value={loreSearchQuery}
                onChange={(e) => setLoreSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
              {(!filteredCodex?.length && !filteredRules?.length && !sessionChapterId) && (
                <p className="px-2 py-4 text-center text-[11px] text-slate-500 italic">Lore tidak ditemukan</p>
              )}
              {filteredRules?.map(rule => (
                <button
                  key={rule.id}
                  onClick={() => {
                    setInput(prev => prev + (prev ? ' ' : '') + `@rule:${rule.key} `);
                    setShowLoreMenu(false);
                    setLoreSearchQuery('');
                    inputRef.current?.focus();
                  }}
                  className="w-full px-2 py-1.5 text-left text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors flex flex-col gap-0.5"
                >
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">#{rule.key}</span>
                  <span className="opacity-60 truncate">{rule.instruction}</span>
                </button>
              ))}
              {filteredCodex?.map(entry => (
                  <button
                  key={entry.id}
                  onClick={() => {
                    setInput(prev => prev + (prev ? ' ' : '') + `@codex:${entry.name} `);
                    setShowLoreMenu(false);
                    setLoreSearchQuery('');
                    inputRef.current?.focus();
                  }}
                  className="w-full px-2 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors flex flex-col gap-0.5"
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100">{entry.name}</span>
                  <span className="opacity-60 truncate">{entry.description.substring(0, 40)}...</span>
                </button>
              ))}
              {sessionChapterId && !loreSearchQuery && (
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
                <div 
                  className="relative group max-w-[200px]"
                  ref={chapterMenuRef}
                >
                  <button
                    type="button"
                    onClick={() => setShowChapterMenu(!showChapterMenu)}
                    className={cn(
                      "flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 rounded-lg shadow-sm px-2.5 py-1.5 transition-all text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-full",
                      showChapterMenu && "border-indigo-300 dark:border-indigo-500 ring-2 ring-indigo-500/20"
                    )}
                  >
                    <BookOpen size={14} className={cn("shrink-0 transition-colors", showChapterMenu ? "text-indigo-500" : "text-slate-400 group-hover:text-indigo-500")} />
                    <span className="truncate text-slate-700 dark:text-slate-300 font-medium">
                      {sessionChapterId ? chapters?.find(c => c.id === sessionChapterId)?.title || 'Untitled Chapter' : 'Umum (Seluruh Cerita)'}
                    </span>
                    <ChevronDown size={14} className={cn("shrink-0 transition-all opacity-70", showChapterMenu ? "text-indigo-500 rotate-180" : "text-slate-400 group-hover:text-indigo-500")} />
                  </button>

                  {showChapterMenu && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-black/5 dark:ring-white/10">
                      <div className="max-h-56 overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-0.5">
                        <button
                          onClick={() => {
                            if (activeSessionId) db.chatSessions.update(activeSessionId, { activeChapterId: undefined });
                            setShowChapterMenu(false);
                          }}
                          className={cn(
                            "w-full flex justify-between items-center px-3 py-2 text-left text-xs rounded-lg transition-all",
                            !sessionChapterId 
                              ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                          )}
                        >
                          Umum (Seluruh Cerita)
                          {!sessionChapterId && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
                        </button>
                        
                        {chapters && chapters.length > 0 && (
                          <div className="px-3 py-1.5 mt-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">Chapters</div>
                        )}
                        {chapters?.map(c => (
                          <button
                            key={c.id}
                            onClick={() => {
                              if (activeSessionId) db.chatSessions.update(activeSessionId, { activeChapterId: c.id });
                              setShowChapterMenu(false);
                            }}
                            className={cn(
                              "w-full flex justify-between items-center px-3 py-2 text-left text-xs rounded-lg transition-all group",
                              sessionChapterId === c.id
                                ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold"
                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                            )}
                          >
                            <span className="truncate pr-2">{c.title || 'Untitled Chapter'}</span>
                            {sessionChapterId === c.id && <Check size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

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
