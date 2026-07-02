/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Isi pesan; boleh JSX (mis. penekanan bagian penting). */
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' → aksen merah (aksi destruktif spt menimpa/hapus). */
  tone?: 'danger' | 'default';
  /** Saat true, tombol konfirmasi menampilkan spinner & dinonaktifkan. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Dialog konfirmasi bergaya app (pengganti `window.confirm` untuk aksi destruktif).
 * Terkontrol: render lewat prop `open`. Meniru pola modal konfirmasi yang sudah ada
 * (CategoryManagerModal) agar konsisten.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Lanjutkan',
  cancelLabel = 'Batal',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const isDanger = tone === 'danger';
  const confirmClasses = isDanger
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-indigo-600 hover:bg-indigo-700 text-white';

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      onClick={() => { if (!busy) onCancel(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-2xl max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-xl ${isDanger ? 'bg-red-50 dark:bg-red-900/30' : 'bg-indigo-50 dark:bg-indigo-900/30'}`}>
            <AlertTriangle className={isDanger ? 'text-red-500' : 'text-indigo-500'} size={20} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          {message}
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-colors text-sm disabled:opacity-60 ${confirmClasses}`}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
