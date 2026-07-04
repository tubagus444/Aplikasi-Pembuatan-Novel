import React from 'react';
import { Users, Plus, X, Trash2, ExternalLink, ChevronRight, UserPlus } from 'lucide-react';
import { useFactions, type FactionRelationRow } from '@/src/features/lore/hooks/useFactions';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { styleOf } from '@/src/features/lore/relationshipStyles';
import { RELATIONSHIP_TYPES, getRelationshipLabel } from '@/src/features/codex/relationshipTypes';
import { CategoryIcon } from '@/src/features/codex/components/CategoryIcon';
import { cn } from '@/src/lib/utils';

interface Props {
  projectId: number;
}

const typeLabel = (type: string) => getRelationshipLabel(type, true);

/** Ringkasan tally relasi per-tipe sebagai deret chip berwarna. */
function TallyChips({ tally, empty }: { tally: Record<string, number>; empty?: string }) {
  const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <span className="text-[11px] text-slate-400 italic">{empty ?? 'tak ada'}</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {entries.map(([type, count]) => (
        <span
          key={type}
          className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md"
          style={{ backgroundColor: `${styleOf(type).hex}22`, color: styleOf(type).hex }}
        >
          <b>{count}×</b> {typeLabel(type)}
        </span>
      ))}
    </span>
  );
}

export function FactionsPanel({ projectId }: Props) {
  const f = useFactions(projectId);
  const { openCodexEntry } = useNavigation();

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Users className="text-indigo-600" size={22} />
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Faksi &amp; Kelompok</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Kelompokkan entitas (via tag keanggotaan) lalu lihat politik antar-kelompok. Status
          yang <b>kamu deklarasikan</b> disajikan berdampingan dengan <b>potret</b> hubungan
          antar-anggota — netral, tanpa penghakiman.
        </p>
      </header>

      {f.loading ? (
        <p className="text-sm text-slate-400 italic py-10 text-center">Memuat…</p>
      ) : f.factions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5">
          {/* Kiri: daftar faksi */}
          <div className="space-y-1.5">
            {f.factions.map(fac => (
              <button
                key={fac.id}
                onClick={() => f.setSelectedId(fac.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg border transition-all flex items-center justify-between gap-2',
                  f.selectedId === fac.id
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                )}
              >
                <span className="min-w-0">
                  <span className={cn(
                    'block text-sm font-medium truncate',
                    fac.hidden ? 'text-purple-700 dark:text-purple-300' : 'text-slate-800 dark:text-slate-200',
                  )}>
                    {fac.name}
                  </span>
                  <span className="block text-[11px] text-slate-400">{fac.memberIds.length} anggota</span>
                </span>
                <ChevronRight size={14} className="text-slate-300 shrink-0" />
              </button>
            ))}
          </div>

          {/* Kanan: detail faksi terpilih */}
          {f.selected && <FactionDetail f={f} onOpenEntry={openCodexEntry} />}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-14 text-center text-slate-400">
      <Users size={40} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm max-w-md mx-auto">
        Belum ada faksi. Buka sebuah entri Codex (mis. "Kerajaan Merah"), aktifkan
        <b> "Jadikan Faksi / Kelompok"</b>, lalu beri tag keanggotaan yang sama pada
        anggota-anggotanya.
      </p>
    </div>
  );
}

