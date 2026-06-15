import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Tag, Link2, X, Edit2, Trash2 } from 'lucide-react';
import { CodexEntry, Relationship } from '@/src/types';
import { CategoryIcon } from '@/src/features/codex/components/CategoryIcon';
import { LinkifiedDescription } from '@/src/features/codex/components/LinkifiedDescription';
import { AppearancesList } from '@/src/features/codex/components/AppearancesList';
import { getRelationshipLabel } from '@/src/features/codex/relationshipTypes';

interface CodexDetailModalProps {
  entry: CodexEntry;
  entries: CodexEntry[];
  relationships: Relationship[];
  projectId: number;
  onClose: () => void;
  onEdit: (entry: CodexEntry) => void;
  onDelete: (id: number) => void;
}

export function CodexDetailModal({
  entry,
  entries,
  relationships,
  projectId,
  onClose,
  onEdit,
  onDelete
}: CodexDetailModalProps) {
  const entryRelationships = relationships.filter(
    r => r.sourceId === entry.id || r.targetId === entry.id
  );

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
            <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
              <CategoryIcon category={entry.category} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{entry.name}</h2>
              <span className="text-xs uppercase tracking-widest font-bold text-indigo-500 dark:text-indigo-400">
                {entry.category}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Relationships */}
            {entryRelationships.length > 0 && (
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
                      <div key={r.id} className="flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-900/20 px-4 py-3 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-indigo-700 dark:text-indigo-400 text-sm">{getRelationshipLabel(r.type, isSource)}</span>
                          <span className="text-indigo-400 dark:text-indigo-600 text-sm">dengan</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{otherEntry.name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
    </div>
  );
}
