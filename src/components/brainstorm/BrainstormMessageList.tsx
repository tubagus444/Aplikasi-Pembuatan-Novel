import React, { useRef, useEffect } from 'react';
import { Bot, User, Loader2, Sparkles, Hash } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '../../types';
import { cn } from '../../lib/utils';
import { parseMentionTags } from '../../lib/loreUtils';

interface BrainstormMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export function BrainstormMessageList({ messages, isLoading }: BrainstormMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar scroll-smooth">
      <div className="max-w-3xl mx-auto space-y-8">
        {messages.map((m, i) => (
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
                {m.role === 'user' ? (
                  <div className="whitespace-pre-wrap">
                    {parseMentionTags(m.content).map((segment, i) => (
                      segment.isMention ? (
                        <span 
                          key={i} 
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-sm font-bold mx-0.5 shadow-sm border whitespace-nowrap not-italic",
                            segment.type === 'rule' 
                              ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800" 
                              : "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-400 dark:border-indigo-800"
                          )}
                        >
                          {segment.type === 'rule' ? <Hash size={12} /> : <Sparkles size={12} />}
                          {segment.text}
                        </span>
                      ) : (
                        <span key={i}>{segment.text}</span>
                      )
                    ))}
                  </div>
                ) : (
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                )}
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
  );
}
