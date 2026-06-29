/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Continuity Dashboard — analisis kontinuitas lintas-bab, murni lokal & TANPA AI.
 * Logika di src/lib/continuity.ts; panel ini hanya menyajikan & menautkan hasil.
 */

import React, { useState, useCallback } from 'react';
import { db } from '@/src/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Network, ScanSearch, Loader2, CheckCircle2, ArrowUpRight, Sparkles, UserMinus, EyeOff, Users, CalendarClock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { useProjectData } from '@/src/hooks/useProjectData';
import { stripHtml } from '@/src/lib/editorUtils';
import {
  analyzeContinuity, ContinuityReport, ContinuityFinding, ContinuityCheck, ContinuitySeverity,
} from '@/src/lib/continuity';
import { cn } from '@/src/lib/utils';

interface ContinuityDashboardProps {
  projectId: number;
}

const SEVERITY_META: Record<ContinuitySeverity, { label: string; badge: string; dot: string }> = {
  high: { label: 'Tinggi', badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50', dot: 'bg-red-500' },
  medium: { label: 'Sedang', badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50', dot: 'bg-amber-500' },
  low: { label: 'Rendah', badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800/50', dot: 'bg-sky-500' },
};

const CHECK_META: Record<ContinuityCheck, { label: string; icon: React.ReactNode }> = {
  'presence-gap': { label: 'Karakter Menghilang', icon: <UserMinus size={13} /> },
  'unused-entity': { label: 'Entitas Tak Terpakai', icon: <EyeOff size={13} /> },
  'relationship-gap': { label: 'Relasi Tanpa Pertemuan', icon: <Users size={13} /> },
  'timeline-mismatch': { label: 'Timeline Tak Cocok', icon: <CalendarClock size={13} /> },
};

export function ContinuityDashboard({ projectId }: ContinuityDashboardProps) {
  const { setActiveChapterId, setViewMode } = useNavigation();
  const { codexEntries, relationships } = useProjectData(projectId);

  const chapters = useLiveQuery(() =>
    db.chapters.where('projectId').equals(projectId).sortBy('order')
  , [projectId]);
  const timeline = useLiveQuery(() =>
    db.timeline.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const [gapThreshold, setGapThreshold] = useState(4);
  const [scanning, setScanning] = useState(false);
  const [report, setReport] = useState<ContinuityReport | null>(null);

  const openChapter = (id: number) => {
    setActiveChapterId(id);
    setViewMode('write');
  };

  const scan = useCallback(async () => {
    if (!chapters) return;
    setScanning(true);
    setReport(null);
    await new Promise(r => setTimeout(r, 0)); // yield agar overlay loading render
    const plain = chapters
      .filter(c => c.id != null)
      .map(c => ({ id: c.id!, title: c.title, content: stripHtml(c.content || '') }));
    const result = analyzeContinuity(plain, codexEntries, relationships, timeline || [], { gapThreshold });
    setReport(result);
    setScanning(false);
  }, [chapters, codexEntries, relationships, timeline, gapThreshold]);

  const totalChapters = chapters?.length ?? 0;
  const characters = report?.presence.filter(p => p.category === 'character').slice(0, 14) ?? [];

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8 pb-20 w-full">
      {/* Header */}
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide uppercase border border-indigo-100 dark:border-indigo-800/50">
          <Network size={14} />
          <span>Kontinuitas Lintas-Bab</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-serif text-slate-900 dark:text-slate-100 tracking-tight">
          Peta Kontinuitas
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed">
          Memindai <span className="font-medium">seluruh manuskrip</span> untuk menemukan celah kontinuitas: karakter yang menghilang lama, entri Codex yang tak pernah disebut, relasi yang tak pernah ditunjukkan, dan peristiwa timeline yang tak cocok dengan isi bab. Sepenuhnya lokal — <span className="font-medium">tanpa AI, tanpa token</span>.
        </p>
      </header>

      {/* Kontrol */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Ambang menghilang</label>
          <select
            aria-label="Ambang jumlah bab menghilang"
            value={gapThreshold}
            onChange={(e) => setGapThreshold(Number(e.target.value))}
            disabled={scanning}
            className="w-full sm:w-44 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 disabled:opacity-50"
          >
            {[3, 4, 6, 8].map(n => <option key={n} value={n}>≥ {n} bab absen</option>)}
          </select>
        </div>
        <button
          onClick={scan}
          disabled={scanning || totalChapters === 0}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm hover:shadow-md"
        >
          {scanning ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} />}
          {scanning ? 'Memindai…' : 'Pindai Kontinuitas'}
        </button>
        <p className="text-xs text-slate-400 dark:text-slate-500 sm:ml-auto self-center">
          {totalChapters} bab di manuskrip
        </p>
      </div>

      {/* Hasil */}
      {report !== null && (
        <div className="space-y-8">
          {/* Ringkasan */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Temuan" value={report.findings.length} accent="text-indigo-600 dark:text-indigo-400" />
            <StatCard label="Bab" value={report.chapterCount} />
            <StatCard label="Entitas" value={report.entityCount} />
            <StatCard label="Terpetakan" value={report.presence.length} />
          </div>

          {/* Peta kemunculan karakter */}
          {characters.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Peta kemunculan karakter</h2>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm overflow-x-auto custom-scrollbar">
                <div className="space-y-1.5 min-w-max">
                  {characters.map(p => {
                    const present = new Set(p.chapterIndices);
                    return (
                      <div key={p.entityId} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 truncate text-xs font-medium text-slate-600 dark:text-slate-300 text-right" title={p.name}>{p.name}</span>
                        <div className="flex gap-[3px]">
                          {Array.from({ length: report.chapterCount }).map((_, i) => (
                            <div
                              key={i}
                              title={`${chapters?.[i]?.title ?? `Bab ${i + 1}`}${present.has(i) ? ' — muncul' : ''}`}
                              className={cn(
                                'w-2.5 h-5 rounded-sm transition-colors',
                                present.has(i) ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-slate-100 dark:bg-slate-800'
                              )}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">{p.mentions}×</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Tiap kolom = satu bab (urut). Kotak terisi = karakter muncul di bab itu.</p>
            </section>
          )}

          {/* Daftar temuan */}
          {report.findings.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-6 border-2 border-dashed border-emerald-200 dark:border-emerald-800/50 rounded-3xl bg-emerald-50/40 dark:bg-emerald-900/10">
              <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mb-5">
                <CheckCircle2 size={26} className="text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1.5">Tidak ada celah kontinuitas</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
                Tidak ditemukan karakter menghilang, entitas tak terpakai, relasi tanpa pertemuan, atau ketidakcocokan timeline.
              </p>
            </div>
          ) : (
            <section className="space-y-4">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">{report.findings.length} temuan kontinuitas</h2>
              <AnimatePresence mode="popLayout">
                {report.findings.map((f, idx) => (
                  <FindingCard key={f.id} finding={f} index={idx} onOpen={f.chapterIds[0] != null ? () => openChapter(f.chapterIds[0]) : undefined} />
                ))}
              </AnimatePresence>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 italic pt-2">
                Temuan bersifat heuristik (pencocokan nama) — beberapa jeda mungkin disengaja. Verifikasi sebelum mengubah naskah. Hasil tidak disimpan; pindai ulang kapan saja.
              </p>
            </section>
          )}
        </div>
      )}

      {report === null && !scanning && (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50">
          <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-5">
            <Sparkles size={24} className="text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1.5">Belum dipindai</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
            Klik <span className="font-medium">Pindai Kontinuitas</span> untuk memetakan kemunculan tiap entitas di seluruh bab dan menemukan celah kontinuitas.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
      <p className={cn('text-2xl font-bold tabular-nums', accent ?? 'text-slate-900 dark:text-slate-100')}>{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function FindingCard({ finding, index, onOpen }: { finding: ContinuityFinding; index: number; onOpen?: () => void }) {
  const sev = SEVERITY_META[finding.severity];
  const check = CHECK_META[finding.check];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border', sev.badge)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', sev.dot)} />
          {sev.label}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          {check.icon}{check.label}
        </span>
        {onOpen && (
          <button
            onClick={onOpen}
            title="Buka bab terkait di editor"
            className="ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors active:scale-95"
          >
            Buka bab <ArrowUpRight size={12} />
          </button>
        )}
      </div>
      <h3 className="font-semibold text-slate-900 dark:text-slate-100 break-words">{finding.title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{finding.detail}</p>
    </motion.div>
  );
}
