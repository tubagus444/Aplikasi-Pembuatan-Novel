import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Bot, User, Send, Square, Loader2, Sparkles, RefreshCw, FlaskConical, Check, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { useCodexWorkshop } from '@/src/features/codex-workshop/hooks/useCodexWorkshop';
import { WorkshopDraftPane } from '@/src/features/codex-workshop/components/WorkshopDraftPane';
import { stripCodexDraft } from '@/src/lib/codexDraft';

interface CodexWorkshopPanelProps {
  projectId: number;
}

/**
 * Lokakarya Codex (viewMode 'workshop') — Fase 1, mode buat-baru.
 * Dua kolom: kiri diskusi dengan AI (chat), kanan draf entitas terstruktur.
 * Penulisan ke DB hanya lewat tombol Simpan di kolom kanan.
 */
export function CodexWorkshopPanel({ projectId }: CodexWorkshopPanelProps) {
  const { workshopTarget, closeWorkshop } = useNavigation();
  const ws = useCodexWorkshop(projectId);
  const [input, setInput] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const changedFields = new Set(ws.diff.map((d) => d.field as string));

  // Mode edit: tampilkan ringkasan diff dulu agar entri lama tak tertimpa tanpa terlihat.
  const handleSaveClick = () => {
    if (ws.mode === 'edit') setConfirmOpen(true);
    else ws.save();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ws.messages, ws.isLoading]);

  // Sasaran hilang (mis. refresh saat di Lokakarya) → kembali ke panel asal.
  if (!workshopTarget) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center gap-4">
        <FlaskConical size={40} className="text-slate-300" />
        <p className="text-slate-500 dark:text-slate-400 font-serif italic">Sesi Lokakarya sudah ditutup.</p>
        <button
          onClick={closeWorkshop}
          className="text-indigo-600 hover:text-indigo-700 text-sm font-semibold"
        >
          Kembali ke Kamus Data
        </button>
      </div>
    );
  }

  const send = () => {
    if (!input.trim() || ws.isLoading) return;
    ws.sendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-background z-20">
      {/* Header */}
      <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-6 bg-slate-50 dark:bg-slate-800/50 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={ws.close}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors flex items-center gap-1.5 text-sm font-medium"
            title="Kembali ke panel sebelumnya"
          >
            <ArrowLeft size={16} /> Kembali
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-md flex items-center justify-center shadow-sm shrink-0">
              <FlaskConical size={14} />
            </div>
            <h2 className="font-bold text-sm text-slate-800 dark:text-slate-200 tracking-tight truncate">
              Lokakarya Codex{ws.draft.name ? ` — ${ws.draft.name}` : ''}
            </h2>
          </div>
        </div>

        {ws.availableProviders.length > 1 && (
          <div className="flex bg-slate-200/50 dark:bg-slate-700/50 p-0.5 rounded-lg">
            {ws.availableProviders.map((p) => (
              <button
                key={p}
                onClick={() => ws.setSelectedProvider(p)}
                className={cn(
                  'px-2 py-0.5 text-[9px] font-bold rounded-md transition-all uppercase',
                  ws.selectedProvider === p
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                {p === 'google' ? 'Gemini' : p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body: chat | draft */}
      <div className="flex-1 flex min-h-0">
        {/* Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50 dark:bg-slate-800/40 custom-scrollbar">
            {ws.messages.map((m) => (
              <div key={m.id} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm',
                  m.role === 'user'
                    ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    : 'bg-indigo-600 text-white'
                )}>
                  {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div className={cn(
                  'text-[13px] p-3.5 rounded-2xl max-w-[85%] leading-relaxed shadow-sm',
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none whitespace-pre-wrap'
                    : m.isError
                      ? 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 rounded-tl-none'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none font-serif [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-bold'
                )}>
                  {m.role === 'user' ? (
                    m.content
                  ) : (
                    <div className="markdown-body"><ReactMarkdown>{stripCodexDraft(m.content)}</ReactMarkdown></div>
                  )}
                </div>
              </div>
            ))}

            {ws.isLoading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Bot size={14} />
                </div>
                <div className="text-[13px] p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-indigo-500 rounded-tl-none flex items-center gap-2 shadow-sm italic font-serif">
                  <Loader2 size={14} className="animate-spin" /> {ws.retryStatus || 'Menyusun jawaban...'}
                </div>
              </div>
            )}

            {!ws.isLoading && ws.messages.length > 1 && (
              <div className="flex justify-start pl-10">
                <button
                  onClick={ws.regenerate}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-lg px-2.5 py-1 transition-all bg-white dark:bg-slate-900"
                >
                  <RefreshCw size={12} /> Regenerasi
                </button>
              </div>
            )}
            <div ref={messagesEndRef} className="h-2" />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Diskusikan entitas ini dengan AI..."
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 resize-none h-20 placeholder:text-slate-400 dark:text-slate-200"
              />
              {ws.isLoading ? (
                <button
                  onClick={ws.stop}
                  title="Hentikan generasi"
                  className="absolute right-2 bottom-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-sm active:scale-95"
                >
                  <Square size={16} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={send}
                  disabled={!input.trim()}
                  aria-label="Kirim pesan"
                  className="absolute right-2 bottom-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-400 transition-all shadow-sm active:scale-95"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em] flex items-center gap-1 mt-2 px-1">
              <Sparkles size={10} className="text-amber-400" /> Memakai konteks Story Bible &amp; Codex
            </p>
          </div>
        </div>

        {/* Draft */}
        <WorkshopDraftPane
          draft={ws.draft}
          setDraft={ws.setDraft}
          categories={ws.categories}
          isDuplicateName={ws.isDuplicateName}
          isHarvesting={ws.isHarvesting}
          onHarvest={ws.harvestFromDiscussion}
          isSaving={ws.isSaving}
          canSave={ws.canSave}
          onSave={handleSaveClick}
          isAuditing={ws.isAuditing}
          canAudit={ws.canAudit}
          onAudit={ws.auditEntry}
          mode={ws.mode}
          changedFields={changedFields}
        />
      </div>

      {/* Konfirmasi diff (mode edit) */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Konfirmasi Perubahan</h3>
              <button onClick={() => setConfirmOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {ws.diff.length} field akan diperbarui pada entri ini:
              </p>
              {ws.diff.map((d) => (
                <div key={d.field as string} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {d.label}
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="text-[13px] text-red-600 dark:text-red-400 line-through break-words whitespace-pre-wrap">
                      {d.before || <span className="italic opacity-60">(kosong)</span>}
                    </div>
                    <div className="text-[13px] text-emerald-700 dark:text-emerald-400 break-words whitespace-pre-wrap">
                      {d.after || <span className="italic opacity-60">(kosong)</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
              >
                Batal
              </button>
              <button
                onClick={() => { setConfirmOpen(false); ws.save(); }}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm text-sm flex items-center gap-2"
              >
                <Check size={16} /> Terapkan &amp; Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
