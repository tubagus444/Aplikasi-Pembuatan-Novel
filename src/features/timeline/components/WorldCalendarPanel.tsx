/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Panel Kalender Dunia (#4, viewMode 'worldcalendar') — tampilan visual atas Timeline
 * yang sama (tabel `timeline`), BUKAN data tandingan. Membaca `Project.calendar` +
 * event ber-`startDate`; grid/pita musim/pengelompokan murni turunan dari
 * `src/lib/worldCalendar.ts`. Event tanpa `startDate` tetap di Timeline daftar, tak di
 * grid. Cek kelayakan tanggal = fase 2 (belum dibangun).
 */

import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDays, CalendarCog, CalendarPlus, ChevronLeft, ChevronRight, ChevronDown, Plus, BookText, Users, Search, X, Filter,
} from 'lucide-react';
import { db } from '@/src/db';
import { useProjectData } from '@/src/hooks/useProjectData';
import { TimelineEvent, WorldCalendar, WorldDate } from '@/src/types';
import {
  compareDate, daysInMonth, seasonForMonth, weekdayOfFirst, dayOfWeek,
  eraLabel, eraAbbr, formatDateRange, calendarPreset, CalendarPreset,
} from '@/src/lib/worldCalendar';
import { cn } from '@/src/lib/utils';
import { CalendarEditorModal } from './CalendarEditorModal';
import { CalendarEventModal, CalendarEventSeed } from './CalendarEventModal';

interface Props { projectId: number; }

export function WorldCalendarPanel({ projectId }: Props) {
  const { codexEntries } = useProjectData(projectId);
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const events = useLiveQuery(() => db.timeline.where('projectId').equals(projectId).toArray(), [projectId]);
  const chapters = useLiveQuery(() => db.chapters.where('projectId').equals(projectId).sortBy('order'), [projectId]);

  const cal = project?.calendar;

  if (project === undefined || events === undefined) return null;
  if (!cal || cal.months.length === 0 || cal.eras.length === 0) {
    return <EmptyState projectId={projectId} />;
  }
  return (
    <CalendarView
      projectId={projectId}
      cal={cal}
      events={events}
      chapters={chapters ?? []}
      codex={codexEntries}
    />
  );
}

// ---------------------------------------------------------------------------
// Empty state — belum ada kalender
// ---------------------------------------------------------------------------

