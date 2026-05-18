import React, { useRef, useEffect } from 'react';
import { Bot, User, Loader2, Sparkles, Hash } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '@/src/types';
import { cn } from '@/src/lib/utils';
import { parseMentionTags } from '@/src/lib/loreUtils';

interface AssistantMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSelectPrompt?: (prompt: string) => void;
}

export function AssistantMessageList({ messages, isLoading, onSelectPrompt }: AssistantMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar scroll-smooth">
      <div className="max-w-4xl mx-auto space-y-8">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 md:py-24 text-center animate-in fade-in slide-in-from-bottom-4">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 shadow-sm border border-indigo-50 dark:border-indigo-800/50">
              <Sparkles size={32} />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3">Mulai Diskusi</h3>
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-10 leading-relaxed">
              Pilih salah satu topik di bawah atau ketik langsung pertanyaan/ide Anda di kolom chat.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 w-full max-w-2xl px-4">
              {[
                { title: 'Kembangkan Karakter', desc: 'Bantu saya mendalami motivasi tokoh utama.', prompt: 'Bantu saya mendalami motivasi tokoh utama. Bagaimana jika masa lalunya mengandung konflik yang belum terselesaikan?' },
                { title: 'Eksplorasi Lore', desc: 'Mari bahas aturan sihir atau sejarah dunia ini.', prompt: 'Mari kita kembangkan sistem sihir di dunia ini. Apa batasan utama dan dampaknya bagi para pengguna sihir?' },
                { title: 'Tarik Ulur Plot', desc: 'Saya stuck di bab ini. Apa twist yang bagus?', prompt: 'Saya sedang stuck di bab ini. Karakter utama terpojok, apa twist atau jalan keluar yang masuk akal namun tak terduga?' },
                { title: 'Review Gaya Bahasa', desc: 'Kritik paragraf saya dari segi tone & pacing.', prompt: 'Tolong review ide atau paragraf yang baru saja saya tulis. Berikan saran mengenai tone cerita dan pacing-nya.' },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={() => onSelectPrompt?.(item.prompt)}
                  className="text-left p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 hover:bg-white dark:bg-slate-900/50 dark:hover:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group"
                >
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mb-1">{item.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn(
            "flex gap-3 md:gap-4 animate-in fade-in slide-in-from-bottom-2",
            m.role === 'user' ? "flex-row-reverse" : "flex-row"
          )}>
            <div className={cn(
              "w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm mt-1",
              m.role === 'user' 
                ? "bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hidden" // hidden user avatar
                : "bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-indigo-200 dark:shadow-none"
            )}>
              {m.role !== 'user' && <Sparkles size={18} />}
            </div>
            
            <div className={cn(
              "flex flex-col max-w-[90%] md:max-w-[85%]",
              m.role === 'user' ? "items-end" : "items-start"
            )}>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-1.5 opacity-50 px-1">
                {m.role === 'user' ? 'Anda' : 'A.I. Assistant'}
              </p>
              
              <div className={cn(
                "text-[15px] leading-relaxed shadow-sm",
                m.role === 'user' 
                  ? "bg-indigo-600 text-white px-5 py-3.5 rounded-3xl rounded-tr-sm" 
                  : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-5 md:px-6 py-4 md:py-5 rounded-3xl rounded-tl-sm dark:text-slate-200 w-full"
              )}>
                {m.role === 'user' ? (
                  <div className="whitespace-pre-wrap font-medium">
                    {parseMentionTags(m.content).map((segment, i) => (
                      segment.isMention ? (
                        <span 
                          key={i} 
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold mx-1 shadow-sm bg-white/20 text-white whitespace-nowrap not-italic border border-white/10"
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
                  <div className="markdown-body text-[14px] md:text-[15px]">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-sm mt-1">
              <Sparkles size={18} />
            </div>
            <div className="flex flex-col max-w-[85%] items-start">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-1.5 opacity-50 px-1">A.I. Assistant</p>
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-5 md:px-6 py-4 rounded-3xl rounded-tl-sm shadow-sm">
                <div className="flex items-center gap-3 text-indigo-500 dark:text-indigo-400 font-medium">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="animate-pulse">Sedang menulis response...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-6" />
      </div>
    </div>
  );
}
