/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lensa Karakter — analitik per-karakter lintas-bab, murni lokal & TANPA AI.
 * Logika di src/lib/characterArc.ts; panel ini menyajikan & menautkan hasil.
 */

import React, { useState, useRef, useCallback } from 'react';
import { db } from '@/src/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Activity, ScanSearch, Loader2, Sparkles, Eye, Users, MapPin, Clock } from 'lucide-react';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { useProjectData } from '@/src/hooks/useProjectData';
import { stripHtml } from '@/src/lib/editorUtils';
import { PresenceIndex } from '@/src/lib/continuity';
import { buildPresenceIndexAsync } from '@/src/services/contextEngine';
import { computeCharacterArc, CharacterArc, ArcChapter } from '@/src/lib/characterArc';
import { cn } from '@/src/lib/utils';

interface CharacterArcPanelProps {
  projectId: number;
}

export function CharacterArcPanel({ projectId }: CharacterArcPanelProps) {
  const { setActiveChapterId, setViewMode } = useNavigation();
  const { codexEntries } = useProjectData(projectId);

  const chapters = useLiveQuery(() =>
    db.chapters.where('projectId').equals(projectId).sortBy('order')
  , [projectId]);

  const characters = codexEntries.filter(e => e.category === 'character');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [arc, setArc] = useState<CharacterArc | null>(null);

  // Index presence dibangun sekali per scan; ganti karakter memakai cache ini.
  const indexRef = useRef<PresenceIndex | null>(null);
  const arcChaptersRef = useRef<ArcChapter[]>([]);

  const openChapter = (id: number) => {
    setActiveChapterId(id);
    setViewMode('write');
  };

  const computeFor = (id: number) => {
    if (!indexRef.current) return;
    setArc(computeCharacterArc(id, arcChaptersRef.current, codexEntries, { index: indexRef.current }));
  };

  const scan = useCallback(async () => {
    if (!chapters || characters.length === 0) return;
    const targetId = selectedId ?? characters[0].id!;
    setSelectedId(targetId);
    setScanning(true);
    setArc(null);
    await new Promise(r => setTimeout(r, 0)); // yield agar overlay loading render
    const arcChapters: ArcChapter[] = chapters
      .filter(c => c.id != null)
      .map(c => ({ id: c.id!, title: c.title, content: stripHtml(c.content || ''), pov: c.pov }));
    arcChaptersRef.current = arcChapters;
    // Scan Aho-Corasick berat di worker agar main thread tak jank pada naskah besar.
    indexRef.current = await buildPresenceIndexAsync(arcChapters, codexEntries);
    setArc(computeCharacterArc(targetId, arcChapters, codexEntries, { index: indexRef.current }));
    setScanning(false);
  }, [chapters, characters, codexEntries, selectedId]);

  const onSelectChange = (id: number) => {
    setSelectedId(id);
    if (indexRef.current) computeFor(id); // sudah dipindai → recompute instan
  };

  const totalChapters = chapters?.length ?? 0;
  const maxCount = arc ? Math.max(1, ...arc.perChapter.map(c => c.count)) : 1;
  const chapterLabel = (i: number) => arc?.perChapter[i]?.title ?? `Bab ${i + 1}`;

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8 pb-20 w-full">
      {/* Header */}
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide uppercase border border-indigo-100 dark:border-indigo-800/50">
          <Activity size={14} />
          <span>Lensa Karakter</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-serif text-slate-900 dark:text-slate-100 tracking-tight">
          Alur Kemunculan Karakter
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed">
          Melacak "porsi layar" tiap karakter sepanjang manuskrip: di bab mana ia muncul dan seberapa sering, kapan ia hilang, bab ber-POV-nya, dan dengan siapa ia paling sering berbagi adegan. Sepenuhnya lokal — <span className="font-medium">tanpa AI, tanpa token</span>.
        </p>
      </header>

      {/* Kontrol */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Karakter</label>
          <select
            aria-label="Pilih karakter"
            value={selectedId ?? ''}
            onChange={(e) => onSelectChange(Number(e.target.value))}
            disabled={scanning || characters.length === 0}
            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 disabled:opacity-50"
          >
            {characters.length === 0 ? (
              <option value="">Belum ada karakter di Codex</option>
            ) : (
              <>
                {selectedId == null && <option value="" disabled>Pilih karakter…</option>}
                {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </>
            )}
          </select>
        </div>
        <button
          onClick={scan}
          disabled={scanning || totalChapters === 0 || characters.length === 0}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm hover:shadow-md"
        >
          {scanning ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} />}
          {scanning ? 'Memindai…' : indexRef.current ? 'Pindai Ulang' : 'Pindai Manuskrip'}
        </button>
        <p className="text-xs text-slate-400 dark:text-slate-500 sm:ml-auto self-center">{totalChapters} bab</p>
      </div>

      {/* Hasil */}
      {arc && !scanning && (
        <div className="space-y-8">
          {/* Statistik */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Sparkles size={14} />} label="Total sebutan" value={arc.totalMentions} accent="text-indigo-600 dark:text-indigo-400" />
            <StatCard icon={<MapPin size={14} />} label="Bab muncul" value={`${arc.chaptersPresent}/${totalChapters}`} />
            <StatCard icon={<Eye size={14} />} label="Bab POV" value={arc.povCount} />
            <StatCard icon={<Clock size={14} />} label="Absen terlama" value={`${arc.longestAbsence} bab`} />
          </div>

          {arc.chaptersPresent === 0 ? (
            <div className="text-center py-12 px-6 border-2 border-dashed border-amber-200 dark:border-amber-800/50 rounded-3xl bg-amber-50/40 dark:bg-amber-900/10">
              <p className="text-slate-600 dark:text-slate-300 text-sm">
                <span className="font-semibold">{arc.name}</span> tidak ditemukan di teks bab mana pun. Periksa ejaan nama/alias di Codex.
              </p>
            </div>
          ) : (
            <>
              {/* Grafik screen-time */}
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Porsi layar per bab</h2>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm overflow-x-auto custom-scrollbar">
                  <div className="flex items-end gap-[3px] min-w-max h-32">
                    {arc.perChapter.map((c) => (
                      <button
                        key={c.chapterId}
                        onClick={() => openChapter(c.chapterId)}
                        title={`${c.title}${c.count ? ` — ${c.count}× sebutan` : ' — tak muncul'}${c.isPov ? ' · POV' : ''}`}
                        className="group relative flex flex-col items-center justify-end h-full w-3 shrink-0"
                      >
                        {c.isPov && <span className="absolute -top-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-900" />}
                        <span
                          className={cn(
                            'w-full rounded-sm transition-colors',
                            c.count > 0
                              ? 'bg-indigo-400 group-hover:bg-indigo-600 dark:bg-indigo-500 dark:group-hover:bg-indigo-400'
                              : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200'
                          )}
                          style={{ height: c.count > 0 ? `${Math.max(8, (c.count / maxCount) * 100)}%` : '4px' }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2 flex-wrap">
                  <span>Tiap batang = satu bab (urut); tinggi = jumlah sebutan. Klik untuk membuka bab.</span>
                  <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> = bab ber-POV {arc.name}</span>
                </p>
              </section>

              {/* Ko-kemunculan */}
              {arc.coAppearances.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Users size={15} /> Paling sering bersama
                  </h2>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2.5">
                    {arc.coAppearances.map(co => (
                      <div key={co.entityId} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 truncate text-xs font-medium text-slate-600 dark:text-slate-300 text-right" title={co.name}>{co.name}</span>
                        <div className="flex-1 h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-indigo-400 dark:bg-indigo-500 rounded-full"
                            style={{ width: `${(co.sharedChapters / arc.chaptersPresent) * 100}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">{co.sharedChapters} bab</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {!arc && !scanning && (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50">
          <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-5">
            <Activity size={24} className="text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
            {characters.length === 0 ? 'Belum ada karakter' : 'Belum dipindai'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
            {characters.length === 0
              ? 'Tambahkan karakter di Kamus Data terlebih dahulu untuk melihat alur kemunculannya.'
              : <>Pilih karakter lalu klik <span className="font-medium">Pindai Manuskrip</span> untuk melihat porsi layar dan ko-kemunculannya.</>}
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number | string; accent?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mb-1">{icon}</div>
      <p className={cn('text-2xl font-bold tabular-nums', accent ?? 'text-slate-900 dark:text-slate-100')}>{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
