/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modal Kalkulator Waktu & Perjalanan (#4 Peningkatan) — alat bantu penulis
 * untuk menghitung selisih tanggal in-world, estimasi jarak tempuh perjalanan
 * berbagai moda (jalan kaki, kuda, kapal layar, kurir), dan proyeksi tanggal tiba.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  Compass, X, CalendarPlus, ArrowRight, Clock, Footprints,
  Ship, Send, Check, Copy
} from 'lucide-react';
import { WorldCalendar, WorldDate } from '@/src/types';
import {
  daysBetween, addDays, addMonths, formatDate, formatDaysBreakdown,
  daysInMonth, seasonForMonth, dayOfWeek, TRAVEL_MODES, TravelModeInfo
} from '@/src/lib/worldCalendar';
import { cn } from '@/src/lib/utils';
import { useToast } from '@/src/hooks/useToast';

interface Props {
  calendar: WorldCalendar;
  initialDate?: WorldDate;
  onClose: () => void;
  onCreateEventFromRange?: (start: WorldDate, end: WorldDate, defaultTitle?: string) => void;
}

const inputCls = 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-400';
const labelCls = 'text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider';

function clampDay(cal: WorldCalendar, month: number, day: number): number {
  const max = daysInMonth(cal, month) || 1;
  return Math.min(Math.max(1, day), max);
}

