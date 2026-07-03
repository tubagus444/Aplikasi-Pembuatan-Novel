import React from 'react';
import { CircleCheck, CircleDashed, Circle } from 'lucide-react';
import { WorldStatus } from '@/src/types';
import { STATUS_LABEL } from '@/src/lib/worldCompleteness';
import { cn } from '@/src/lib/utils';

// Metadata visual per-status (sengaja di komponen, bukan di lib murni — pola sama
// seperti relationshipTypes). Dipakai badge di kartu/detail/panel kelengkapan (#11).
export const WORLD_STATUS_META: Record<WorldStatus, { icon: React.ElementType; dot: string; chip: string; bar: string }> = {
  solid: {
    icon: CircleCheck,
    dot: 'bg-emerald-500',
    chip: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/25 border-emerald-200 dark:border-emerald-800/50',
    bar: 'bg-emerald-500',
  },
  partial: {
    icon: CircleDashed,
    dot: 'bg-amber-500',
    chip: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/25 border-amber-200 dark:border-amber-800/50',
    bar: 'bg-amber-500',
  },
  stub: {
    icon: Circle,
    dot: 'bg-slate-400 dark:bg-slate-500',
    chip: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    bar: 'bg-slate-400 dark:bg-slate-600',
  },
};

interface WorldStatusBadgeProps {
  status: WorldStatus;
  /** true bila status masih berupa saran otomatis (belum dideklarasikan penulis). */
  suggested?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/** Pil status kematangan lore. Menampilkan "?" bila status masih saran. */
export function WorldStatusBadge({ status, suggested, size = 'md', className }: WorldStatusBadgeProps) {
  const meta = WORLD_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-bold uppercase tracking-wider rounded-full border',
        size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5',
        meta.chip,
        suggested && 'opacity-70',
        className,
      )}
      title={suggested ? `Disarankan: ${STATUS_LABEL[status]} (belum ditetapkan)` : `Status: ${STATUS_LABEL[status]}`}
    >
      <Icon size={size === 'sm' ? 10 : 11} />
      {STATUS_LABEL[status]}
      {suggested && <span className="font-normal opacity-70">?</span>}
    </span>
  );
}
