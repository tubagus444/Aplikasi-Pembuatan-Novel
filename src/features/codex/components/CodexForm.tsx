import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Edit2, Plus, X, Wand2, Check, Undo2, AlertTriangle, ClipboardPaste, EyeOff } from 'lucide-react';
import { CodexEntry, CodexCategory } from '@/src/types';
import { cn } from '@/src/lib/utils';
import { expandCodexEntry } from '@/src/services/ai';
import { useToast } from '@/src/hooks/useToast';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { BUILTIN_CATEGORIES, type CategoryDef } from '@/src/lib/codexCategories';
import { parseCodexMarkdown } from '@/src/lib/codexImport';

interface CodexFormProps {
  initialData?: Partial<CodexEntry>;
  editingId: number | null;
  bibleRules: any[];
  existingEntries?: CodexEntry[];
  categories?: CategoryDef[];
  onSave: (data: Partial<CodexEntry>) => Promise<void>;
  /** Buat banyak entri sekaligus dari paste multi-blok (importer #7). Kembalikan jumlah yang dibuat. */
  onBulkCreate?: (entries: Partial<CodexEntry>[]) => Promise<number>;
  onCancel: () => void;
}

export function CodexForm({ initialData, editingId, bibleRules, existingEntries = [], categories = BUILTIN_CATEGORIES, onSave, onBulkCreate, onCancel }: CodexFormProps) {
  const { toast } = useToast();
  const { setViewMode } = useNavigation();
  const [formData, setFormData] = useState<Partial<CodexEntry>>({
    name: '',
    category: 'character',
    description: '',
    aliases: [],
    tags: [],
    ...initialData
  });
  const [isExpanding, setIsExpanding] = useState(false);
  // Deskripsi sebelum di-overwrite AI; menyimpannya memungkinkan "Urungkan"
  // tanpa risiko kehilangan tulisan pengguna. null = tidak ada yang bisa diurungkan.
  const [prevDescription, setPrevDescription] = useState<string | null>(null);
  // Paste-quick-add: tempel teks lore terstruktur → engine parser mengisi form.
  // Hanya untuk entri baru; deterministik & nol token (src/lib/codexImport).
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');

  useEffect(() => {
    setFormData({
      name: '',
      category: 'character',
      description: '',
      aliases: [],
      tags: [],
      ...initialData
    });
    setPrevDescription(null);
  }, [initialData]);

  const trimmedName = formData.name?.trim().toLowerCase() ?? '';
  const isDuplicateName = trimmedName.length > 0 && existingEntries.some(
    e => e.id !== editingId && e.name.trim().toLowerCase() === trimmedName
  );

  const handleExpand = async () => {
    if (!formData.name) return;
    setIsExpanding(true);
    try {
      const expandedDesc = await expandCodexEntry(
        formData.name,
        formData.category || 'character',
        formData.description || '',
        bibleRules || []
      );
      setPrevDescription(formData.description || '');
      setFormData(prev => ({ ...prev, description: expandedDesc }));
    } catch (e: any) {
      if (e.code === 'INVALID_KEY' || e.code === 'QUOTA_EXCEEDED') {
        toast.error(e.message, {
          action: {
            label: 'Buka Pengaturan',
            onClick: () => setViewMode('settings')
          }
        });
      } else {
        toast.error('Failed to expand: ' + e.message);
      }
    } finally {
      setIsExpanding(false);
    }
  };

  const handleUndoExpand = () => {
    if (prevDescription === null) return;
    setFormData(prev => ({ ...prev, description: prevDescription }));
    setPrevDescription(null);
  };

  const handleFillFromPaste = () => {
    const parsed = parseCodexMarkdown(pasteText, { defaultCategory: formData.category || 'character' });
    if (parsed.length === 0) {
      toast.error('Tak ada teks untuk mengisi form.');
      return;
    }
    const first = parsed[0];
    setFormData(prev => ({
      ...prev,
      name: first.name,
      category: first.category as CodexCategory,
      description: first.description,
      aliases: first.aliases.length ? first.aliases : prev.aliases,
      tags: first.tags.length ? first.tags : prev.tags,
    }));
    setPrevDescription(null);
    setShowPaste(false);
    setPasteText('');
    toast.info(
      parsed.length > 1
        ? `${parsed.length} blok terdeteksi — blok pertama dipakai (tinjau lalu simpan). Pakai "Buat semua" untuk semuanya.`
        : 'Form terisi dari teks — tinjau lalu simpan.'
    );
  };

  // Pratinjau jumlah entri "layak" (heading struktural/pemisah dibuang) untuk tombol
  // "Buat semua". Deterministik & nol token — sama engine dengan paste-quick-add.
  const bulkEntries = React.useMemo(
    () =>
      showPaste && pasteText.trim()
        ? parseCodexMarkdown(pasteText, {
            defaultCategory: formData.category || 'character',
            dropStructural: true,
          })
        : [],
    [showPaste, pasteText, formData.category]
  );

  const handleBulkCreateFromPaste = async () => {
    if (!onBulkCreate || bulkEntries.length === 0) return;
    const count = await onBulkCreate(
      bulkEntries.map(p => ({
        name: p.name,
        category: p.category as CodexCategory,
        description: p.description,
        aliases: p.aliases,
        tags: p.tags,
      }))
    );
    // Form ditutup oleh onBulkCreate; toast mengonfirmasi hasil.
    if (count > 0) toast.success(`${count} entri dibuat — tinjau di daftar Codex.`);
  };

  return (
    <motion.div 
      data-codex-form
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg col-span-full overflow-hidden"
    >
      <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          {editingId ? <Edit2 size={18} className="text-indigo-500" /> : <Plus size={18} className="text-indigo-500" />}
          {editingId ? 'Ubah Entri' : 'Entri Codex Baru'}
        </h3>
        <div className="flex items-center gap-1">
          {!editingId && (
            <button
              type="button"
              onClick={() => setShowPaste(v => !v)}
              className={cn(
                "flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full transition-all border",
                showPaste
                  ? "bg-indigo-600 text-white border-transparent"
                  : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
              )}
              title="Tempel teks lore untuk mengisi form otomatis (tanpa AI)"
            >
              <ClipboardPaste size={12} /> Tempel teks
            </button>
          )}
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="p-6">
        {!editingId && showPaste && (
          <div className="mb-6 rounded-xl border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-900/10 p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tempel teks lore (Markdown/polos) — isi form otomatis
              </label>
              <button type="button" onClick={() => setShowPaste(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X size={16} />
              </button>
            </div>
            <textarea
              autoFocus
              className="w-full min-h-[120px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100 resize-y font-mono"
              placeholder={"Tempel satu blok, mis.:\n#### Ironhaven — Kota Dermaga\nKota di sisi barat Kelmar..."}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Heading → Nama; sisanya → Deskripsi. Hasil bisa disunting sebelum disimpan.
              </p>
              <div className="flex shrink-0 items-center gap-2">
                {onBulkCreate && bulkEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={handleBulkCreateFromPaste}
                    title="Buat langsung semua entri terdeteksi (tanpa tinjau satu per satu)"
                    className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-full transition-all border bg-emerald-600 text-white border-transparent hover:bg-emerald-700"
                  >
                    <Plus size={12} /> Buat semua {bulkEntries.length} entri
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleFillFromPaste}
                  disabled={!pasteText.trim()}
                  className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-full transition-all border bg-indigo-600 text-white border-transparent hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check size={12} /> Isi form dari teks
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nama Entri *</label>
              <input 
                autoFocus
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-100"
                placeholder="misal: Kota Angin"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
              {isDuplicateName && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-500">
                  <AlertTriangle size={12} className="shrink-0" />
                  Sudah ada entri dengan nama ini — nama ganda bisa membingungkan injeksi konteks AI.
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Kategori</label>
              <select 
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-100"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value as CodexCategory})}
              >
                {categories.map(cat => (
                  <option key={cat.slug} value={cat.slug}>{cat.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Alias</label>
              <input
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-100"
                placeholder="Pisahkan dengan koma (misal: Budi, Pak Budi)"
                value={formData.aliases?.join(', ')}
                onChange={e => setFormData({...formData, aliases: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Tag</label>
              <input
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-100"
                placeholder="Pisahkan dengan koma (misal: protagonis, bangsawan)"
                value={formData.tags?.join(', ')}
                onChange={e => setFormData({...formData, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
              />
            </div>
          </div>

          <div className="md:col-span-2 flex flex-col h-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Deskripsi (Mendukung Markdown) *</label>
              <div className="flex items-center gap-2">
                {prevDescription !== null && !isExpanding && (
                  <button
                    type="button"
                    onClick={handleUndoExpand}
                    className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full transition-all border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    title="Kembalikan deskripsi sebelum dikembangkan AI"
                  >
                    <Undo2 size={12} />
                    Urungkan
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExpand}
                  disabled={isExpanding || !formData.name}
                  className={cn(
                    "flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full transition-all border",
                    isExpanding
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent animate-pulse"
                      : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  title={!formData.name ? "Masukkan nama terlebih dahulu" : "Buat lore detail menggunakan AI berdasarkan Nama dan Kategori"}
                >
                  <Wand2 size={12} className={isExpanding ? "animate-spin" : ""} />
                  {isExpanding ? "Mengembangkan..." : "Kembangkan dengan AI"}
                </button>
              </div>
            </div>
            <textarea 
              className="w-full flex-1 min-h-[160px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:text-slate-100 resize-y font-serif leading-relaxed"
              placeholder="Deskripsikan sejarah atau sifat unik untuk memberi konteks pada AI..."
              value={formData.description}
              onChange={e => {
                setFormData({...formData, description: e.target.value});
                if (prevDescription !== null) setPrevDescription(null);
              }}
            />
          </div>
        </div>

        {/* Lapis "Kebenaran Tersembunyi" — kanon vs rahasia penulis */}
        <div className="mt-6 rounded-xl border border-purple-200 dark:border-purple-800/50 bg-purple-50/40 dark:bg-purple-900/10 p-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!formData.hidden}
              onChange={e => setFormData({ ...formData, hidden: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-purple-800 dark:text-purple-300">
                <EyeOff size={14} /> Rahasia penulis (sembunyikan entri dari pembaca)
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Entri disaring dari sorotan editor, saran, dan ekspor Codex — tetapi tetap
                diberikan ke AI agar Cek Konsistensi bisa menangkap kebocoran.
              </span>
            </span>
          </label>

          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Kebenaran tersembunyi <span className="font-normal text-slate-400">(opsional — hanya untuk AI &amp; penulis)</span>
            </label>
            <textarea
              className="w-full min-h-[80px] bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow dark:text-slate-100 resize-y font-serif leading-relaxed"
              placeholder={"Pola “Dunia percaya… / Yang sebenarnya…”.\nMis.: Dunia percaya Sang Raja bijak; sebenarnya ia dalang kudeta."}
              value={formData.secret ?? ''}
              onChange={e => setFormData({ ...formData, secret: e.target.value })}
            />
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              Tak pernah muncul di prosa/ekspor. Diumpankan ke AI sebagai kanon rahasia agar
              narasi tak keceplosan sebelum reveal.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
          >
            Batal
          </button>
          <button 
            onClick={() => onSave(formData)}
            disabled={!formData.name?.trim() || !formData.description?.trim()}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <Check size={16} /> {editingId ? 'Simpan Perubahan' : 'Buat Entri'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
