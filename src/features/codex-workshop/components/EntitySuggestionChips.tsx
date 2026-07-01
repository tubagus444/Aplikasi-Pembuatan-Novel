import React from 'react';
import { FlaskConical } from 'lucide-react';

interface EntitySuggestionChipsProps {
  names: string[];
  /** Dipanggil dengan nama entitas saat chip diklik (buka Lokakarya, seed nama). */
  onOpen: (name: string) => void;
}

/**
 * Chip "Belum di Codex" di bawah balasan AI: menawarkan membuka nama-diri yang
 * terdeteksi baru langsung di Lokakarya Codex. Presentasional; deteksi & aksi
 * disuplai pemanggil (lihat scanNewEntities + openWorkshop).
 */
export function EntitySuggestionChips({ names, onOpen }: EntitySuggestionChipsProps) {
  if (!names.length) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        Belum di Codex:
      </span>
      {names.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onOpen(name)}
          title={`Buka "${name}" di Lokakarya Codex`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
        >
          <FlaskConical size={11} />
          {name}
        </button>
      ))}
    </div>
  );
}
