/**
 * Papan Faksi (#15 fase 2, tahap 2) — inspector drawer (panel geser kanan).
 *
 * Dipilih atas popup/modal: non-blocking (kanvas tetap terlihat & bisa di-drag), muat
 * konten kaya, ganti antar-faksi mulus. Isi = "detail" master-detail v1 ditempel ke
 * kanvas: anggota, hubungan (deklarasi + potret turunan), kohesi internal, aksi.
 * Presentasional — semua data & mutasi datang dari induk (FactionBoardCanvas).
 */
import { useState } from 'react';
import { X, ExternalLink, Trash2, Plus } from 'lucide-react';
import type { Relationship } from '@/src/types';
import type { CategoryDef } from '@/src/lib/codexCategories';
import { CategoryIcon } from '@/src/features/codex/components/CategoryIcon';
import { styleOf } from '@/src/features/lore/relationshipStyles';
import { RELATIONSHIP_TYPES, getRelationshipLabel } from '@/src/features/codex/relationshipTypes';
import { cn } from '@/src/lib/utils';

const typeLabel = (t: string) => getRelationshipLabel(t, true);

export interface InspectorMember { id: number; name: string; category: string }
export interface InspectorRelationRow {
  other: { id: number; name: string; hidden: boolean };
  declared: Relationship[];
  derived: Record<string, number>;
}
export interface InspectorData {
  faction: { id: number; name: string; hidden: boolean; tag: string };
  members: InspectorMember[];
  /** Baris faksi lain yang PUNYA relasi (deklarasi/turunan). */
  rows: InspectorRelationRow[];
  /** Semua faksi lain (untuk memilih target relasi baru). */
  others: { id: number; name: string }[];
  internal: Record<string, number>;
}

interface Props {
  data: InspectorData;
  categories: CategoryDef[];
  onOpenEntry: (id: number) => void;
  onAddRelation: (otherId: number, type: string, note: string) => void;
  onDeleteRelation: (id: number) => void;
  onClose: () => void;
}

function TallyChips({ tally, empty }: { tally: Record<string, number>; empty: string }) {
  const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <span className="text-[11px] italic text-slate-400">{empty}</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {entries.map(([type, count]) => (
        <span key={type} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md"
          style={{ backgroundColor: `${styleOf(type).hex}22`, color: styleOf(type).hex }}>
          <b>{count}×</b> {typeLabel(type)}
        </span>
      ))}
    </span>
  );
}

export function FactionInspector({ data, categories, onOpenEntry, onAddRelation, onDeleteRelation, onClose }: Props) {
  const { faction } = data;
  const [newOther, setNewOther] = useState('');
  const [newType, setNewType] = useState('Ally');
  const [newNote, setNewNote] = useState('');

  const submitNew = () => {
    if (!newOther) return;
    onAddRelation(Number(newOther), newType, newNote);
    setNewOther(''); setNewNote('');
  };

  return (
    <div className="absolute top-0 right-0 h-full w-[330px] max-w-[85%] z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-l border-slate-200 dark:border-slate-800 shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="min-w-0">
          <h2 className={cn('text-base font-bold truncate', faction.hidden ? 'text-purple-700 dark:text-purple-300' : 'text-slate-900 dark:text-slate-100')}>
            {faction.name}
          </h2>
          <p className="text-[11px] text-slate-400">
            Tag: <code className="text-slate-500 dark:text-slate-300">{faction.tag}</code> · {data.members.length} anggota
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onOpenEntry(faction.id)} title="Buka entri Codex"
            className="grid place-items-center w-7 h-7 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <ExternalLink size={14} />
          </button>
          <button onClick={onClose} title="Tutup"
            className="grid place-items-center w-7 h-7 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-4">
        {/* Anggota */}
        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Anggota</h3>
          {data.members.length === 0 ? (
            <p className="text-[11px] italic text-slate-400">Belum ada anggota.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {data.members.map(m => (
                <button key={m.id} onClick={() => onOpenEntry(m.id)}
                  className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 max-w-[200px]">
                  <CategoryIcon category={m.category} categories={categories} size={12} />
                  <span className="truncate">{m.name}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Hubungan */}
        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Hubungan dengan faksi lain</h3>
          {data.rows.length === 0 ? (
            <p className="text-[11px] italic text-slate-400 mb-2">Belum ada hubungan tercatat.</p>
          ) : (
            <div className="space-y-2 mb-3">
              {data.rows.map(row => (
                <div key={row.other.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5">
                  <div className={cn('text-[13px] font-medium truncate mb-1', row.other.hidden ? 'text-purple-700 dark:text-purple-300' : 'text-slate-800 dark:text-slate-200')}>
                    {row.other.name}
                  </div>
                  {row.declared.length > 0 && (
                    <div className="space-y-1 mb-1.5">
                      {row.declared.map(r => (
                        <div key={r.id} className="flex items-center gap-1.5">
                          <span className="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded-md shrink-0"
                            style={{ backgroundColor: `${styleOf(r.type).hex}22`, color: styleOf(r.type).hex }}>
                            {typeLabel(r.type)}
                          </span>
                          {r.description && <span className="text-[11px] italic text-slate-500 truncate">"{r.description}"</span>}
                          <button onClick={() => onDeleteRelation(r.id!)} title="Hapus deklarasi" className="ml-auto shrink-0 text-slate-300 hover:text-red-500">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">
                      Antar-anggota <span className="normal-case text-slate-300">(potret)</span>
                    </div>
                    <TallyChips tally={row.derived} empty="belum ada" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tetapkan relasi baru */}
          {data.others.length > 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-2.5 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1">
                <Plus size={11} /> Tetapkan relasi
              </div>
              <select value={newOther} onChange={e => setNewOther(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200">
                <option value="">Pilih faksi…</option>
                {data.others.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <div className="flex gap-2">
                <select value={newType} onChange={e => setNewType(e.target.value)}
                  className="px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200">
                  {RELATIONSHIP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Catatan (opsional)"
                  className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200" />
              </div>
              <button onClick={submitNew} disabled={!newOther}
                className="w-full py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium disabled:opacity-50">
                Tambah
              </button>
            </div>
          )}
        </section>

        {/* Kohesi internal */}
        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Kohesi internal</h3>
          <TallyChips tally={data.internal} empty="belum ada relasi antar-anggota" />
        </section>
      </div>
    </div>
  );
}
