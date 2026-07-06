/**
 * Papan Faksi (#15) — kartu faksi sebagai custom node React Flow.
 *
 * 1 kartu = 1 faksi. Header (ikon kategori + nama + menu buka entri + chevron ciut),
 * daftar anggota berikon kategori (klik → buka entri), footer (jumlah anggota + kohesi).
 * Node = DOM biasa → klik/hover native (tak ada jebakan hit-test seperti force-graph #14).
 * Semua state (posisi/ciut/sorot) diberikan induk lewat `data`; node ini murni presentasi.
 */
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { CategoryIcon } from '@/src/features/codex/components/CategoryIcon';
import type { CategoryDef } from '@/src/lib/codexCategories';
import { cn } from '@/src/lib/utils';

export interface FactionNodeMember {
  id: number;
  name: string;
  category: string;
}

export interface FactionNodeData {
  factionId: number;
  name: string;
  hidden: boolean;
  category: string;
  /** Warna aksen ikon header (hex kategori faksi). */
  accent: string;
  members: FactionNodeMember[];
  cohesionLevel: number; // 0..3
  collapsed: boolean;
  /** Sorot ego-network: true bila ada fokus & node ini bukan fokus/tetangganya. */
  dimmed: boolean;
  focused: boolean;
  neighbor: boolean;
  categories: CategoryDef[];
  onOpenEntry: (id: number) => void;
  onToggleCollapse: (id: number) => void;
  [key: string]: unknown;
}

function CohesionDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
      kohesi
      <span className="inline-flex gap-0.5">
        {[0, 1, 2].map(i => (
          <i
            key={i}
            className={cn('w-1.5 h-1.5 rounded-full', i < level ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700')}
          />
        ))}
      </span>
    </span>
  );
}

function FactionCardNodeInner({ data, selected }: NodeProps) {
  const d = data as FactionNodeData;

  return (
    <div
      className={cn(
        'rounded-xl border bg-white dark:bg-slate-900 shadow-sm transition-[box-shadow,border-color,opacity]',
        d.collapsed ? 'min-w-[150px] max-w-[230px]' : 'w-[186px]',
        d.hidden
          ? 'border-dashed border-purple-400 dark:border-purple-500'
          : 'border-slate-200 dark:border-slate-800',
        (d.focused || selected) && 'ring-2 ring-indigo-500 border-indigo-400 shadow-lg',
        d.neighbor && !d.focused && 'border-indigo-300 dark:border-indigo-600',
        d.dimmed && 'opacity-30 saturate-50',
      )}
    >
      {/* Handle tersembunyi — floating edge menghitung sendiri titik tempelnya, tapi React
          Flow tetap butuh handle sumber & target agar edge ter-render. */}
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-1 !h-1 !border-0 !min-w-0 !min-h-0" isConnectable={false} />
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-1 !h-1 !border-0 !min-w-0 !min-h-0" isConnectable={false} />

      {/* Header */}
      <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-slate-100 dark:border-slate-800">
        <button
          className="nodrag shrink-0 grid place-items-center w-5 h-5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-transform"
          style={{ transform: d.collapsed ? 'rotate(-90deg)' : undefined }}
          onClick={() => d.onToggleCollapse(d.factionId)}
          title={d.collapsed ? 'Buka anggota' : 'Ciutkan'}
        >
          <ChevronDown size={13} strokeWidth={2.5} />
        </button>
        <span
          className="shrink-0 grid place-items-center w-[22px] h-[22px] rounded-md text-white"
          style={{ backgroundColor: d.accent }}
        >
          <CategoryIcon category={d.category} categories={d.categories} size={13} />
        </span>
        <span
          className={cn(
            'flex-1 min-w-0 truncate text-[13px] font-semibold',
            d.hidden ? 'text-purple-700 dark:text-purple-300' : 'text-slate-800 dark:text-slate-100',
          )}
          title={d.name}
        >
          {d.name}
        </span>
        {d.collapsed && (
          <span className="shrink-0 text-[10.5px] tabular-nums text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full px-1.5 py-0.5">
            {d.members.length}
          </span>
        )}
        <button
          className="nodrag shrink-0 grid place-items-center w-5 h-5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={() => d.onOpenEntry(d.factionId)}
          title="Buka entri Codex"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {!d.collapsed && (
        <>
          {/* Anggota */}
          <div className="px-2 py-1.5 flex flex-col gap-px max-h-[220px] overflow-y-auto">
            {d.members.length === 0 ? (
              <span className="px-1.5 py-1 text-[11px] italic text-slate-400">Belum ada anggota</span>
            ) : (
              d.members.map(m => (
                <button
                  key={m.id}
                  className="nodrag flex items-center gap-1.5 px-1.5 py-1 rounded-md text-[12px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 text-left"
                  onClick={() => d.onOpenEntry(m.id)}
                  title={m.name}
                >
                  <span className="shrink-0 opacity-80">
                    <CategoryIcon category={m.category} categories={d.categories} size={12} />
                  </span>
                  <span className="truncate">{m.name}</span>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 tabular-nums">{d.members.length} anggota</span>
            <CohesionDots level={d.cohesionLevel} />
          </div>
        </>
      )}
    </div>
  );
}

export const FactionCardNode = memo(FactionCardNodeInner);
