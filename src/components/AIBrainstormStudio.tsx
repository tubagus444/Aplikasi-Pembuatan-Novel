/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, Plus, Trash2, MessageSquare, BrainCircuit, History, ArrowLeft, MoreVertical, Search, Edit2, Check, X } from 'lucide-react';
import { db } from '../db';
import { processChat } from '../services/ai';
import { useLiveQuery } from 'dexie-react-hooks';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import { ChatSession, ChatMessage, CodexEntry, StoryBibleRule } from '../types';
import { useProject } from '../contexts/ProjectContext';
import { format } from 'date-fns';

export function AIBrainstormStudio() {
  const { projectId } = useProject();
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLoreMenu, setShowLoreMenu] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const loreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
      if (loreMenuRef.current && !loreMenuRef.current.contains(event.target as Node)) {
        setShowLoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sessions = useLiveQuery(() => 
    projectId ? db.chatSessions.where('projectId').equals(projectId).reverse().sortBy('lastMessageAt') : []
  , [projectId]);

  const activeSession = useLiveQuery(() => 
    activeSessionId ? db.chatSessions.get(activeSessionId) : undefined
  , [activeSessionId]);

  const codexEntries = useLiveQuery(() => 
    projectId ? db.codex.where('projectId').equals(projectId).toArray() : []
  , [projectId]);

  const bibleRules = useLiveQuery(() => 
    projectId ? db.bible.where('projectId').equals(projectId).toArray() : []
  , [projectId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isLoading]);

  const deleteSession = async (id: number, e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await db.chatSessions.delete(id);
      if (activeSessionId === id) {
        setActiveSessionId(null);
      }
      setConfirmDeleteId(null);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const handleRename = async () => {
    if (!activeSessionId || !editTitleValue.trim()) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await db.chatSessions.update(activeSessionId, { title: editTitleValue.trim() });
      setIsEditingTitle(false);
    } catch (error) {
      console.error('Failed to rename session:', error);
    }
  };

  const createSession = async () => {
    if (!projectId) return;
    const newId = await db.chatSessions.add({
      projectId,
      title: 'Percakapan Baru',
      lastMessageAt: Date.now(),
      messages: []
    });
    setActiveSessionId(newId);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !projectId) return;

    let sessionId = activeSessionId;
    let currentSession = activeSession;

    // Create session if none active
    if (!sessionId) {
      sessionId = await db.chatSessions.add({
        projectId,
        title: input.substring(0, 30).trim() || 'Percakapan Baru',
        lastMessageAt: Date.now(),
        messages: []
      });
      setActiveSessionId(sessionId);
      currentSession = await db.chatSessions.get(sessionId);
    }

    if (!currentSession) return;

    const userMsg: ChatMessage = { role: 'user', content: input, timestamp: Date.now() };
    const updatedMessages = [...currentSession.messages, userMsg];
    
    setInput('');
    setIsLoading(true);

    // Update title if it's the first message
    const newTitle = currentSession.messages.length === 0 ? input.substring(0, 40) + (input.length > 40 ? '...' : '') : currentSession.title;

    await db.chatSessions.update(sessionId, { 
      messages: updatedMessages,
      lastMessageAt: Date.now(),
      title: newTitle
    });

    try {
      const history = updatedMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const reply = await processChat({
        message: input,
        history,
        bibleRules: bibleRules || [],
        codexEntries: codexEntries || [],
        contextText: '', // Comprehensive brainstorm context could be added here
        provider: localStorage.getItem('ai_provider') || 'google'
      });

      const assistantMsg: ChatMessage = { role: 'model', content: reply, timestamp: Date.now() };
      
      await db.chatSessions.update(sessionId, { 
        messages: [...updatedMessages, assistantMsg],
        lastMessageAt: Date.now()
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSessions = sessions?.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900 overflow-hidden text-slate-900 dark:text-slate-100">
      {/* Sidebar: Sessions List */}
      <div className="w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 shrink-0">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BrainCircuit size={18} className="text-indigo-600" />
            AI Studio
          </h2>
          <button 
            onClick={createSession}
            className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md hover:bg-indigo-100 transition-colors"
            title="Percakapan Baru"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Cari percakapan..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg py-2 pl-9 pr-3 text-xs focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {filteredSessions?.map(session => {
            const isDeleting = false; // Placeholder for future state if needed
            return (
              <div
                key={session.id}
                onClick={() => setActiveSessionId(session.id || null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActiveSessionId(session.id || null);
                  }
                }}
                role="button"
                tabIndex={0}
                className={cn(
                  "w-full group flex items-start gap-3 p-3 rounded-xl transition-all text-left relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  activeSessionId === session.id 
                    ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  activeSessionId === session.id 
                    ? "bg-indigo-100 dark:bg-indigo-800/50" 
                    : "bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"
                )}>
                  <MessageSquare size={14} className="opacity-70" />
                </div>
                <div className="flex-1 min-w-0">
                  {isEditingTitle && activeSessionId === session.id ? (
                    <div className="flex items-center gap-1 pr-2">
                       <input 
                         autoFocus
                         value={editTitleValue}
                         onChange={e => setEditTitleValue(e.target.value)}
                         onKeyDown={e => {
                           if (e.key === 'Enter') handleRename();
                           if (e.key === 'Escape') setIsEditingTitle(false);
                         }}
                         onClick={e => e.stopPropagation()}
                         className="flex-1 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded px-1.5 py-0.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                       />
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleRename(); }}
                         className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                       >
                         <Check size={14} />
                       </button>
                    </div>
                  ) : (
                    <p className="text-sm font-medium truncate pr-8">{session.title}</p>
                  )}
                  <p className="text-[10px] opacity-60 mt-0.5">
                    {format(session.lastMessageAt, 'dd MMM, HH:mm')}
                  </p>
                </div>
                {confirmDeleteId === session.id ? (
                  <div className="absolute inset-0 bg-red-600 rounded-xl z-30 flex items-center justify-between px-4 animate-in fade-in slide-in-from-right-2 duration-200">
                    <p className="text-xs font-bold text-white">Hapus?</p>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                        className="p-1 text-white hover:bg-white/20 rounded-md transition-colors text-[10px] font-bold uppercase tracking-wider"
                      >
                        Batal
                      </button>
                      <button 
                        onClick={(e) => deleteSession(session.id!, e)}
                        className="px-2 py-1 bg-white text-red-600 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm"
                      >
                        Ya
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(session.id!); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 rounded-lg transition-all z-20"
                    title="Hapus"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
          {(!filteredSessions || filteredSessions.length === 0) && (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <History size={32} className="mb-2 opacity-20" />
              <p className="text-[11px] uppercase tracking-widest font-bold">Belum ada riwayat</p>
            </div>
          )}
        </div>
      </div>

      {/* Main: Chat View */}
      <div className="flex-1 flex flex-col relative">
        {!activeSessionId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center text-indigo-600 mb-6 motion-safe:animate-pulse">
              <BrainCircuit size={40} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">AI Brainstorming Studio</h1>
            <p className="max-w-md text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              Ruang kerja khusus untuk menyusun plot, mendalami lore, atau sekadar bertukar pikiran dengan asisten cerdas Anda yang terintegrasi dengan Story Bible & Codex.
            </p>
            <button 
              onClick={createSession}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
              <Plus size={20} /> Mulai Diskusi Baru
            </button>
          </div>
        ) : (
          <>
            <div className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setActiveSessionId(null)}
                  className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg lg:hidden"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="flex-1 min-w-0">
                  {isEditingTitle ? (
                    <div className="flex items-center gap-2">
                      <input 
                        autoFocus
                        value={editTitleValue}
                        onChange={e => setEditTitleValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRename();
                          if (e.key === 'Escape') setIsEditingTitle(false);
                        }}
                        className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-1 text-sm font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 w-full max-w-xs"
                      />
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={handleRename}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                          title="Simpan"
                        >
                          <Check size={18} />
                        </button>
                        <button 
                          onClick={() => setIsEditingTitle(false)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Batal"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 
                        className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-md cursor-pointer hover:text-indigo-600 transition-colors"
                        onClick={() => {
                          setEditTitleValue(activeSession?.title || '');
                          setIsEditingTitle(true);
                        }}
                      >
                        {activeSession?.title}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                        Integrated with lore
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="relative" ref={moreMenuRef}>
                <button 
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className={cn(
                    "p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors",
                    showMoreMenu ? "bg-slate-100 dark:bg-slate-800 text-indigo-600" : "text-slate-400"
                  )}
                  title="Menu"
                >
                  <MoreVertical size={20} />
                </button>

                {showMoreMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      onClick={() => {
                        setEditTitleValue(activeSession?.title || '');
                        setIsEditingTitle(true);
                        setShowMoreMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors border-b border-slate-100 dark:border-slate-800"
                    >
                      <Edit2 size={16} />
                      Ganti Nama
                    </button>
                    <button
                      onClick={(e) => {
                        deleteSession(activeSessionId!, e);
                        setShowMoreMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                    >
                      <Trash2 size={16} />
                      Hapus Percakapan
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar scroll-smooth">
              <div className="max-w-3xl mx-auto space-y-8">
                {activeSession?.messages.map((m, i) => (
                  <div key={i} className={cn(
                    "flex gap-6 animate-in fade-in slide-in-from-bottom-2",
                    m.role === 'user' ? "flex-reverse" : ""
                  )}>
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md",
                      m.role === 'user' 
                        ? "bg-white dark:bg-slate-800 text-slate-600 border border-slate-100 dark:border-slate-700" 
                        : "bg-indigo-600 text-white"
                    )}>
                      {m.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2 opacity-50">
                        {m.role === 'user' ? 'Penulis' : 'Studio Assistant'}
                      </p>
                      <div className={cn(
                        "text-[15px] leading-relaxed dark:text-slate-200 markdown-body",
                        m.role === 'user' ? "font-serif italic text-slate-700" : "font-sans font-normal"
                      )}>
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex gap-6 animate-pulse">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
                      <Bot size={20} />
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2 opacity-50">Studio Assistant</p>
                      <div className="flex items-center gap-2 text-indigo-500 italic">
                        <Loader2 size={16} className="animate-spin" />
                        Sedang menganalisis semesta cerita Anda...
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            </div>

            <div className="p-6 bg-transparent">
              <div className="max-w-3xl mx-auto relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-10 group-focus-within:opacity-25 transition-all duration-500" />
                <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
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
                       <div className="relative" ref={loreMenuRef}>
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

                         {showLoreMenu && (
                           <div className="absolute left-0 bottom-full mb-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-bottom-2 duration-100">
                             <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
                               <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lampirkan dari Lore</p>
                             </div>
                             <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
                               {codexEntries?.length === 0 && bibleRules?.length === 0 && (
                                 <p className="px-2 py-4 text-center text-[11px] text-slate-500 italic">Lore masih kosong</p>
                               )}
                               {bibleRules?.map(rule => (
                                 <button
                                   key={rule.id}
                                   onClick={() => {
                                     setInput(prev => prev + (prev ? ' ' : '') + `@rule:${rule.key} `);
                                     setShowLoreMenu(false);
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
                                   }}
                                   className="w-full px-2 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors flex flex-col gap-0.5"
                                 >
                                   <span className="font-medium text-slate-900 dark:text-slate-100">{entry.name}</span>
                                   <span className="opacity-60 truncate">{entry.description.substring(0, 40)}...</span>
                                 </button>
                               ))}
                             </div>
                           </div>
                         )}
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
          </>
        )}
      </div>
    </div>
  );
}
