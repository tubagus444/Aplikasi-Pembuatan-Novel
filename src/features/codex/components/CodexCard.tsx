import React from 'react';
import { motion } from 'motion/react';
import { Tag, Link2, Edit2, Trash2 } from 'lucide-react';
import { CodexEntry, Relationship } from '@/src/types';
import { CategoryIcon } from '@/src/features/codex/components/CategoryIcon';
import { LinkifiedDescription } from '@/src/features/codex/components/LinkifiedDescription';
import { AppearancesList } from '@/src/features/codex/components/AppearancesList';
import { getCategoryLabel, getCategoryAccent, type CategoryDef } from '@/src/lib/codexCategories';

interface CodexCardProps {
  entry: CodexEntry;
  entries: CodexEntry[];
  relationships: Relationship[];
  projectId: number;
  categories?: CategoryDef[];
  onEdit: (entry: CodexEntry) => void;
  onDelete: (id: number) => void;
  onSelect: (entry: CodexEntry) => void;
}

export function CodexCard({
  entry,
  entries,
  relationships,
  projectId,
  categories,
  onEdit,
  onDelete,
  onSelect,
}: CodexCardProps) {
  const accent = getCategoryAccent(entry.category, categories);
  const relCount = relationships.filter(r => r.sourceId === entry.id || r.targetId === entry.id).length;

  return (
    <motion.div
      layout
      onClick={() => onSelect(entry)}
      className="group h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 pl-7 hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-800 transition-all relative flex flex-col col-span-1 cursor-pointer overflow-hidden"
    >
      {/* #3 Aksen warna kategori (garis kiri) untuk pemindaian cepat */}
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${accent.bar}`} aria-hidden />

      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-xl shrink-0 ${accent.iconBg}`}>
              <CategoryIcon category={entry.category} categories={categories} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base truncate">{entry.name}</h3>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                {getCategoryLabel(entry.category, categories)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
              className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-lg transition-all"
              title="Ubah Entri"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(entry.id!); }}
              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg transition-all"
              title="Hapus Entri"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

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

        <div className="mt-3 flex items-center justify-between gap-2">
          {(entry.tags?.length ?? 0) > 0 ? (
            <div className="flex flex-wrap gap-1.5 min-w-0">
              {entry.tags!.map(t => (
                <span key={t} className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400">
                  #{t}
                </span>
              ))}
            </div>
          ) : <span />}

          {/* #1 Hubungan kini ringkas: badge jumlah (kelola di modal detail) */}
          {relCount > 0 && (
            <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1 rounded-full border border-indigo-100 dark:border-indigo-800/40">
              <Link2 size={12} /> {relCount} hubungan
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