export function CalendarCalculatorModal({
  calendar, initialDate, onClose, onCreateEventFromRange,
}: Props) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'diff' | 'project'>('diff');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Default base date: initialDate atau Tahun 1 Bulan 1 Hari 1
  const defaultDate: WorldDate = useMemo(() => initialDate ?? {
    era: 0,
    year: 1,
    month: 1,
    day: 1,
  }, [initialDate]);

  // --- State Tab 1: Selisih Tanggal ---
  const [dateA, setDateA] = useState<WorldDate>(defaultDate);
  const [dateB, setDateB] = useState<WorldDate>(() => addDays(calendar, defaultDate, 14));

  const daysDiff = useMemo(() => daysBetween(calendar, dateA, dateB), [calendar, dateA, dateB]);
  const breakdownText = useMemo(() => {
    if (daysDiff == null) return null;
    return formatDaysBreakdown(calendar, daysDiff);
  }, [calendar, daysDiff]);

  // --- State Tab 2: Proyeksi Tanggal Tiba ---
  const [projStart, setProjStart] = useState<WorldDate>(defaultDate);
  const [projMethod, setProjMethod] = useState<'days' | 'travel'>('days');
  const [travelDays, setTravelDays] = useState<number>(14);
  const [selectedModeId, setSelectedModeId] = useState<string>('horse');
  const [distanceKm, setDistanceKm] = useState<number>(300);

  const selectedMode = useMemo(() =>
    TRAVEL_MODES.find(m => m.id === selectedModeId) ?? TRAVEL_MODES[2]
  , [selectedModeId]);

  const effectiveDays = useMemo(() => {
    if (projMethod === 'days') return travelDays;
    const speed = selectedMode.speedKmPerDay || 20;
    return Math.max(1, Math.ceil(distanceKm / speed));
  }, [projMethod, travelDays, selectedMode, distanceKm]);

  const projectedArrival = useMemo(() => {
    return addDays(calendar, projStart, effectiveDays);
  }, [calendar, projStart, effectiveDays]);

  const arrivalSeason = useMemo(() => {
    return seasonForMonth(calendar, projectedArrival.month);
  }, [calendar, projectedArrival.month]);

  const arrivalWeekday = useMemo(() => {
    if (!calendar.weekdays.length) return '';
    const idx = dayOfWeek(calendar, projectedArrival);
    return calendar.weekdays[idx] || '';
  }, [calendar, projectedArrival]);

  const handleCopyDate = (date: WorldDate) => {
    const formatted = formatDate(calendar, date);
    navigator.clipboard.writeText(formatted);
    toast.success(`Disalin: ${formatted}`);
  };

  const handleCreateEvent = (start: WorldDate, end: WorldDate, titleDesc: string) => {
    if (onCreateEventFromRange) {
      onCreateEventFromRange(start, end, titleDesc);
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden max-h-[85vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <Compass size={16} />
            </span>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Kalkulator Waktu & Perjalanan</h3>
              <p className="text-[11px] text-slate-400">Aritmetika waktu in-world & estimasi rute fantasi</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-100 dark:border-slate-800/60 px-5 pt-2 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={() => setActiveTab('diff')}
            className={cn(
              'px-4 py-2 text-xs font-semibold border-b-2 transition-colors',
              activeTab === 'diff'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            )}
          >
            Selisih 2 Tanggal
          </button>
          <button
            onClick={() => setActiveTab('project')}
            className={cn(
              'px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5',
              activeTab === 'project'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            )}
          >
            Proyeksi Tanggal Tiba
          </button>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto custom-scrollbar">
          {/* TAB 1: Selisih Tanggal */}
          {activeTab === 'diff' && (
            <div className="space-y-5">
              {/* Tanggal A */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={labelCls}>Tanggal Awal (A)</span>
                  <button
                    onClick={() => setDateA(defaultDate)}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Pakai tanggal aktif
                  </button>
                </div>
                <DateSelector calendar={calendar} value={dateA} onChange={setDateA} />
                <p className="text-[11px] text-slate-400">{formatDate(calendar, dateA)}</p>
              </div>

              {/* Tanggal B */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={labelCls}>Tanggal Akhir / Tujuan (B)</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDateB(addDays(calendar, dateA, 7))} className="text-[10px] text-slate-400 hover:text-indigo-600">+7h</button>
                    <button onClick={() => setDateB(addDays(calendar, dateA, 14))} className="text-[10px] text-slate-400 hover:text-indigo-600">+14h</button>
                    <button onClick={() => setDateB(addMonths(calendar, dateA, 1))} className="text-[10px] text-slate-400 hover:text-indigo-600">+1 bln</button>
                  </div>
                </div>
                <DateSelector calendar={calendar} value={dateB} onChange={setDateB} />
                <p className="text-[11px] text-slate-400">{formatDate(calendar, dateB)}</p>
              </div>

              {/* Hasil Kalkulasi Selisih */}
              {daysDiff === null ? (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 text-xs">
                  Kedua tanggal berada di era yang berbeda. Selisih hari absolut hanya dapat dihitung bila kedua tanggal berada di era yang sama karena penomoran tahun mulai ulang dari Tahun 1 di tiap era.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="text-2xl font-serif font-bold text-indigo-700 dark:text-indigo-300">
                          {Math.abs(daysDiff)} Hari
                        </div>
                        <div className="text-xs font-medium text-indigo-600/80 dark:text-indigo-400 mt-0.5">
                          {breakdownText}
                          {daysDiff < 0 && ' (Tanggal B mendahului Tanggal A)'}
                        </div>
                      </div>
                      {onCreateEventFromRange && daysDiff > 0 && (
                        <button
                          onClick={() => handleCreateEvent(dateA, dateB, 'Peristiwa Rentang')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                        >
                          <CalendarPlus size={13} /> Buat Peristiwa
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Estimasi Tempuh Berbagai Moda */}
                  <div className="space-y-2">
                    <span className={labelCls}>Kapasitas Jarak dalam {Math.abs(daysDiff)} Hari</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {TRAVEL_MODES.slice(0, 4).map(m => {
                        const maxDist = Math.abs(daysDiff) * m.speedKmPerDay;
                        return (
                          <div key={m.id} className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {m.id === 'foot' && <Footprints size={14} className="text-slate-400" />}
                              {m.id === 'carriage' && <Compass size={14} className="text-slate-400" />}
                              {m.id === 'horse' && <Compass size={14} className="text-slate-400" />}
                              {m.id === 'courier' && <Clock size={14} className="text-slate-400" />}
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{m.name}</span>
                            </div>
                            <span className="text-xs font-bold font-mono text-indigo-600 dark:text-indigo-400">~{maxDist.toLocaleString()} km</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Proyeksi Tanggal Tiba */}
          {activeTab === 'project' && (
            <div className="space-y-5">
              {/* Tanggal Mulai */}
              <div className="space-y-1.5">
                <span className={labelCls}>Tanggal Berangkat</span>
                <DateSelector calendar={calendar} value={projStart} onChange={setProjStart} />
                <p className="text-[11px] text-slate-400">{formatDate(calendar, projStart)}</p>
              </div>

              {/* Mode Input Durasi */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={labelCls}>Tentukan Durasi Perjalanan:</span>
                  <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
                    <button
                      onClick={() => setProjMethod('days')}
                      className={cn('px-2.5 py-1 transition-colors font-medium', projMethod === 'days' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400')}
                    >
                      Jumlah Hari
                    </button>
                    <button
                      onClick={() => setProjMethod('travel')}
                      className={cn('px-2.5 py-1 transition-colors font-medium', projMethod === 'travel' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400')}
                    >
                      Berdasarkan Jarak (km)
                    </button>
                  </div>
                </div>

                {projMethod === 'days' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={travelDays}
                        onChange={e => setTravelDays(Math.max(1, Number(e.target.value) || 1))}
                        className={cn(inputCls, 'w-28 text-center text-base font-semibold')}
                      />
                      <span className="text-sm text-slate-500">hari perjalanan</span>
                    </div>
                    {/* Shortcut Durasi */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[3, 7, 14, 21, 30].map(d => (
                        <button
                          key={d}
                          onClick={() => setTravelDays(d)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                            travelDays === d
                              ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-300 text-indigo-600 dark:text-indigo-400'
                              : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200 text-slate-500'
                          )}
                        >
                          +{d} Hari
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          const m1 = addMonths(calendar, projStart, 1);
                          const d = daysBetween(calendar, projStart, m1) || 30;
                          setTravelDays(d);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 hover:border-indigo-200 text-slate-500"
                      >
                        +1 Bulan
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className={labelCls}>Moda Transportasi</span>
                        <select
                          value={selectedModeId}
                          onChange={e => setSelectedModeId(e.target.value)}
                          className={cn(inputCls, 'w-full mt-1')}
                        >
                          {TRAVEL_MODES.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} (~{m.speedKmPerDay} km/hari)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className={labelCls}>Jarak Tempuh (km)</span>
                        <input
                          type="number"
                          min={1}
                          value={distanceKm}
                          onChange={e => setDistanceKm(Math.max(1, Number(e.target.value) || 1))}
                          className={cn(inputCls, 'w-full mt-1')}
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 italic">
                      {selectedMode.description} → Membutuhkan sekitar <b>{effectiveDays} hari</b> perjalanan.
                    </p>
                  </div>
                )}
              </div>

              {/* Kartu Hasil Proyeksi Tanggal Tiba */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-purple-50/40 dark:from-indigo-950/40 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <Clock size={12} /> Tanggal Tiba Terhitung
                  </span>
                  <button
                    onClick={() => handleCopyDate(projectedArrival)}
                    className="p-1 rounded-md text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300"
                    title="Salin tanggal"
                  >
                    <Copy size={13} />
                  </button>
                </div>

                <div className="flex items-baseline gap-2 flex-wrap">
                  <div className="text-xl md:text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">
                    {formatDate(calendar, projectedArrival)}
                  </div>
                  {arrivalWeekday && (
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      · {arrivalWeekday}
                    </span>
                  )}
                  {arrivalSeason && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: `${arrivalSeason.color}22`, color: arrivalSeason.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: arrivalSeason.color }} />
                      {arrivalSeason.name}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(calendar, projStart)} <ArrowRight size={11} className="inline mx-1 text-slate-400" /> +{effectiveDays} hari ({formatDaysBreakdown(calendar, effectiveDays)})
                </p>

                {onCreateEventFromRange && (
                  <button
                    onClick={() => handleCreateEvent(
                      projStart,
                      projectedArrival,
                      `Perjalanan ${selectedMode.name.split('/')[0].trim()}`
                    )}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors mt-2 active:scale-95"
                  >
                    <CalendarPlus size={14} /> Buat Peristiwa Perjalanan di Kalender
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-slate-100 dark:border-slate-800/60 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Komponen Pemilih Tanggal Terstruktur
// ---------------------------------------------------------------------------

function DateSelector({
  calendar, value, onChange,
}: {
  calendar: WorldCalendar;
  value: WorldDate;
  onChange: (d: WorldDate) => void;
}) {
  const { era, year, month, day } = value;

  const setEra = (e: number) => onChange({ ...value, era: e });
  const setYear = (y: number) => onChange({ ...value, year: Math.max(1, y) });
  const setMonth = (m: number) => {
    const clampedDay = clampDay(calendar, m, day);
    onChange({ ...value, month: m, day: clampedDay });
  };
  const setDay = (d: number) => onChange({ ...value, day: clampDay(calendar, month, d) });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <select
        aria-label="Era"
        value={era}
        onChange={e => setEra(Number(e.target.value))}
        className={inputCls}
      >
        {calendar.eras.map((er, i) => (
          <option key={i} value={i}>{er.name}{er.abbr ? ` (${er.abbr})` : ''}</option>
        ))}
      </select>
      <input
        aria-label="Tahun"
        type="number"
        value={year}
        onChange={e => setYear(Number(e.target.value) || 1)}
        className={inputCls}
      />
      <select
        aria-label="Bulan"
        value={month}
        onChange={e => setMonth(Number(e.target.value))}
        className={inputCls}
      >
        {calendar.months.map((m, i) => (
          <option key={i} value={i + 1}>{m.name}</option>
        ))}
      </select>
      <input
        aria-label="Hari"
        type="number"
        min={1}
        max={daysInMonth(calendar, month)}
        value={day}
        onChange={e => setDay(Number(e.target.value) || 1)}
        className={inputCls}
      />
    </div>
  );
}
