import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Tag, Link2, X, Edit2, Trash2, FlaskConical, Crosshair, EyeOff, Dices, Quote, CornerDownRight } from 'lucide-react';
import { CodexEntry, Relationship, PlotPromise } from '@/src/types';
import { buildLoreGraph } from '@/src/lib/loreGraph';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { QuickPromiseModal } from '@/src/features/consistency/components/QuickPromiseModal';
import { NameForgeModal } from '@/src/features/codex/components/NameForgeModal';
import { CategoryIcon } from '@/src/features/codex/components/CategoryIcon';
import { LinkifiedDescription } from '@/src/features/codex/components/LinkifiedDescription';
import { AppearancesList } from '@/src/features/codex/components/AppearancesList';
import { getRelationshipLabel, RELATIONSHIP_TYPES } from '@/src/features/codex/relationshipTypes';
import { getCategoryLabel, getCategoryAccent, type CategoryDef } from '@/src/lib/codexCategories';
import { resolveFieldValues } from '@/src/lib/codexFields';

interface CodexDetailModalProps {
  entry: CodexEntry;
  entries: CodexEntry[];
  relationships: Relationship[];
  promises?: PlotPromise[];
  projectId: number;
  categories?: CategoryDef[];
  onClose: () => void;
  onEdit: (entry: CodexEntry) => void;
  onDelete: (id: number) => void;
  onAddBond: (sourceId: number, targetId: number, type: string) => void;
  onDeleteRelationship: (id: number) => void;
  onOpenEntry?: (entry: CodexEntry) => void;
}

