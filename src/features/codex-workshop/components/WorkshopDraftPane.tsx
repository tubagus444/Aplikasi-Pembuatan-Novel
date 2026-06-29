import React from 'react';
import { Wand2, Check, AlertTriangle, Loader2, Database } from 'lucide-react';
import { CodexEntry, CodexCategory } from '@/src/types';
import { cn } from '@/src/lib/utils';
import type { CategoryDef } from '@/src/lib/codexCategories';

interface WorkshopDraftPaneProps {
  draft: Partial<CodexEntry>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<CodexEntry>>>;
  categories: CategoryDef[];
  isDuplicateName: boolean;
  isHarvesting: boolean;
  onHarvest: () => void;
  isSaving: boolean;
  canSave: boolean;
  onSave: () => void;
  /** 'edit' menampilkan badge perubahan per-field & label tombol "Simpan perubahan". */
  mode: 'create' | 'edit';
  /** Nama field yang berbeda dari entri asli (mode edit). */
  changedFields: Set<string>;
}

/** Badge kecil penanda field yang berubah dari entri asli. */
function ChangedBadge() {
  return (
    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
      diubah
    </span>
  );
}

/**
 * Kolom kanan Lokakarya: field draf entitas Codex. Mengikuti susunan & validasi
 * CodexForm (nama wajib, deskripsi wajib, peringatan nama ganda), tapi vertikal
 * dan hidup berdampingan dengan chat. Fase 1: hanya mode buat-baru.
 */
export function WorkshopDraftPane({
  draft,
  setDraft,
  categories,
  isDuplicateName,
  isHarvesting,
  onHarvest,
  isSaving,
  canSave,
  onSave,
  mode,
  changedFields,
}: WorkshopDraftPaneProps) {
  return (
    <div className="w-full md:w-[380px] shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full">
      <div className="h-14 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 px-5 bg-slate-50 dark:bg-slate-800/50 shrink-0">
        <Database size={16} className="text-indigo-500" />
        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 tracking-tight">Draf Entitas</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Nama Entri * {changedFields.has('name') && <ChangedBadge />}
          </label>
          <input
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-100"
            placeholder="misal: Aldric"
            value={draft.name ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          {isDuplicateName && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-500">
              <AlertTriangle size={12} className="shrink-0" />
              Sudah ada entri dengan nama ini — nama ganda bisa membingungkan injeksi konteks AI.
            </p>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Kategori {changedFields.has('category') && <ChangedBadge />}
          </label>
          <select
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-100"
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as CodexCategory }))}
          >
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>{cat.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Alias {changedFields.has('aliases') && <ChangedBadge />}
          </label>
          <input
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-100"
            placeholder="Pisahkan dengan koma"
            value={draft.aliases?.join(', ') ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, aliases: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))}
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Tag {changedFields.has('tags') && <ChangedBadge />}
          </label>
          <input
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-100"
            placeholder="Pisahkan dengan koma (misal: protagonis)"
            value={draft.tags?.join(', ') ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))}
          />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Deskripsi (Markdown) * {changedFields.has('description') && <ChangedBadge />}
            </label>
            <button
              type="button"
              onClick={onHarvest}
              disabled={isHarvesting || !draft.name?.trim()}
              className={cn(
                'flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full transition-all border',
                isHarvesting
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent animate-pulse'
                  : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title={!draft.name?.trim() ? 'Isi Nama terlebih dahulu' : 'Ringkas diskusi menjadi field entri menggunakan AI'}
            >
              <Wand2 size={12} className={isHarvesting ? 'animate-spin' : ''} />
              {isHarvesting ? 'Menarik...' : 'Tarik dari diskusi'}
            </button>
          </div>
          <textarea
            className="w-full min-h-[200px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-100 resize-y font-serif leading-relaxed"
            placeholder="Hasil diskusi muncul di sini — atau tulis sendiri. Deskripsi inilah yang dibaca AI sebagai lore."
            value={draft.description ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <button
          onClick={onSave}
          disabled={!canSave}
          className="w-full px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {isSaving ? 'Menyimpan...' : mode === 'edit' ? 'Simpan perubahan' : 'Simpan ke Codex'}
        </button>
      </div>
    </div>
  );
}
