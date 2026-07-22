/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Wawasan Prosa — analitik gaya SELURUH NASKAH, murni lokal & TANPA AI.
 * Logika di src/lib/proseAnalysis.ts; panel ini hanya menyajikan & menautkan hasil.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { db } from '@/src/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Gauge, ScanSearch, Loader2, ArrowUpRight, Sparkles, Repeat, MessageSquare, Radar } from 'lucide-react';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { useProjectData } from '@/src/hooks/useProjectData';
import { usePlainChapters } from '@/src/hooks/usePlainChapters';
import { useProseReport } from '@/src/hooks/useProseReport';
import { ProseReport, ProseLanguage, ChapterProseRow, ProximityEcho } from '@/src/lib/proseAnalysis';
import { cn } from '@/src/lib/utils';

interface ProseReportPanelProps {
  projectId: number;
}

// --- Persistensi hasil terakhir (localStorage, per-proyek) ---
// Hasil analisis bertahan saat pindah panel / refresh, hingga pengguna
// menganalisis ulang. Deterministik → aman menampilkan hasil tersimpan apa adanya.
const STORE_VERSION = 1;
const storeKey = (projectId: number) => `prose_report_${projectId}`;

interface StoredReport {
  v: number;
  language: ProseLanguage;
  report: ProseReport;
  savedAt: number;
}

