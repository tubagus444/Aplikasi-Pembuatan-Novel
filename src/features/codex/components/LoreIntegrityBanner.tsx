/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Banner integritas graf lore (#9, Fase 2) — deterministik, nol token, on-demand.
 * Muncul HANYA bila `buildLoreGraph` menemukan tautan menggantung (relasi/janji yang
 * menunjuk entri Codex terhapus). UI biasa menyembunyikan yatim ini diam-diam; banner
 * ini menyuarakannya dan menawarkan pembersihan per-tautan.
 *
 * Sengaja tinggal di area Codex (bukan Peta Kontinuitas): dangling-ref adalah masalah
 * manajemen lore, bukan konsistensi prosa — penulis menemuinya saat mengelola Codex.
 */

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ChevronDown, Link2Off, X } from 'lucide-react';
import { CodexEntry, Relationship, PlotPromise } from '@/src/types';
import { findDanglingRefs, DanglingRef } from '@/src/lib/loreGraph';

interface LoreIntegrityBannerProps {
  entries: CodexEntry[];
  relationships: Relationship[];
  promises: PlotPromise[];
  onResolve: (ref: DanglingRef) => void;
}

const KIND_LABEL: Record<DanglingRef['kind'], string> = {
  'relationship': 'Relasi',
  'promise-codex': 'Janji Plot',
  'promise-payoff': 'Payoff Janji',
};

export function LoreIntegrityBanner({ entries, relationships, promises, onResolve }: LoreIntegrityBannerProps) {
  const [open, setOpen] = useState(false);

  const dangling = useMemo(
    () => findDanglingRefs(entries, relationships, promises),
    [entries, relationships, promises],
  );

  if (dangling.length === 0) return null;

  return (
    <div className="mb-8 rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-900/15 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-amber-100/50 dark:hover:bg-amber-900/25 transition-colors"
        title="Tinjau tautan lore yang menunjuk entri terhapus"
      >
        <AlertTriangle size={18} className="shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="flex-1 text-sm font-semibold text-amber-800 dark:text-amber-200">
          {dangling.length} tautan lore menggantung
          <span className="font-normal text-amber-600 dark:text-amber-400/80">
            {' '}· menunjuk entri yang sudah dihapus
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-amber-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ul className="px-5 pb-4 pt-1 flex flex-col gap-2">
              {dangling.map(ref => (
                <li
                  key={ref.id}
                  className="flex items-center justify-between gap-3 bg-white/60 dark:bg-slate-900/40 rounded-xl px-4 py-2.5 border border-amber-100 dark:border-amber-800/40"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-md">
                      {KIND_LABEL[ref.kind]}
                    </span>
                    <span className="truncate text-sm text-slate-700 dark:text-slate-300">{ref.ownerLabel}</span>
                  </div>
                  <button
                    onClick={() => onResolve(ref)}
                    className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300 hover:text-white bg-transparent hover:bg-amber-600 dark:hover:bg-amber-600 border border-amber-300 dark:border-amber-700 px-3 py-1.5 rounded-lg transition-all active:scale-95"
                    title={ref.kind === 'relationship' ? 'Hapus relasi yang menggantung' : 'Lepas tautan janji yang menggantung'}
                  >
                    {ref.kind === 'relationship' ? <X size={12} /> : <Link2Off size={12} />}
                    {ref.kind === 'relationship' ? 'Hapus' : 'Lepas'}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