function EmptyState({ projectId }: { projectId: number }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const quick = async (p: CalendarPreset) => {
    await db.projects.update(projectId, { calendar: calendarPreset(p) });
  };
  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto w-full">
      <div className="flex flex-col items-center justify-center text-center py-16 px-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50">
        <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-5">
          <CalendarDays size={26} className="text-indigo-400" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">Rancang Kalender Dunia Anda</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mb-6 leading-relaxed">
          Buat penanggalan in-world sendiri — bulan, musim, dan era. Lalu tata peristiwa Timeline di grid kalender, tandai rentang panjang seperti perang, dan tautkan ke bab & Codex.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={() => quick('gregorian')} className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Seperti Masehi</button>
          <button onClick={() => quick('fantasy')} className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Fantasi 8-bulan</button>
          <button onClick={() => setEditorOpen(true)} className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-2"><CalendarCog size={15} /> Susun sendiri</button>
        </div>
      </div>
      {editorOpen && <CalendarEditorModal projectId={projectId} calendar={undefined} onClose={() => setEditorOpen(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tampilan kalender
// ---------------------------------------------------------------------------

function CalendarView({
  projectId, cal, events, chapters, codex,
}: {
  projectId: number;
  cal: WorldCalendar;
  events: TimelineEvent[];
  chapters: { id?: number; title: string }[];
  codex: import('@/src/types').CodexEntry[];
}) {
  const [era, setEra] = useState(0);
  const [year, setYear] = useState(1);
  const [month, setMonth] = useState(1); // 1-based
  const [selDay, setSelDay] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [eventSeed, setEventSeed] = useState<CalendarEventSeed | null>(null);
  const [query, setQuery] = useState('');
  const [eraFilter, setEraFilter] = useState<number | 'all'>('all');
  const [collapsedEras, setCollapsedEras] = useState<Set<number>>(new Set());
  const [collapsedYears, setCollapsedYears] = useState<Set<string>>(new Set());

  const toggleEra = (ei: number) => setCollapsedEras(s => { const n = new Set(s); n.has(ei) ? n.delete(ei) : n.add(ei); return n; });
  const toggleYear = (k: string) => setCollapsedYears(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const chapterTitle = useMemo(() => {
    const m = new Map<number, string>();
    chapters.forEach(c => c.id != null && m.set(c.id, c.title));
    return m;
  }, [chapters]);
  const codexName = useMemo(() => {
    const m = new Map<number, string>();
    codex.forEach(c => c.id != null && m.set(c.id, c.name));
    return m;
  }, [codex]);

  // Hanya event ber-tanggal terstruktur yang muncul di kalender.
  const dated = useMemo(() => events.filter(e => e.startDate), [events]);

  // Apakah event menutupi sebuah sel (era/year/month/day) — sadar rentang lintas-bulan.
  const coversCell = (ev: TimelineEvent, cell: WorldDate): boolean => {
    const s = ev.startDate!;
    const e = ev.endDate ?? ev.startDate!;
    return compareDate(s, cell) <= 0 && compareDate(cell, e) <= 0;
  };
  const isRange = (ev: TimelineEvent) => !!ev.endDate && compareDate(ev.endDate, ev.startDate!) > 0;

  const monthDays = daysInMonth(cal, month);
  const wk = cal.weekdays.length;
  const leadBlanks = wk > 0 ? Math.max(0, weekdayOfFirst(cal, era, year, month)) : 0;
  const season = seasonForMonth(cal, month);

  // Tahun ber-peristiwa di era ini.
  const yearsWithEvents = useMemo(() => {
    const counts = new Map<number, number>();
    dated.forEach(e => { if (e.startDate!.era === era) counts.set(e.startDate!.year, (counts.get(e.startDate!.year) || 0) + 1); });
    return [...counts.entries()].map(([y, n]) => ({ year: y, count: n })).sort((a, b) => a.year - b.year);
  }, [dated, era]);

  // Pencarian daftar peristiwa: cocokkan judul, deskripsi, nama bab & entitas tertaut.
  const datedForList = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dated;
    return dated.filter(e => {
      if (e.title.toLowerCase().includes(q)) return true;
      if (e.description?.toLowerCase().includes(q)) return true;
      if (e.chapterId != null && chapterTitle.get(e.chapterId)?.toLowerCase().includes(q)) return true;
      return (e.characterIds ?? []).some(id => codexName.get(id)?.toLowerCase().includes(q));
    });
  }, [dated, query, chapterTitle, codexName]);

  // Pengelompokan Era → Tahun untuk daftar samping.
  const grouped = useMemo(() => {
    const sorted = [...datedForList].sort((a, b) => compareDate(a.startDate!, b.startDate!));
    const byEra = new Map<number, Map<number, TimelineEvent[]>>();
    for (const e of sorted) {
      const er = e.startDate!.era, yr = e.startDate!.year;
      if (!byEra.has(er)) byEra.set(er, new Map());
      const ymap = byEra.get(er)!;
      if (!ymap.has(yr)) ymap.set(yr, []);
      ymap.get(yr)!.push(e);
    }
    return byEra;
  }, [datedForList]);

  // Era yang punya peristiwa (untuk opsi filter era).
  const erasWithEvents = useMemo(() => {
    const set = new Set<number>();
    dated.forEach(e => set.add(e.startDate!.era));
    return [...set].sort((a, b) => a - b);
  }, [dated]);

  const searching = query.trim().length > 0;

  const changeEra = (e: number) => { setEra(e); setSelDay(null); };
  const changeMonthYear = (m: number, y: number) => { setMonth(m); setYear(y); setSelDay(null); };
  const stepMonth = (dir: number) => {
    let m = month + dir, y = year;
    if (m < 1) { m = cal.months.length; y -= 1; }
    else if (m > cal.months.length) { m = 1; y += 1; }
    changeMonthYear(m, y);
  };

  const openNewAt = (day: number | null) => {
    setEventSeed({ era, year, month, day: day ?? 1 });
  };
  const openEdit = (ev: TimelineEvent) => setEventSeed({ event: ev, era, year, month, day: ev.startDate!.day });

  const selEvents = selDay != null
    ? dated.filter(e => coversCell(e, { era, year, month, day: selDay }))
    : [];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full pb-20 space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide uppercase border border-indigo-100 dark:border-indigo-800/50">
            <CalendarDays size={14} /> Kalender Dunia
          </div>
          <h1 className="text-2xl md:text-3xl font-serif text-slate-900 dark:text-slate-100 tracking-tight">Penanggalan Cerita</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditorOpen(true)} className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"><CalendarCog size={15} /> Editor</button>
          <button onClick={() => openNewAt(selDay)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"><CalendarPlus size={15} /> Peristiwa baru</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_300px_300px] gap-6 items-start">
        {/* Kalender */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
          {/* Navigasi bulan/era */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h2 className="text-xl font-serif text-slate-900 dark:text-slate-100">{cal.months[month - 1]?.name}</h2>
              <span className="text-sm text-slate-400">Tahun {year}</span>
              {season && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: `${season.color}22`, color: season.color }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: season.color }} /> {season.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <select aria-label="Pilih era" value={era} onChange={e => changeEra(Number(e.target.value))} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800/50 rounded-lg px-2.5 py-1.5 focus:outline-none">
                {cal.eras.map((er, i) => <option key={i} value={i}>{er.name}{er.abbr ? ` (${er.abbr})` : ''}</option>)}
              </select>
              <input aria-label="Tahun" type="number" value={year} onChange={e => changeMonthYear(month, Number(e.target.value) || 1)} className="w-20 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
              <button onClick={() => stepMonth(-1)} aria-label="Bulan sebelumnya" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft size={16} /></button>
              <button onClick={() => stepMonth(1)} aria-label="Bulan berikutnya" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight size={16} /></button>
            </div>
          </div>

          {/* Pita musim */}
          {cal.seasons.length > 0 && (
            <div className="flex h-1.5 rounded-full overflow-hidden border border-slate-100 dark:border-slate-800" title="Musim sepanjang tahun">
              {cal.months.map((_, i) => {
                const s = seasonForMonth(cal, i + 1);
                return <div key={i} className="flex-1" style={{ background: s ? s.color : 'transparent', opacity: month === i + 1 ? 1 : 0.5 }} />;
              })}
            </div>
          )}

          {/* Header hari */}
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${wk}, minmax(0,1fr))` }}>
            {cal.weekdays.map((d, i) => (
              <div key={i} className="text-[10px] md:text-[11px] font-bold uppercase tracking-wide text-slate-400 text-center py-1 truncate" title={d}>{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${wk}, minmax(0,1fr))` }}>
            {Array.from({ length: leadBlanks }).map((_, i) => <div key={`b${i}`} />)}
            {Array.from({ length: monthDays }).map((_, i) => {
              const d = i + 1;
              const cell: WorldDate = { era, year, month, day: d };
              const covering = dated.filter(e => coversCell(e, cell));
              const rangeEvs = covering.filter(isRange);
              const pointEvs = covering.filter(e => !isRange(e));
              const starter = rangeEvs.find(e => e.startDate!.month === month && e.startDate!.year === year && e.startDate!.day === d);
              return (
                <button
                  key={d}
                  onClick={() => setSelDay(d)}
                  className={cn(
                    'relative aspect-square rounded-lg border text-left p-1 md:p-1.5 flex flex-col transition-colors overflow-hidden',
                    selDay === d ? 'border-indigo-400 ring-2 ring-indigo-100 dark:ring-indigo-900/50' : 'border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800/50',
                    rangeEvs.length ? 'bg-rose-50/60 dark:bg-rose-900/15' : 'bg-white dark:bg-slate-900',
                  )}
                >
                  <span className="text-[11px] md:text-xs font-semibold text-slate-500 dark:text-slate-400">{d}</span>
                  {starter && <span className="text-[9px] md:text-[10px] font-medium text-rose-600 dark:text-rose-400 leading-tight line-clamp-2 mt-0.5">{starter.title}</span>}
                  {rangeEvs.length > 0 && <span className="absolute left-1 right-1 bottom-1 h-1 rounded-full bg-rose-400/80" />}
                  {pointEvs.length > 0 && (
                    <span className="mt-auto flex items-center gap-0.5 flex-wrap">
                      {pointEvs.slice(0, 4).map(e => <span key={e.id} className="w-1.5 h-1.5 rounded-full bg-indigo-500" />)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Pita tahun ber-peristiwa */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mr-1">Tahun ber-peristiwa · {eraAbbr(cal, era)}</span>
            {yearsWithEvents.length === 0 ? (
              <span className="text-[11px] text-slate-400 italic">belum ada peristiwa di era ini</span>
            ) : yearsWithEvents.map(({ year: y, count }) => (
              <button key={y} onClick={() => changeMonthYear(month, y)} className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors', y === year ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300')}>
                {y} <span className="opacity-60">({count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Detail hari terpilih (kanan di xl) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm lg:sticky lg:top-4 xl:order-3">
          {selDay == null ? (
            <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
              <CalendarDays size={28} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              Klik sebuah tanggal untuk melihat & menambah peristiwa.
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{cal.months[month - 1]?.name} {selDay}{wk > 0 && cal.weekdays[dayOfWeek(cal, { era, year, month, day: selDay })] ? ` · ${cal.weekdays[dayOfWeek(cal, { era, year, month, day: selDay })]}` : ''}</h3>
                <p className="text-[11px] text-slate-400">Tahun {year} · {eraLabel(cal, era)}</p>
              </div>
              {selEvents.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic py-2">Belum ada peristiwa pada tanggal ini.</p>
              ) : (
                <div className="space-y-2">
                  {selEvents.map(e => (
                    <button key={e.id} onClick={() => openEdit(e)} className="block w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 bg-slate-50/50 dark:bg-slate-800/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', isRange(e) ? 'bg-rose-500' : 'bg-indigo-500')} />
                        <span className="font-medium text-sm text-slate-800 dark:text-slate-200 flex-1">{e.title}</span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 mt-1">{formatDateRange(cal, e.startDate!, e.endDate)}</p>
                      {e.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{e.description}</p>}
                      {(e.chapterId != null || (e.characterIds?.length ?? 0) > 0) && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                          {e.chapterId != null && chapterTitle.get(e.chapterId) && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500"><BookText size={10} />{chapterTitle.get(e.chapterId)}</span>
                          )}
                          {(e.characterIds ?? []).map(id => codexName.get(id)).filter(Boolean).slice(0, 3).map((n, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"><Users size={10} />{n}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => openNewAt(selDay)} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"><Plus size={14} /> Tambah peristiwa di tanggal ini</button>
            </div>
          )}
        </div>

        {/* Daftar peristiwa berkalender (Era → Tahun) — kolom tengah di xl */}
        <section className="lg:col-span-2 xl:col-span-1 xl:order-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Header lengket + pencarian */}
        <div className="p-4 pb-3 space-y-2.5 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Semua peristiwa</h2>
            {dated.length > 0 && (
              <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                {query.trim() ? `${datedForList.length}/${dated.length}` : dated.length}
              </span>
            )}
          </div>
          {dated.length > 0 && (
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Cari peristiwa, bab, entitas…"
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-lg pl-8 pr-8 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Bersihkan pencarian" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X size={14} />
                </button>
              )}
            </div>
          )}
          {erasWithEvents.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter size={13} className="text-slate-400 shrink-0" />
              <select
                aria-label="Filter era"
                value={eraFilter === 'all' ? 'all' : String(eraFilter)}
                onChange={e => setEraFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400"
              >
                <option value="all">Semua era</option>
                {erasWithEvents.map(ei => <option key={ei} value={ei}>{eraLabel(cal, ei)}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="p-4 xl:overflow-y-auto custom-scrollbar">
        {dated.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 italic">Belum ada peristiwa bertanggal. Klik tanggal di grid atau "Peristiwa baru" untuk menambah. Peristiwa Timeline tanpa tanggal terstruktur tetap ada di panel Timeline Cerita.</p>
        ) : datedForList.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 italic">Tak ada peristiwa yang cocok dengan “{query.trim()}”.</p>
        ) : (
          <div className="space-y-3">
            {cal.eras.map((_, ei) => {
              if (eraFilter !== 'all' && ei !== eraFilter) return null;
              const ymap = grouped.get(ei);
              if (!ymap || ymap.size === 0) return null;
              const eraCount = [...ymap.values()].reduce((n, a) => n + a.length, 0);
              const eraOpen = searching || !collapsedEras.has(ei);
              return (
                <div key={ei} className="space-y-1.5">
                  <button onClick={() => toggleEra(ei)} className="flex items-center gap-1.5 w-full text-left border-b border-indigo-100 dark:border-indigo-900/40 pb-1 group">
                    {eraOpen ? <ChevronDown size={13} className="text-indigo-400 shrink-0" /> : <ChevronRight size={13} className="text-indigo-400 shrink-0" />}
                    <h3 className="text-xs font-serif font-semibold text-indigo-600 dark:text-indigo-400 flex-1 truncate">{eraLabel(cal, ei)}</h3>
                    <span className="text-[10px] font-medium text-slate-400 tabular-nums">{eraCount}</span>
                  </button>
                  {eraOpen && [...ymap.entries()].sort((a, b) => a[0] - b[0]).map(([yr, evs]) => {
                    const yKey = `${ei}-${yr}`;
                    const yOpen = searching || !collapsedYears.has(yKey);
                    return (
                      <div key={yr} className="pl-1.5">
                        <button onClick={() => toggleYear(yKey)} className="flex items-center gap-1 w-full text-left mb-1">
                          {yOpen ? <ChevronDown size={11} className="text-slate-400 shrink-0" /> : <ChevronRight size={11} className="text-slate-400 shrink-0" />}
                          <span className="text-[11px] font-bold text-slate-400">Tahun {yr}</span>
                          <span className="text-[10px] text-slate-300 dark:text-slate-600 ml-auto tabular-nums">{evs.length}</span>
                        </button>
                        {yOpen && (
                          <div className="space-y-1 pl-1">
                            {evs.map(e => (
                              <button key={e.id} onClick={() => { setEra(ei); setYear(yr); setMonth(e.startDate!.month); setSelDay(e.startDate!.day); }} title="Loncat ke tanggal ini" className="flex items-center gap-2 w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', isRange(e) ? 'bg-rose-500' : 'bg-indigo-500')} />
                                <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{e.title}</span>
                                <span className="text-[11px] font-mono text-slate-400 shrink-0">{formatDateRange(cal, e.startDate!, e.endDate)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
        </div>
        </section>
      </div>

      {editorOpen && <CalendarEditorModal projectId={projectId} calendar={cal} onClose={() => setEditorOpen(false)} />}
      {eventSeed && <CalendarEventModal projectId={projectId} calendar={cal} seed={eventSeed} chapters={chapters} codex={codex} onClose={() => setEventSeed(null)} />}
    </div>
  );
}
