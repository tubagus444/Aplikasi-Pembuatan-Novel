/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modal Audit Kronologi (#4 Fase 2) — menampilkan temuan anomali urutan tanggal
 * antar-bab dan linimasa yang terdeteksi secara deterministik.
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  History, X, AlertTriangle, ArrowRight, Calendar,
  BookOpen, Edit3, CheckCircle2, Sparkles
} from 'lucide-react';
import { TimelineEvent, WorldCalendar, WorldDate } from '@/src/types';
import { ChronologyAnomaly } from '@/src/lib/chronologyAudit';
import { formatDate } from '@/src/lib/worldCalendar';
import { cn } from '@/src/lib/utils';

interface Props {
  calendar: WorldCalendar;
  anomalies: ChronologyAnomaly[];
  onClose: () => void;
  onJumpToDate?: (date: WorldDate) => void;
  onEditEvent?: (event: TimelineEvent) => void;
  onOpenChapter?: (chapterId: number) => void;
}

const SEVERITY_BADGE = {
  high: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60',
  medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60',
  low: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900/60',
};

const TYPE_LABEL = {
  'retrograde-chapter': 'Tanggal Bab Mundur',
  'retrograde-same-chapter': 'Urutan Bab Terbalik',
  'invalid-range': 'Rentang Terbalik',
};

export function ChronologyAuditModal({
  calendar, anomalies, onClose, onJumpToDate, onEditEvent, onOpenChapter,
}: Props) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const highCount = anomalies.filter(a => a.severity === 'high').length;
  const mediumCount = anomalies.filter(a => a.severity === 'medium').length;
  const lowCount = anomalies.filter(a => a.severity === 'low').length;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <History size={16} />
            </span>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Audit Kronologi Waktu</h3>
              <p className="text-[11px] text-slate-400">
                Pemeriksaan deterministik urutan bab & peristiwa linimasa (0 AI token)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>

        {/* Ringkasan Status */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between flex-wrap gap-2 text-xs">
          {anomalies.length === 0 ? (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 size={15} /> Semua tanggal peristiwa selaras sempurna dengan urutan bab.
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {anomalies.length} temuan:
              </span>
              {highCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-semibold text-[10px]">
                  {highCount} Tinggi
                </span>
              )}
              {mediumCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold text-[10px]">
                  {mediumCount} Sedang
                </span>
              )}
              {lowCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-semibold text-[10px]">
                  {lowCount} Kilas Balik
                </span>
              )}
            </div>
          )}
        </div>

        {/* List Temuan */}
        <div className="p-5 space-y-3.5 overflow-y-auto custom-scrollbar">
          {anomalies.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 space-y-2">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500/70" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Kronologi Bersih</p>
              <p className="text-xs max-w-sm mx-auto">
                Tidak ada peristiwa yang mengalami tanggal mundur antar-bab atau kesalahan rentang tanggal.
              </p>
            </div>
          ) : (
            anomalies.map(a => (
              <div
                key={a.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-colors space-y-3"
              >
                {/* Title & Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-semibold border', SEVERITY_BADGE[a.severity])}>
                        {a.severity === 'high' ? 'Peringatan Tinggi' : a.severity === 'medium' ? 'Perhatian' : 'Kilas Balik'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {TYPE_LABEL[a.type]}
                      </span>
                      {a.isFlashback && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40">
                          Disengaja (Kilas Balik)
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {a.title}
                    </h4>
                  </div>
                </div>

                {/* Detail Penjelasan */}
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {a.detail}
                </p>

                {/* Komparasi Tanggal */}
                {a.chapterA && a.chapterB && a.eventA && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs">
                    <div className="truncate flex-1">
                      <span className="text-slate-400 text-[10px] block">Sebelumnya:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{a.chapterA.title}</span>
                      <span className="text-[11px] text-slate-400 block font-mono">
                        {formatDate(calendar, a.eventA.startDate!)}
                      </span>
                    </div>
                    <ArrowRight size={14} className="text-slate-400 shrink-0" />
                    <div className="truncate flex-1">
                      <span className="text-slate-400 text-[10px] block">Mundur ke:</span>
                      <span className="font-medium text-rose-600 dark:text-rose-400">{a.chapterB.title}</span>
                      <span className="text-[11px] text-rose-600/80 dark:text-rose-400/80 block font-mono">
                        {formatDate(calendar, a.eventB.startDate!)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Tombol Tindakan Cepat */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  {onOpenChapter && a.chapterB?.id != null && (
                    <button
                      onClick={() => { onOpenChapter(a.chapterB!.id); onClose(); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <BookOpen size={12} /> Buka {a.chapterB.title}
                    </button>
                  )}
                  {onEditEvent && (
                    <button
                      onClick={() => { onEditEvent(a.eventB); onClose(); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Edit3 size={12} /> Edit Peristiwa
                    </button>
                  )}
                  {onJumpToDate && a.eventB.startDate && (
                    <button
                      onClick={() => { onJumpToDate(a.eventB.startDate!); onClose(); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                      <Calendar size={12} /> Loncat di Kalender
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-slate-100 dark:border-slate-800/60 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