function loadStoredReport(projectId: number): StoredReport | null {
  try {
    const raw = localStorage.getItem(storeKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredReport;
    if (parsed?.v !== STORE_VERSION || !parsed.report) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredReport(projectId: number, language: ProseLanguage, report: ProseReport): number {
  const savedAt = Date.now();
  try {
    localStorage.setItem(storeKey(projectId), JSON.stringify({ v: STORE_VERSION, language, report, savedAt }));
  } catch {
    // localStorage penuh / tak tersedia — hasil tetap tampil di sesi ini, hanya tak tersimpan.
  }
  return savedAt;
}

function formatSavedAt(ts: number): string {
  try {
    return new Date(ts).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function readabilityColor(score: number): string {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-blue-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}


export function ProseReportPanel({ projectId }: ProseReportPanelProps) {
  const { setActiveChapterId, setViewMode, jumpToText } = useNavigation();
  const { codexEntries } = useProjectData(projectId);

  const chapters = usePlainChapters(projectId);

  const [language, setLanguage] = useState<ProseLanguage>('id');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const { scanning, report, setReport, scan: doScan } = useProseReport(projectId, chapters, codexEntries, language);

  // Hidrasi hasil terakhir dari localStorage saat panel di-mount / ganti proyek.
  useEffect(() => {
    const stored = loadStoredReport(projectId);
    if (stored) {
      setReport(stored.report);
      setLanguage(stored.language);
      setSavedAt(stored.savedAt);
    } else {
      setReport(null);
      setSavedAt(null);
    }
  }, [projectId]);

  const openChapter = (id: number) => {
    setActiveChapterId(id);
    setViewMode('write');
  };

  const scan = useCallback(async () => {
    const result = await doScan();
    if (result) {
      setSavedAt(saveStoredReport(projectId, language, result));
    }
  }, [doScan, projectId, language]);

  const totalChapters = chapters?.length ?? 0;

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8 pb-20 w-full">
      {/* Header */}
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide uppercase border border-indigo-100 dark:border-indigo-800/50">
          <Gauge size={14} />
          <span>Analitik Prosa</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-serif text-slate-900 dark:text-slate-100 tracking-tight">
          Wawasan Prosa
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed">
          Rapor gaya <span className="font-medium">seluruh manuskrip</span>: keterbacaan &amp; ritme kalimat tiap bab, verba pasif, kata keterangan, rasio dialog (sinyal pacing), dan <span className="font-medium">kata muleti</span> yang terlalu sering muncul. Sepenuhnya lokal — <span className="font-medium">tanpa AI, tanpa token</span>.
        </p>
      </header>

      {/* Kontrol */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Bahasa naskah</label>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
            {(['id', 'en'] as ProseLanguage[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                disabled={scanning}
                className={cn(
                  'text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50',
                  language === lang
                    ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600',
                )}
              >
                {lang === 'id' ? 'Indonesia' : 'English'}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={scan}
          disabled={scanning || totalChapters === 0}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm hover:shadow-md"
        >
          {scanning ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} />}
          {scanning ? 'Menganalisis…' : report ? 'Analisis Ulang' : 'Analisis Prosa'}
        </button>
        <div className="text-xs text-slate-400 dark:text-slate-500 sm:ml-auto sm:text-right self-center leading-relaxed">
          <p>{totalChapters} bab di manuskrip</p>
          {savedAt && !scanning && <p>Dianalisis {formatSavedAt(savedAt)}</p>}
        </div>
      </div>

      {/* Hasil */}
      {report !== null && (
        <div className="space-y-8">
          {/* Ringkasan */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total kata" value={report.totalWords.toLocaleString('id-ID')} />
            <StatCard
              label="Keterbacaan rata-rata"
              value={`${report.avgReadability}`}
              accent={readabilityColor(report.avgReadability)}
            />
            <StatCard label="Verba pasif" value={report.totalPassive.toLocaleString('id-ID')} />
            <StatCard label="Kata keterangan" value={report.totalAdverbs.toLocaleString('id-ID')} />
          </div>

          {/* Tabel prosa per-bab */}
          {report.chapters.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Prosa per bab</h2>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                      <th className="text-left font-bold px-4 py-3">Bab</th>
                      <th className="text-right font-bold px-3 py-3" title="Jumlah kata">Kata</th>
                      <th className="text-right font-bold px-3 py-3" title="Rata-rata kata per kalimat">Kalimat</th>
                      <th className="text-right font-bold px-3 py-3" title="Skor keterbacaan (0–100)">Baca</th>
                      <th className="text-right font-bold px-3 py-3" title="Kalimat > 25 kata">Panjang</th>
                      <th className="text-right font-bold px-3 py-3" title="Verba pasif">Pasif</th>
                      <th className="text-right font-bold px-3 py-3" title="Kata keterangan">Kata ket.</th>
                      <th className="text-right font-bold px-3 py-3" title="Porsi kata dalam dialog">Dialog</th>
                      <th className="px-2 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {report.chapters.map((row) => (
                      <ChapterRow key={row.id} row={row} onOpen={() => openChapter(row.id)} />
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Angka jingga/merah = perlu diperiksa (kalimat panjang, pasif/kata keterangan padat, atau keterbacaan rendah). Metrik heuristik — bukan aturan mutlak, sesuaikan dengan genre.
              </p>
            </section>
          )}

          {/* Kata muleti */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Repeat size={15} className="text-indigo-500" /> Kata muleti (echo)
            </h2>
            {report.echoWords.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm text-sm text-slate-500 dark:text-slate-400">
                Tidak ada kata yang menonjol sebagai muleti. Bagus — kosakata Anda cukup bervariasi.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {report.echoWords.map((e) => (
                    <div
                      key={e.word}
                      title={`${e.total}× total · di ${e.chapters} bab · ${e.per1000}/1000 kata`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm text-sm"
                    >
                      <span className="font-medium text-slate-700 dark:text-slate-200">{e.word}</span>
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">{e.total}×</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Diurut menurut kepadatan (per 1000 kata). Nama karakter/tempat di Kamus Data dikecualikan otomatis. Arahkan kursor untuk detail.
                </p>
              </>
            )}
          </section>

          {/* Echo berdekatan */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Radar size={15} className="text-indigo-500" /> Echo berdekatan
            </h2>
            {report.proximityEchoes.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm text-sm text-slate-500 dark:text-slate-400">
                Tidak ada kata konten yang berulang dalam jarak dekat. Aliran prosa Anda bersih dari pengulangan janggal.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {report.proximityEchoes.map((e) => (
                    <ProximityRow key={e.id} echo={e} onJump={() => jumpToText(e.chapterId, e.excerpt)} />
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Kata konten sama yang muncul dua kali dalam ≤40 kata — sering terdengar janggal saat dibaca. Diurut dari yang paling berdekatan. Klik untuk melompat ke lokasinya di editor.
                </p>
              </>
            )}
          </section>
        </div>
      )}

      {report === null && !scanning && (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50">
          <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-5">
            <Sparkles size={24} className="text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1.5">Belum dianalisis</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
            Klik <span className="font-medium">Analisis Prosa</span> untuk menghitung metrik gaya tiap bab dan menemukan kata yang terlalu sering dipakai.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
      <p className={cn('text-2xl font-bold tabular-nums', accent ?? 'text-slate-900 dark:text-slate-100')}>{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function ChapterRow({ row, onOpen }: { row: ChapterProseRow; onOpen: () => void }) {
  const m = row.metrics;
  // Kepadatan pasif/kata keterangan relatif jumlah kata (per 100 kata).
  const passiveDensity = m.wordCount ? (m.passiveVoiceCount / m.wordCount) * 100 : 0;
  const adverbDensity = m.wordCount ? (m.adverbCount / m.wordCount) * 100 : 0;
  const dialoguePct = Math.round(row.dialogueRatio * 100);
  return (
    <tr className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
      <td className="px-4 py-2.5">
        <span className="text-slate-700 dark:text-slate-200 font-medium truncate block max-w-[220px]" title={row.title}>
          <span className="text-slate-400 dark:text-slate-500 tabular-nums mr-1.5">{row.index + 1}.</span>
          {row.title || 'Tanpa judul'}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{m.wordCount.toLocaleString('id-ID')}</td>
      <td className={cn('px-3 py-2.5 text-right tabular-nums', m.avgSentenceLength > 25 ? 'text-orange-500 font-semibold' : 'text-slate-600 dark:text-slate-300')}>{m.avgSentenceLength}</td>
      <td className={cn('px-3 py-2.5 text-right tabular-nums font-semibold', readabilityColor(m.readabilityScore))}>{m.readabilityScore}</td>
      <td className={cn('px-3 py-2.5 text-right tabular-nums', m.longSentences > 5 ? 'text-orange-500 font-semibold' : 'text-slate-600 dark:text-slate-300')}>{m.longSentences}</td>
      <td className={cn('px-3 py-2.5 text-right tabular-nums', passiveDensity > 4 ? 'text-red-500 font-semibold' : 'text-slate-600 dark:text-slate-300')}>{m.passiveVoiceCount}</td>
      <td className={cn('px-3 py-2.5 text-right tabular-nums', adverbDensity > 3 ? 'text-indigo-500 font-semibold' : 'text-slate-600 dark:text-slate-300')}>{m.adverbCount}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          {dialoguePct > 0 && <MessageSquare size={11} className="text-slate-300 dark:text-slate-600" />}
          {dialoguePct}%
        </span>
      </td>
      <td className="px-2 py-2.5 text-right">
        <button
          onClick={onOpen}
          title="Buka bab di editor"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors active:scale-95"
        >
          Buka <ArrowUpRight size={12} />
        </button>
      </td>
    </tr>
  );
}

function highlightEcho(excerpt: string, word: string): React.ReactNode {
  // Sorot kemunculan kata (case-insensitive) di dalam cuplikan agar echo mudah dilihat.
  const parts: React.ReactNode[] = [];
  const lower = excerpt.toLowerCase();
  const target = word.toLowerCase();
  let from = 0;
  let key = 0;
  for (let i = lower.indexOf(target, from); i !== -1; i = lower.indexOf(target, from)) {
    // Hanya sorot bila batas kata (hindari mencocokkan substring di tengah kata lain).
    const before = i === 0 ? '' : lower[i - 1];
    const after = lower[i + target.length] ?? '';
    const isBoundary = !/[a-z]/.test(before) && !/[a-z]/.test(after);
    if (isBoundary) {
      if (i > from) parts.push(excerpt.slice(from, i));
      parts.push(
        <mark key={key++} className="bg-indigo-100 dark:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300 rounded px-0.5 font-semibold">
          {excerpt.slice(i, i + target.length)}
        </mark>,
      );
      from = i + target.length;
    } else {
      // lewati kecocokan non-batas: dorong maju agar tak berputar tanpa henti
      parts.push(excerpt.slice(from, i + target.length));
      from = i + target.length;
    }
  }
  if (from < excerpt.length) parts.push(excerpt.slice(from));
  return parts;
}

function ProximityRow({ echo, onJump }: { echo: ProximityEcho; onJump: () => void }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-start gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/50">
            {echo.word}
          </span>
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 tabular-nums">jarak {echo.distance} kata</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">· {echo.chapterTitle || `Bab ${echo.chapterIndex + 1}`}</span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words">
          …{highlightEcho(echo.excerpt, echo.word)}…
        </p>
      </div>
      <button
        onClick={onJump}
        title="Lompat ke lokasi di editor"
        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors active:scale-95"
      >
        Lompat <ArrowUpRight size={12} />
      </button>
    </div>
  );
}
