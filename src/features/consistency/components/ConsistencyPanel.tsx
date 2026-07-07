/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db } from '@/src/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShieldCheck, ScanSearch, Loader2, AlertTriangle, CheckCircle2, X, ChevronRight, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { useProjectData } from '@/src/hooks/useProjectData';
import { checkConsistency, cancelAI } from '@/src/services/ai';
import { stripHtml } from '@/src/lib/editorUtils';
import { buildTimelineSummary } from '@/src/lib/timelineSummary';
import { ConsistencyFinding } from '@/src/types';
import { cn } from '@/src/lib/utils';

interface ConsistencyPanelProps {
  projectId: number;
}

const SEVERITY_META: Record<ConsistencyFinding['severity'], { label: string; badge: string; dot: string; order: number }> = {
  high: {
    label: 'Tinggi',
    badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50',
    dot: 'bg-red-500',
    order: 0
  },
  medium: {
    label: 'Sedang',
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50',
    dot: 'bg-amber-500',
    order: 1
  },
  low: {
    label: 'Rendah',
    badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800/50',
    dot: 'bg-sky-500',
    order: 2
  }
};

export function ConsistencyPanel({ projectId }: ConsistencyPanelProps) {
  const { activeChapterId, jumpToText } = useNavigation();
  const { codexEntries, bibleRules, relationships } = useProjectData(projectId);

  const chapters = useLiveQuery(() =>
    db.chapters.where('projectId').equals(projectId).sortBy('order')
  , [projectId]);

  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(activeChapterId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [findings, setFindings] = useState<ConsistencyFinding[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [checkedTitle, setCheckedTitle] = useState('');
  const [checkedChapterId, setCheckedChapterId] = useState<number | null>(null);

  // Default ke bab aktif begitu daftar bab termuat / bab aktif berubah.
  useEffect(() => {
    if (selectedChapterId == null && activeChapterId != null) {
      setSelectedChapterId(activeChapterId);
    }
  }, [activeChapterId, selectedChapterId]);

  const runCheck = async () => {
    if (selectedChapterId == null) return;
    const chapter = await db.chapters.get(selectedChapterId);
    if (!chapter) {
      setError('Bab tidak ditemukan.');
      return;
    }

    const plain = stripHtml(chapter.content || '').trim();
    if (plain.length < 50) {
      setError('Bab ini terlalu pendek untuk diperiksa.');
      setFindings(null);
      return;
    }

    setLoading(true);
    setError(null);
    setFindings(null);
    setCheckedTitle(chapter.title);
    setCheckedChapterId(chapter.id ?? selectedChapterId);

    // Bangun ringkasan timeline dari data terkini agar AI bisa cek urutan waktu.
    const project = await db.projects.get(projectId);
    const timelineEvents = await db.timeline.where('projectId').equals(projectId).toArray();
    const timelineSummary = buildTimelineSummary(timelineEvents, chapters || [], codexEntries, project?.calendar);

    try {
      const { findings, truncated } = await checkConsistency({
        chapterText: plain,
        chapterTitle: chapter.title,
        bibleRules,
        codexEntries,
        relationships,
        timelineSummary
      });
      // Urutkan berdasarkan severity (tinggi dulu).
      findings.sort((a, b) => SEVERITY_META[a.severity].order - SEVERITY_META[b.severity].order);
      setFindings(findings);
      setTruncated(truncated);
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setError(null);
      } else {
        setError(e?.message || 'Pengecekan konsistensi gagal.');
      }
    } finally {
      setLoading(false);
    }
  };

  const cancel = () => {
    cancelAI('consistency');
    setLoading(false);
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8 pb-20 w-full">
      {/* Header */}
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide uppercase border border-indigo-100 dark:border-indigo-800/50">
          <ShieldCheck size={14} />
          <span>Pengecek Konsistensi</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-serif text-slate-900 dark:text-slate-100 tracking-tight">
          Periksa Kontinuitas
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed">
          AI membandingkan satu bab dengan Kamus Data, Buku Cerita, dan relasi karakter — lalu menandai detail yang bertentangan (warna mata, peran, timeline, plot). Bukan untuk menulis, melainkan menjaga cerita tetap konsisten.
        </p>
      </header>

      {/* Kontrol */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            Bab yang diperiksa
          </label>
          <select
            value={selectedChapterId ?? ''}
            onChange={(e) => setSelectedChapterId(e.target.value ? Number(e.target.value) : null)}
            disabled={loading}
            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-900 transition-all disabled:opacity-50"
          >
            <option value="" disabled>Pilih bab…</option>
            {chapters?.map(ch => (
              <option key={ch.id} value={ch.id}>{ch.title}</option>
            ))}
          </select>
        </div>
        {loading ? (
          <button
            onClick={cancel}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-[0.98]"
          >
            <X size={16} /> Batalkan
          </button>
        ) : (
          <button
            onClick={runCheck}
            disabled={selectedChapterId == null}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm hover:shadow-md"
          >
            <ScanSearch size={16} /> Periksa Konsistensi
          </button>
        )}
      </div>

      {/* Status & hasil */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="animate-spin text-indigo-500 mb-3" size={32} />
          <p className="text-sm text-slate-500 dark:text-slate-400 font-serif italic">
            Membandingkan bab dengan knowledge base…
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed">{error}</p>
        </div>
      )}

      {!loading && findings !== null && (
        <div className="space-y-4">
          {truncated && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-2.5">
              Bab terlalu panjang — hanya bagian awal yang diperiksa. Pertimbangkan memecahnya menjadi beberapa bab.
            </p>
          )}

          {findings.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-6 border-2 border-dashed border-emerald-200 dark:border-emerald-800/50 rounded-3xl bg-emerald-50/40 dark:bg-emerald-900/10">
              <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mb-5">
                <CheckCircle2 size={26} className="text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1.5">Tidak ada inkonsistensi terdeteksi</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
                AI tidak menemukan kontradiksi pada <span className="font-medium">{checkedTitle}</span> terhadap Kamus Data &amp; Buku Cerita saat ini.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {findings.length} temuan pada <span className="text-indigo-600 dark:text-indigo-400">{checkedTitle}</span>
                </h2>
              </div>
              <AnimatePresence mode="popLayout">
                {findings.map((f, idx) => (
                  <FindingCard
                    key={idx}
                    finding={f}
                    index={idx}
                    onJump={checkedChapterId != null ? () => jumpToText(checkedChapterId, f.quote) : undefined}
                  />
                ))}
              </AnimatePresence>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 italic pt-2">
                Hasil dari AI bersifat saran — selalu verifikasi sebelum mengubah naskah. Temuan ini tidak disimpan; jalankan ulang kapan saja.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FindingCard({ finding, index, onJump }: { finding: ConsistencyFinding; index: number; onJump?: () => void }) {
  const meta = SEVERITY_META[finding.severity];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border', meta.badge)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
          {meta.label}
        </span>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          {finding.type}
        </span>
        {onJump && (
          <button
            onClick={onJump}
            title="Buka kutipan ini di editor"
            className="ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors active:scale-95"
          >
            Buka di editor <ArrowUpRight size={12} />
          </button>
        )}
      </div>

      <blockquote className="border-l-2 border-slate-300 dark:border-slate-600 pl-3 text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed">
        “{finding.quote}”
      </blockquote>

      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        {finding.explanation}
      </p>

      {finding.conflictsWith && (
        <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-600 dark:text-slate-400">Bertentangan dengan: </span>
          {finding.conflictsWith}
        </p>
      )}

      {finding.suggestion && (
        <div className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-900/15 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800/40">
          <ChevronRight size={14} className="shrink-0 mt-0.5" />
          <p className="leading-relaxed">{finding.suggestion}</p>
        </div>
      )}
    </motion.div>
  );
}