export function CodexDetailModal({
  entry,
  entries,
  relationships,
  promises,
  projectId,
  categories,
  onClose,
  onEdit,
  onDelete,
  onAddBond,
  onDeleteRelationship,
  onOpenEntry
}: CodexDetailModalProps) {
  const entryRelationships = relationships.filter(
    r => r.sourceId === entry.id || r.targetId === entry.id
  );
  const accent = getCategoryAccent(entry.category, categories);
  const linkTargets = entries.filter(e => e.id !== entry.id);
  const fieldValues = resolveFieldValues(entry);

  // Backlink (#9): siapa yang menunjuk ke entri ini. Relasi sengaja DIKELUARKAN —
  // sudah tampil dua-arah di seksi "Hubungan"; sisakan sebutan-nama & payoff janji
  // yang selama ini tak terlihat dari sisi entri yang ditunjuk.
  const mentionBacklinks = useMemo(() => {
    if (entry.id == null) return [];
    const { backlinks } = buildLoreGraph(entries, relationships, promises || []);
    return (backlinks.get(entry.id) || []).filter(l => l.via !== 'relationship');
  }, [entry.id, entries, relationships, promises]);

  const { openWorkshop } = useNavigation();
  const [bondType, setBondType] = useState('Friend');
  const [bondTarget, setBondTarget] = useState<number | ''>('');
  const [showPromise, setShowPromise] = useState(false);
  const [showForge, setShowForge] = useState(false);

  const handleAddBond = () => {
    if (!bondTarget) return;
    onAddBond(entry.id!, Number(bondTarget), bondType);
    setBondTarget('');
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", bounce: 0, duration: 0.3 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 ${accent.iconBg}`}>
              <CategoryIcon category={entry.category} categories={categories} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{entry.name}</h2>
                {entry.hidden && (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800/60">
                    <EyeOff size={11} /> Rahasia
                  </span>
                )}
              </div>
              <span className="text-xs uppercase tracking-widest font-bold text-indigo-500 dark:text-indigo-400">
                {getCategoryLabel(entry.category, categories)}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPromise(true)}
              className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/40 rounded-xl transition-all"
              title="Tandai sebagai Janji Plot (Chekhov's Gun)"
            >
              <Crosshair size={20} />
            </button>
            <button
              onClick={() => setShowForge(true)}
              className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-xl transition-all"
              title="Bengkel Nama — generator & glos nama (palet fonotaktik)"
            >
              <Dices size={20} />
            </button>
            <button
              onClick={() => { onClose(); openWorkshop({ mode: 'edit', entryId: entry.id!, seedName: entry.name }); }}
              className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-xl transition-all"
              title="Diskusikan & sempurnakan dengan AI (Lokakarya)"
            >
              <FlaskConical size={20} />
            </button>
            <button
              onClick={() => { onClose(); onEdit(entry); }}
              className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-xl transition-all"
              title="Ubah Entri"
            >
              <Edit2 size={20} />
            </button>
            <button 
              onClick={() => { onClose(); onDelete(entry.id!); }}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-xl transition-all"
              title="Hapus Entri"
            >
              <Trash2 size={20} />
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              title="Tutup"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-8 overflow-y-auto">
          {/* Aliases */}
          {(entry.aliases?.length ?? 0) > 0 && (
            <div className="mb-8 flex flex-wrap gap-2 items-center">
              <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mr-2">
                <Tag size={14} /> Alias:
              </span>
              {entry.aliases!.map(a => (
                <span key={a} className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  {a}
                </span>
              ))}
            </div>
          )}

          {/* Tags */}
          {(entry.tags?.length ?? 0) > 0 && (
            <div className="mb-8 flex flex-wrap gap-2 items-center">
              {entry.tags!.map(t => (
                <span key={t} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          <div className="prose prose-slate dark:prose-invert max-w-none font-serif text-slate-700 dark:text-slate-300 leading-relaxed text-lg mb-10">
            {entry.description ? (
              <LinkifiedDescription text={entry.description} allEntries={entries || []} />
            ) : (
              <span className="italic opacity-60">Deskripsi belum diisi.</span>
            )}
          </div>

          {/* Template field per kategori (#17) — detail terstruktur khas kategori */}
          {fieldValues.length > 0 && (
            <div className="mb-10 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-5">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                {fieldValues.map(f => (
                  <div key={f.key} className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{f.label}</dt>
                    <dd className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Kebenaran tersembunyi — hanya untuk penulis, tak pernah ke output pembaca */}
          {entry.secret?.trim() && (
            <div className="mb-10 rounded-2xl border border-purple-200 dark:border-purple-800/50 bg-purple-50/50 dark:bg-purple-900/15 p-5">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-purple-700 dark:text-purple-300 mb-2">
                <EyeOff size={14} /> Kebenaran Tersembunyi
                <span className="font-normal normal-case tracking-normal text-purple-400 dark:text-purple-500">· hanya penulis &amp; AI</span>
              </h4>
              <p className="font-serif text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{entry.secret.trim()}</p>
            </div>
          )}

          {/* Backlink (#9) — "apa yang menyebut entri ini" (sebutan nama + payoff janji) */}
          {mentionBacklinks.length > 0 && (
            <div className="mb-10">
              <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-2">
                <Quote size={16} /> Disebut oleh
              </h4>
              <div className="flex flex-wrap gap-2">
                {mentionBacklinks.map(link => {
                  if (link.via === 'payoff') {
                    return (
                      <span
                        key={`payoff-${link.sourceId}`}
                        className="inline-flex items-center gap-1.5 text-sm bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 px-3 py-2 rounded-xl border border-rose-100 dark:border-rose-800/50"
                        title="Janji plot yang dibayar/diungkap oleh entri ini"
                      >
                        <Crosshair size={13} className="shrink-0" />
                        <span className="font-semibold truncate max-w-[220px]">{link.sourceName}</span>
                        <span className="text-rose-400 dark:text-rose-500 text-xs">· janji</span>
                      </span>
                    );
                  }
                  const source = entries.find(e => e.id === link.sourceId);
                  return (
                    <button
                      key={`mention-${link.sourceId}`}
                      onClick={() => source && onOpenEntry?.(source)}
                      disabled={!source || !onOpenEntry}
                      className="group/back inline-flex items-center gap-1.5 text-sm bg-indigo-50/60 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-3 py-2 rounded-xl border border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:hover:bg-indigo-50/60 dark:disabled:hover:bg-indigo-900/20 transition-all disabled:cursor-default"
                      title={source ? `Buka ${link.sourceName}` : link.sourceName}
                    >
                      <CornerDownRight size={13} className="shrink-0 opacity-60" />
                      <span className="font-semibold truncate max-w-[220px]">{link.sourceName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Relationships — dikelola di sini (tambah/hapus) */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-2">
                <Link2 size={16} /> Hubungan
              </h4>
              <div className="flex flex-col gap-2">
                {entryRelationships.map(r => {
                  const isSource = r.sourceId === entry.id;
                  const otherId = isSource ? r.targetId : r.sourceId;
                  const otherEntry = entries?.find(e => e.id === otherId);
                  if (!otherEntry) return null;
                  return (
                    <div key={r.id} className="group/bond flex items-center justify-between gap-2 bg-indigo-50/50 dark:bg-indigo-900/20 px-4 py-3 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-indigo-700 dark:text-indigo-400 text-sm shrink-0">{getRelationshipLabel(r.type, isSource)}</span>
                        <span className="text-indigo-400 dark:text-indigo-600 text-sm shrink-0">dengan</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 truncate">{otherEntry.name}</span>
                      </div>
                      <button
                        onClick={() => onDeleteRelationship(r.id!)}
                        className="shrink-0 p-1 text-indigo-300 dark:text-indigo-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-lg opacity-0 group-hover/bond:opacity-100 focus:opacity-100 transition-all"
                        title="Hapus hubungan"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
                {entryRelationships.length === 0 && (
                  <p className="text-sm text-slate-400 dark:text-slate-500 italic">Belum ada hubungan.</p>
                )}
              </div>

              {/* Tambah hubungan */}
              {linkTargets.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    value={bondType}
                    onChange={e => setBondType(e.target.value)}
                    title="Tipe hubungan"
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-200"
                  >
                    {RELATIONSHIP_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <select
                    value={bondTarget}
                    onChange={e => setBondTarget(e.target.value ? Number(e.target.value) : '')}
                    title="Entri tujuan"
                    className="flex-1 min-w-[120px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-200"
                  >
                    <option value="">Pilih entri…</option>
                    {linkTargets.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddBond}
                    disabled={!bondTarget}
                    className="text-[10px] font-bold uppercase tracking-widest bg-indigo-600 text-white px-3 py-2 rounded-lg disabled:opacity-50 hover:bg-indigo-700 transition shadow-sm active:scale-95"
                  >
                    Tambah
                  </button>
                </div>
              )}
            </div>

            {/* Appearances */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
                Kemunculan
              </h4>
               <AppearancesList entry={entry} projectId={projectId} />
            </div>
          </div>
        </div>
      </motion.div>

      {showPromise && (
        <QuickPromiseModal
          seed={{ projectId, title: entry.name, codexId: entry.id!, codexName: entry.name }}
          onClose={() => setShowPromise(false)}
        />
      )}

      {showForge && (
        <NameForgeModal entry={entry} onClose={() => setShowForge(false)} />
      )}
    </div>
  );
}
