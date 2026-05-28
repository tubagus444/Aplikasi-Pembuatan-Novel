import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tag, Link2, Edit2, Trash2, X } from 'lucide-react';
import { CodexEntry, Relationship } from '@/src/types';
import { CategoryIcon } from '@/src/features/codex/components/CategoryIcon';
import { LinkifiedDescription } from '@/src/features/codex/components/LinkifiedDescription';
import { AppearancesList } from '@/src/features/codex/components/AppearancesList';

interface CodexCardProps {
  entry: CodexEntry;
  entries: CodexEntry[];
  relationships: Relationship[];
  projectId: number;
  linkingId: number | null;
  linkingTarget: number | null;
  linkingType: string;
  onSetLinkingTarget: (target: number | null) => void;
  onSetLinkingType: (type: string) => void;
  onToggleLinking: (id: number) => void;
  onAddBond: (sourceId: number) => void;
  onEdit: (entry: CodexEntry) => void;
  onDelete: (id: number) => void;
  onDeleteRelationship: (id: number) => void;
}

export function CodexCard({
  entry,
  entries,
  relationships,
  projectId,
  linkingId,
  linkingTarget,
  linkingType,
  onSetLinkingTarget,
  onSetLinkingType,
  onToggleLinking,
  onAddBond,
  onEdit,
  onDelete,
  onDeleteRelationship
}: CodexCardProps) {
  return (
    <motion.div 
      layout
      className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-800 transition-all relative flex flex-col col-span-1"
    >
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900 transition-colors">
              <CategoryIcon category={entry.category} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{entry.name}</h3>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                {entry.category}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => onToggleLinking(entry.id!)}
              className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-lg transition-all"
              title="Tambah Hubungan"
            >
              <Link2 size={16} />
            </button>
            <button 
              onClick={() => onEdit(entry)}
              className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-lg transition-all"
              title="Ubah Entri"
            >
              <Edit2 size={16} />
            </button>
            <button 
              onClick={() => onDelete(entry.id!)}
              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg transition-all"
              title="Hapus Entri"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        
        <AnimatePresence>
          {linkingId === entry.id && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mb-4 border border-slate-200 dark:border-slate-700 flex flex-col gap-3 shadow-inner">
                <div className="flex gap-2">
                  <select 
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={linkingType}
                    onChange={e => onSetLinkingType(e.target.value)}
                  >
                    <option value="Friend">Teman</option>
                    <option value="Enemy">Musuh</option>
                    <option value="Family">Keluarga</option>
                    <option value="Lover">Kekasih</option>
                    <option value="Ally">Sekutu</option>
                    <option value="Resides In">Tinggal di</option>
                    <option value="Owns">Memiliki</option>
                    <option value="Other">Lainnya</option>
                  </select>
                  <select
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none max-w-[120px]"
                    value={linkingTarget || ''}
                    onChange={e => onSetLinkingTarget(Number(e.target.value))}
                  >
                    <option value="">Pilih...</option>
                    {entries?.filter(e => e.id !== entry.id).map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end">
                   <button 
                     onClick={() => onAddBond(entry.id!)}
                     disabled={!linkingTarget}
                     className="text-[10px] font-bold uppercase tracking-widest bg-indigo-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-indigo-700 transition shadow-sm active:scale-95"
                   >
                     Simpan Hubungan
                   </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 border-t border-slate-100 dark:border-slate-800/60 pt-4">
          <div className="text-sm text-slate-600 dark:text-slate-400 line-clamp-4 leading-relaxed font-serif">
            {entry.description ? (
              <LinkifiedDescription text={entry.description} allEntries={entries || []} />
            ) : (
              <span className="italic opacity-60">Deskripsi belum diisi.</span>
            )}
          </div>
          <AppearancesList entry={entry} projectId={projectId} />
        </div>

        {(entry.aliases?.length ?? 0) > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
              <Tag size={12} /> Alias:
            </span>
            {entry.aliases!.map(a => (
              <span key={a} className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                {a}
              </span>
            ))}
          </div>
        )}

        {relationships && relationships.filter(r => r.sourceId === entry.id || r.targetId === entry.id).length > 0 && (
          <div className="mt-3 pt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
              <Link2 size={12} /> Hubungan:
            </span>
            {relationships.filter(r => r.sourceId === entry.id || r.targetId === entry.id).map(r => {
              const isSource = r.sourceId === entry.id;
              const otherId = isSource ? r.targetId : r.sourceId;
              const otherEntry = entries?.find(e => e.id === otherId);
              if (!otherEntry) return null;
              return (
                <span key={r.id} className="group/bond text-[11px] font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-800/50 flex items-center gap-1">
                  {r.type} <span className="opacity-50">dengan</span> {otherEntry.name}
                  <button onClick={() => onDeleteRelationship(r.id!)} className="opacity-0 group-hover/bond:opacity-100 text-indigo-400 hover:text-red-500 transition ml-1 shrink-0">
                    <X size={10} />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
