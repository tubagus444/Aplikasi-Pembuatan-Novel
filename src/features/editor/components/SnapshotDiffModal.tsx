/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { X, GitCompare, RotateCcw, Plus, Minus } from 'lucide-react';
import { diffText, summarizeDiff } from '@/src/lib/textDiff';

interface SnapshotDiffModalProps {
  /** Snapshot yang akan dibandingkan (versi lama / target pemulihan). */
  snapshot: { label: string; content: string };
  /** Konten naskah saat ini (HTML). */
  currentContent: string;
  onClose: () => void;
  onRestore: () => void;
}

/** HTML → teks polos sadar-blok (jeda paragraf dipertahankan agar diff terbaca). */
function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const blocks = doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
  if (blocks.length === 0) return (doc.body.textContent || '').trim();
  return Array.from(blocks)
    .map((b) => (b.textContent || '').trim())
    .filter(Boolean)
    .join('\n\n');
}

export function SnapshotDiffModal({ snapshot, currentContent, onClose, onRestore }: SnapshotDiffModalProps) {
  // Arah: naskah sekarang (a) → snapshot (b). delete = akan hilang; insert = akan muncul.
  const { segments, added, removed } = useMemo(() => {
    const a = htmlToText(currentContent);
    const b = htmlToText(snapshot.content);
    const segs = diffText(a, b);
    const sum = summarizeDiff(segs);
    return { segments: segs, added: sum.added, removed: sum.removed };
  }, [currentContent, snapshot.content]);

  const identical = added === 0 && removed === 0;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]"
      >
        <header className="flex-none p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <GitCompare size={16} className="text-indigo-500 shrink-0" />
              Bandingkan Versi
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
              Naskah sekarang → <span className="font-semibold">{snapshot.label}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 dark:text-slate-500 shrink-0"
            title="Tutup"
          >
            <X size={16} />
          </button>
        </header>

        {/* Ringkasan perubahan */}
        <div className="flex-none px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4 text-xs font-bold">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <Plus size={13} /> {added} kata
          </span>
          <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
            <Minus size={13} /> {removed} kata
          </span>
          <span className="ml-auto text-[10px] font-medium text-slate-400 dark:text-slate-500 normal-case">
            hijau = muncul · merah = hilang setelah pulihkan
          </span>
        </div>

        {/* Diff */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {identical ? (
            <p className="text-center text-sm italic text-slate-400 dark:text-slate-500 py-12">
              Versi ini identik dengan naskah sekarang.
            </p>
          ) : (
            <p className="font-serif text-[15px] leading-[1.9] text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
              {segments.map((seg, i) => {
                if (seg.type === 'equal') return <span key={i}>{seg.value}</span>;
                if (seg.type === 'insert')
                  return (
                    <span
                      key={i}
                      className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded-sm"
                    >
                      {seg.value}
                    </span>
                  );
                return (
                  <span
                    key={i}
                    className="bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 line-through rounded-sm"
                  >
                    {seg.value}
                  </span>
                );
              })}
            </p>
          )}
        </div>

        {/* Aksi */}
        <div className="flex-none p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={onRestore}
            className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <RotateCcw size={14} />
            Pulihkan versi ini
          </button>
        </div>
      </motion.div>
    </div>
  );
}
