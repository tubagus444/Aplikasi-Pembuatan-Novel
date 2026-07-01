import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lightbulb, ChevronDown, Info, BookOpen, MousePointer2, Command, ShieldCheck,
  ArrowRight, Search, X, Puzzle,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { useUI } from '@/src/contexts/UIContext';
import {
  PALETTE, GROUPS, FEATURES, SMALL_FEATURES, TIPS, SHORTCUTS, CATS,
  featureMatches, smallMatches, type Feature, type CatId,
} from './guide/guideContent';

export function GuidePanel() {
  const [cat, setCat] = useState<CatId>('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { setViewMode } = useNavigation();
  const { setIsReplaceOpen, setIsExportOpen, setIsProjectManagerOpen } = useUI();

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const toggleCard = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runAction = (f: Feature) => {
    if (f.actionKey === 'replace') return setIsReplaceOpen(true);
    if (f.actionKey === 'export') return setIsExportOpen(true);
    if (f.actionKey === 'project') return setIsProjectManagerOpen(true);
    if (f.view) return setViewMode(f.view);
  };

  const visibleFeatures = useMemo(() => {
    let list = FEATURES;
    if (searching) list = list.filter((f) => featureMatches(f, q));
    else if (cat !== 'all' && cat !== 'small' && cat !== 'tips' && cat !== 'shortcut') {
      list = list.filter((f) => f.group === cat);
    }
    return list;
  }, [q, searching, cat]);

  const visibleSmall = useMemo(() => {
    if (searching) return SMALL_FEATURES.filter((s) => smallMatches(s, q));
    return SMALL_FEATURES;
  }, [q, searching]);

  const showFeatureGroups = searching || ['all', 'write', 'world', 'analysis', 'ai', 'output'].includes(cat);
  const showSmall = searching ? visibleSmall.length > 0 : cat === 'all' || cat === 'small';
  const showTips = !searching && (cat === 'all' || cat === 'tips');
  const showShortcuts = !searching && (cat === 'all' || cat === 'shortcut');

  const groupsToRender = GROUPS.filter((g) => {
    if (!showFeatureGroups) return false;
    if (searching) return visibleFeatures.some((f) => f.group === g.id);
    if (cat === 'all') return true;
    return g.id === cat;
  });

  const noResults = searching && visibleFeatures.length === 0 && visibleSmall.length === 0;

  const renderFeature = (f: Feature) => {
    const isOpen = searching || expanded.has(f.id);
    const pal = PALETTE[f.color];
    return (
      <div
        key={f.id}
        className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
      >
        {/* Baris header — hanya judul + lokasi, tanpa deskripsi (agar tak terpotong) */}
        <button
          type="button"
          onClick={() => !searching && toggleCard(f.id)}
          aria-expanded={isOpen}
          className="w-full text-left p-4 sm:p-5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
        >
          <div className={cn('w-11 h-11 shrink-0 rounded-xl flex items-center justify-center', pal.tint)}>
            <f.Icon className={cn('w-5 h-5', pal.icon)} />
          </div>
          <h3 className="flex-1 min-w-0 text-base font-bold text-slate-900 dark:text-white leading-tight">
            {f.title}
          </h3>
          <span className="hidden sm:inline-block shrink-0 text-[10px] font-bold uppercase tracking-tight text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full max-w-[40%] truncate">
            {f.where}
          </span>
          {!searching && (
            <ChevronDown size={18} className={cn('shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
          )}
        </button>

        {/* Detail — collapsible */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-4 sm:px-5 pb-5">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 p-4 sm:p-5">
                  {/* Badge lokasi untuk layar kecil */}
                  <div className="sm:hidden mb-3">
                    <span className="inline-block text-[10px] font-bold uppercase tracking-tight text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                      {f.where}
                    </span>
                  </div>

                  {/* Ringkasan */}
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed mb-5">
                    {f.what}
                  </p>

                  {/* Cara pakai */}
                  <div className="flex items-center gap-2 mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    <MousePointer2 size={13} className="text-indigo-500" /> Cara pakai
                  </div>
                  <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed marker:text-slate-400 marker:font-bold">
                    {f.steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>

                  {/* Detail & catatan */}
                  {f.detail && f.detail.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 mt-6 mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        <Info size={13} className="text-indigo-500" /> Detail &amp; catatan
                      </div>
                      <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed marker:text-slate-300 dark:marker:text-slate-600">
                        {f.detail.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    </>
                  )}

                  {/* Tips token */}
                  {f.tip && (
                    <div className="mt-5 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 px-3 py-2.5">
                      <Lightbulb size={15} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800 dark:text-amber-300 font-medium leading-relaxed">{f.tip}</p>
                    </div>
                  )}

                  {/* Aksi buka */}
                  {(f.view || f.actionKey) && (
                    <div className="mt-5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => runAction(f)}
                        className="flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 px-3.5 py-2 rounded-lg hover:opacity-90 active:scale-95 transition-all"
                      >
                        {f.openLabel ?? 'Buka'}
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24 pt-4 lg:pt-8">
      {/* Header ringkas */}
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-full mb-4 text-[11px] font-bold tracking-widest uppercase border border-indigo-100 dark:border-indigo-500/20">
          <Info size={13} /> Panduan Fitur
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-2">
          Semua fitur AetherScribe
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-2xl">
          Ruang kerja menulis novel yang berjalan sepenuhnya di perangkat Anda (local-first). Cari fitur lewat kotak di bawah, atau telusuri per kategori. Klik tiap fitur untuk melihat cara pakai & detailnya.
        </p>
      </header>

      {/* Toolbar: pencarian + kategori (sticky) */}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 mb-8">
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari fitur… (mis. snapshot, konsistensi, ekspor, token)"
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Bersihkan pencarian"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {CATS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setCat(c.id); setQuery(''); }}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                !searching && cat === c.id
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Konten */}
      <div className="space-y-12">
        {noResults && (
          <div className="text-center py-16">
            <Search className="mx-auto mb-4 text-slate-300 dark:text-slate-700" size={40} />
            <p className="text-slate-500 dark:text-slate-400 font-medium">Tidak ada fitur yang cocok dengan "{query}".</p>
          </div>
        )}

        {/* Grup fitur */}
        {groupsToRender.map((g) => {
          const items = visibleFeatures.filter((f) => f.group === g.id);
          if (items.length === 0) return null;
          return (
            <section key={g.id} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm', g.color)}>
                  <g.Icon size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{g.title}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{g.subtitle}</p>
                </div>
              </div>
              <div className="space-y-2.5">{items.map(renderFeature)}</div>
            </section>
          );
        })}

        {/* Fitur kecil & tersembunyi */}
        {showSmall && visibleSmall.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm bg-slate-700">
                <Puzzle size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Fitur Kecil & Tersembunyi</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Hal-hal mikro yang mudah lupa tapi mempercepat kerja.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {visibleSmall.map((s) => (
                <div key={s.title} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight mb-1">{s.title}</h4>
                  <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 mb-1.5">{s.where}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tips efisiensi */}
        {showTips && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm bg-amber-500">
                <Lightbulb size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Tips Efisiensi & Token</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Maksimalkan AI dengan cara yang cerdas dan hemat.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TIPS.map((t) => (
                <div key={t.title} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800 w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                    <t.Icon className={cn('w-4 h-4', t.color)} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 leading-tight">{t.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Shortcut & privasi */}
        {showShortcuts && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm bg-indigo-600">
                <Command size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Shortcut & Keamanan</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Navigasi cepat dan bagaimana data Anda dijaga.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <div className="space-y-3">
                  {SHORTCUTS.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-4">
                      <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{item.action}</span>
                      <kbd className="min-w-10 text-center bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-700 px-2 py-1 rounded text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shrink-0">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="text-emerald-500" size={20} />
                  <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Privasi & Keamanan</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                  Semua naskah dan kunci API disimpan <strong>lokal di browser</strong> (tidak ada server penyimpanan). Teks hanya dikirim ke penyedia AI yang Anda pilih saat sebuah fitur AI dijalankan.
                </p>
                <div className="space-y-2 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  <div className="flex items-center gap-2"><ChevronDown size={12} className="-rotate-90" /> Data tersimpan di perangkat (local-first)</div>
                  <div className="flex items-center gap-2"><ChevronDown size={12} className="-rotate-90" /> Kunci API milik Anda (BYOK)</div>
                  <div className="flex items-center gap-2"><ChevronDown size={12} className="-rotate-90" /> Backup otomatis + sinkronisasi Drive opsional</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Footer CTA ringkas */}
        {!searching && cat === 'all' && (
          <footer className="text-center py-10 border-t border-slate-100 dark:border-slate-800">
            <BookOpen className="mx-auto mb-4 text-slate-300 dark:text-slate-700" size={40} />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Butuh bantuan lebih?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6 leading-relaxed font-medium">
              Tanyakan langsung ke Studio Asisten tentang alur kerja atau fitur mana pun.
            </p>
            <button
              type="button"
              onClick={() => setViewMode('brainstorm')}
              className="inline-flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95"
            >
              Buka Studio Asisten
              <ArrowRight size={15} />
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
