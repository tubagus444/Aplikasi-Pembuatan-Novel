/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, X, Copy, Check } from 'lucide-react';
import { db } from '../db';
import { processChat } from '../services/aiService';
// Fix 1: Removed unused imports getRelevantContext, getRelevantBibleRules
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  isActionable?: boolean;
  // Fix 3: Add isWelcome flag
  isWelcome?: boolean;
}

interface AIAssistantPanelProps {
  projectId: number;
  currentText: string;
  onClose: () => void;
  onInsertText?: (text: string) => void;
  viewMode?: string;
}

export function AIAssistantPanel({ projectId, currentText, onClose, onInsertText, viewMode = 'write' }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: '1', 
      role: 'model', 
      text: 'Halo! Saya asisten penulis AI Anda. Tanyakan tentang cerita Anda, lore karakter, atau mari brainstorming bersama.',
      // Fix 3: Mark initial welcome message
      isWelcome: true 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Fix 2: Add timeoutRef to prevent memory leak
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fix 2: Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      // Fix 2: Clear existing timeout before setting new one
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const suggestedPrompts = React.useMemo(() => {
    switch (viewMode) {
      case 'codex':
        return [
          "Bantu kembangkan latar belakang karakter ini",
          "Berikan ide konflik untuk entri ini",
          "Apa rahasia yang mungkin disembunyikan?"
        ];
      case 'outline':
        return [
          "Berikan ide plot twist yang mengejutkan",
          "Bantu menyusun klimaks cerita",
          "Apakah ada masalah pacing di bab ini?"
        ];
      case 'bible':
        return [
          "Saran tema cerita yang lebih kuat",
          "Bantu memperhalus premis cerita",
          "Buat aturan naratif dunia (worldbuilding)"
        ];
      case 'write':
      default:
        return [
          "Evaluasi alur cerita sejauh ini",
          "Berikan ide untuk adegan selanjutnya",
          "Bagaimana cara membuat cerita lebih emosional?"
        ];
    }
  }, [viewMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (textToProcess?: string) => {
    const textToSend = textToProcess || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    if (!textToProcess) setInput('');
    setIsLoading(true);

    try {
      const allCodex = await db.codex.where('projectId').equals(projectId).toArray();
      const allBibleRules = await db.bible.where('projectId').equals(projectId).toArray();

      // Fix 1: Removed double context filtering here

      // Fix 3: Use isWelcome flag instead of hardcoded id filter
      // Fix 4: Add history sliding window slice(-10)
      const history = messages
        .filter(m => !m.isWelcome)
        .slice(-10)
        .map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }));

      const reply = await processChat({
        message: userMsg.text,
        history,
        // Fix 1: Pass raw arrays instead of applying getRelevantContext
        bibleRules: allBibleRules,
        codexEntries: allCodex,
        contextText: currentText
      });

      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: reply, isActionable: true }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: 'Sorry, I encountered an error checking the lore.', isActionable: false }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-[340px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col h-full shadow-2xl relative z-30 shrink-0">
      <div className="h-14 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-5 bg-slate-50 dark:bg-slate-800/50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-md flex items-center justify-center shadow-sm">
            <Sparkles size={14} />
          </div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 tracking-tight">Nova Assistant</h3>
        </div>
        <button onClick={onClose} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-200 rounded-md transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50 dark:bg-slate-800/50 custom-scrollbar">
        {messages.map(m => (
          <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
             <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm ${m.role === 'user' ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400' : 'bg-indigo-600 text-white'}`}>
               {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
             </div>
             <div className={`text-[13px] p-3.5 rounded-2xl max-w-[85%] leading-relaxed shadow-sm ${
               m.role === 'user' 
                 ? 'bg-indigo-600 text-white rounded-tr-none' 
                 : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none font-serif [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:text-slate-900 dark:[&_strong]:text-slate-100 [&_strong]:font-bold'
               }`}>
               {m.role === 'user' ? (
                 m.text
               ) : (
                 <div className="relative">
                   <div className="markdown-body">
                     <ReactMarkdown>{m.text}</ReactMarkdown>
                   </div>
                   {m.isActionable && (
                      <div className="mt-3 flex flex-wrap gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <button 
                          onClick={() => handleCopy(m.id, m.text)}
                          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check size={12} className="text-emerald-500" />
                              <span className="text-emerald-600">Ter-copy</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              Salin ke Clipboard
                            </>
                          )}
                        </button>
                        
                        {/* Fix 5: Handle unused onInsertText prop */}
                        {onInsertText && (
                          <button 
                            onClick={() => onInsertText(m.text)}
                            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors"
                          >
                            Masukkan ke editor
                          </button>
                        )}
                      </div>
                    )}
                 </div>
               )}
             </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
             <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
               <Bot size={14} />
             </div>
             <div className="text-[13px] p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-indigo-500 rounded-tl-none flex items-center gap-2 shadow-sm italic font-serif">
               <Loader2 size={14} className="animate-spin" /> Cross-referencing story bible...
             </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
        {messages.length < 3 && !isLoading && (
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestedPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                className="text-left text-[10px] px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-900/40 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        <div className="relative">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask anything about your lore..."
            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 resize-none h-24 placeholder:text-slate-400 dark:text-slate-500 text-slate-800 dark:text-slate-200"
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 bottom-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-400 transition-all shadow-sm active:scale-95"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="flex justify-between items-center mt-3 px-1">
          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em] flex items-center gap-1">
            <Sparkles size={10} className="text-amber-400" /> Uses Codex Context
          </p>
          <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-widest">Shift+Enter to add line</p>
        </div>
      </div>
    </div>
  );
}
