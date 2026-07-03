/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ClipboardList, ListChecks, CircleAlert, Database, ArrowRight } from 'lucide-react';
import { db } from '@/src/db';
import { useOptimizedLiveQuery } from '@/src/hooks/useOptimizedLiveQuery';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { useCodexCategories } from '@/src/features/codex/hooks/useCodexCategories';
import { getCategoryLabel } from '@/src/lib/codexCategories';
import { buildCompletenessReport, STATUS_LABEL } from '@/src/lib/worldCompleteness';
import { WORLD_STATUS_META } from '@/src/features/codex/components/WorldStatusBadge';
import { CategoryIcon } from '@/src/features/codex/components/CategoryIcon';

interface WorldCompletenessPanelProps {
  projectId: number;
}

/** Bar bertumpuk solid/parsial/rangka (proporsional). */
function StackedBar({ solid, partial, stub }: { solid: number; partial: number; stub: number }) {
  const total = solid + partial + stub;
  if (total === 0) return <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800" />;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
      {solid > 0 && <div className={WORLD_STATUS_META.solid.bar} style={{ width: pct(solid) }} title={`${solid} Solid`} />}
      {partial > 0 && <div className={WORLD_STATUS_META.partial.bar} style={{ width: pct(partial) }} title={`${partial} Parsial`} />}
      {stub > 0 && <div className={WORLD_STATUS_META.stub.bar} style={{ width: pct(stub) }} title={`${stub} Rangka`} />}
    </div>
  );
}

export function WorldCompletenessPanel({ projectId }: WorldCompletenessPanelProps) {
  const { openCodexEntry, setViewMode } = useNavigation();
  const { categories } = useCodexCategories(projectId);
  const entries = useOptimizedLiveQuery(
    () => db.codex.where('projectId').equals(projectId).toArray(),
    [projectId],
  );

  const report = useMemo(
    () => buildCompletenessReport(entries || [], c => getCategoryLabel(c, categories)),
    [entries, categories],
  );

  if (!entries) return null;

  if (entries.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-24 px-6 text-center">
        <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
          <Database className="text-indigo-500 dark:text-indigo-400" size={32} />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Belum Ada Data Dunia</h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-8">
          Isi Kamus Data (Codex) terlebih dahulu — panel ini memetakan seberapa lengkap tiap bagian worldbuilding Anda.
        </p>
        <button
          onClick={() => setViewMode('codex')}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-indigo-700 transition-all active:scale-95"
        >
          Buka Kamus Data <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto pb-10">
      <header className="mb-6 flex items-center gap-3">
        <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl shrink-0">
          <ClipboardList className="text-indigo-600 dark:text-indigo-400" size={22} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-0.5">Dunia &amp; Lore</p>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Kelengkapan Dunia</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Peta kematangan lore per kategori + pekerjaan yang tersisa. Deterministik, tanpa AI.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ringkasan keseluruhan */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
            <div className="shrink-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">{report.solidPercent}%</span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">solid</span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{report.total} entri total</p>
            </div>
            <div className="flex-1 min-w-0">
              <StackedBar solid={report.solid} partial={report.partial} stub={report.stub} />
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
                <LegendItem status="solid" count={report.solid} />
                <LegendItem status="partial" count={report.partial} />
                <LegendItem status="stub" count={report.stub} />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Per kategori */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 shadow-sm"
        >
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">Per Kategori</h3>
          <div className="space-y-3.5">
            {report.byCategory.map(cat => (
              <div key={cat.category} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-40 shrink-0 min-w-0">
                  <CategoryIcon category={cat.category} categories={categories} />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate" title={cat.label}>{cat.label}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <StackedBar solid={cat.solid} partial={cat.partial} stub={cat.stub} />
                </div>
                <div className="w-28 shrink-0 text-right text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  <span className="text-emerald-600 dark:text-emerald-400">{cat.solid}</span>
                  {' · '}
                  <span className="text-amber-600 dark:text-amber-400">{cat.partial}</span>
                  {' · '}
                  <span className="text-slate-500">{cat.stub}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Perlu digarap (Rangka) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 shadow-sm"
        >
          <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
            <CircleAlert size={14} className="text-slate-400" /> Masih Rangka
            <span className="ml-auto text-slate-400 dark:text-slate-500 tabular-nums">{report.stubs.length}</span>
          </h3>
          {report.stubs.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 italic">Tak ada entri rangka. 🎉</p>
          ) : (
            <ul className="space-y-1.5 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
              {report.stubs.map(s => (
                <li key={s.id}>
                  <button
                    onClick={() => openCodexEntry(s.id)}
                    className="group w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    title={`Buka ${s.name}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{s.name}</span>
                      <span className="block text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{s.categoryLabel}</span>
                    </span>
                    {s.suggested && (
                      <span className="shrink-0 text-[9px] font-semibold text-slate-400 dark:text-slate-500" title="Status disarankan (belum ditetapkan)">disarankan</span>
                    )}
                    <ArrowRight size={13} className="shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </motion.div>

        {/* TODO tersisa */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 shadow-sm"
        >
          <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
            <ListChecks size={14} className="text-amber-500" /> TODO Tersisa
            <span className="ml-auto text-slate-400 dark:text-slate-500 tabular-nums">{report.todos.length}</span>
          </h3>
          {report.todos.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 italic">
              Belum ada catatan TODO. Tambahkan di form entri Codex (bagian “Catatan &amp; TODO”).
            </p>
          ) : (
            <ul className="space-y-1 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
              {report.todos.map((t, i) => (
                <li key={`${t.entryId}-${i}`}>
                  <button
                    onClick={() => openCodexEntry(t.entryId)}
                    className="group w-full flex items-start gap-3 text-left px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    title={`Buka ${t.entryName}`}
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-700 dark:text-slate-200 break-words">{t.text}</span>
                      <span className="block text-[11px] text-indigo-500 dark:text-indigo-400 font-medium truncate">{t.entryName}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function LegendItem({ status, count }: { status: 'solid' | 'partial' | 'stub'; count: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${WORLD_STATUS_META[status].dot}`} />
      <span className="font-semibold text-slate-600 dark:text-slate-300 tabular-nums">{count}</span>
      <span className="text-slate-400 dark:text-slate-500">{STATUS_LABEL[status]}</span>
    </span>
  );
}