function FactionDetail({
  f, onOpenEntry,
}: {
  f: ReturnType<typeof useFactions>; onOpenEntry: (id: number) => void;
}) {
  const sel = f.selected!;
  const [addingMember, setAddingMember] = React.useState(false);
  const [memberPick, setMemberPick] = React.useState('');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{sel.name}</h2>
          <p className="text-[11px] text-slate-400">
            Tag keanggotaan: <code className="text-slate-500 dark:text-slate-300">{sel.tag}</code> · {sel.memberIds.length} anggota
          </p>
        </div>
        <button
          onClick={() => onOpenEntry(sel.id)}
          className="shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <ExternalLink size={13} /> Buka entri
        </button>
      </div>

      {/* Anggota */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Anggota</h3>
          <button
            onClick={() => setAddingMember(v => !v)}
            className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <UserPlus size={12} /> Tambah anggota
          </button>
        </div>
        {addingMember && (
          <div className="flex gap-2 mb-3">
            <select
              value={memberPick}
              onChange={e => setMemberPick(e.target.value)}
              className="flex-1 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200"
            >
              <option value="">Pilih entri…</option>
              {f.nonMembers.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            <button
              onClick={async () => { if (memberPick) { await f.addMember(Number(memberPick)); setMemberPick(''); } }}
              disabled={!memberPick}
              className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50"
            >
              Tambah
            </button>
          </div>
        )}
        {f.members.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">Belum ada anggota. Beri tag "{sel.tag}" pada entri, atau pakai "Tambah anggota".</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {f.members.map(m => (
              <span key={m.id} className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200">
                <CategoryIcon category={m.category} categories={f.categories} size={12} />
                <button onClick={() => onOpenEntry(m.id!)} className="hover:underline max-w-[160px] truncate">{m.name}</button>
                <button onClick={() => f.removeMember(m.id!)} title="Lepas dari faksi" className="text-slate-400 hover:text-red-500">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Hubungan antar-faksi */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Hubungan dengan faksi lain</h3>
        {f.relationRows.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">Belum ada faksi lain untuk dibandingkan.</p>
        ) : (
          <div className="space-y-2">
            {f.relationRows.map(row => (
              <RelationRow key={row.faction.id} row={row} f={f} />
            ))}
          </div>
        )}
      </section>

      {/* Kohesi internal */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Kohesi internal</h3>
        <p className="text-[11px] text-slate-400 mb-1.5">Relasi antar-anggota faksi ini sendiri:</p>
        <TallyChips tally={f.internal} empty="belum ada relasi antar-anggota" />
      </section>
    </div>
  );
}

function RelationRow({ row, f }: { row: FactionRelationRow; f: ReturnType<typeof useFactions> }) {
  const [adding, setAdding] = React.useState(false);
  const [type, setType] = React.useState('Ally');
  const [note, setNote] = React.useState('');

  const declared = row.stat?.declared ?? [];

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{row.faction.name}</div>

          {/* Deklarasi */}
          <div className="mt-1.5">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">Deklarasi</div>
            {declared.length > 0 ? (
              <div className="space-y-1">
                {declared.map(r => (
                  <div key={r.id} className="flex items-start gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md shrink-0"
                      style={{ backgroundColor: `${styleOf(r.type).hex}22`, color: styleOf(r.type).hex }}>
                      {typeLabel(r.type)}
                    </span>
                    {r.description && <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">"{r.description}"</span>}
                    <button onClick={() => f.deleteRelation(r.id!)} title="Hapus deklarasi" className="text-slate-300 hover:text-red-500 ml-auto shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button onClick={() => setAdding(v => !v)} className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1">
                <Plus size={11} /> Tetapkan status
              </button>
            )}
          </div>

          {/* Potret turunan */}
          <div className="mt-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">
              Antar-anggota <span className="normal-case text-slate-300">(potret, bukan deklarasi)</span>
            </div>
            <TallyChips tally={row.stat?.derived ?? {}} empty="belum ada relasi antar-anggota" />
          </div>
        </div>
      </div>

      {/* Form tambah deklarasi */}
      {(adding || declared.length > 0) && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200"
          >
            {RELATIONSHIP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Catatan: kenapa? (opsional)"
            className="flex-1 min-w-[140px] px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200"
          />
          <button
            onClick={async () => { await f.addDeclaredRelation(row.faction.id, type, note); setNote(''); setAdding(false); }}
            className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium"
          >
            Tambah
          </button>
        </div>
      )}
    </div>
  );
}
