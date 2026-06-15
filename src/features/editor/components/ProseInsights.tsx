/**
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ProseMetrics } from '@/src/types';
import { Gauge, BookOpen, AlertCircle, Sparkles, Wand2, Globe } from 'lucide-react';
import { stripHtml } from '@/src/lib/editorUtils';

interface ProseInsightsProps {
  content: string;
}

type Language = 'en' | 'id';

// --- Heuristik bahasa Indonesia (tanpa kamus/library) ---
// Tujuannya presisi, bukan kelengkapan: lebih baik melewatkan beberapa daripada
// salah menandai kata umum sebagai pasif (false positive).

// Kata berawalan "di-" yang BUKAN verba pasif (nomina/adjektiva/keterangan umum).
const DI_NON_PASSIVE = new Set([
  'dingin', 'dinding', 'dinas', 'dini', 'diam', 'diktator', 'dilema', 'dimensi',
  'direktur', 'diskusi', 'diskon', 'distrik', 'divisi', 'dividen', 'dialog',
  'diagram', 'diameter', 'diare', 'diet', 'dirinya', 'diktE', 'dingklik',
  'dinamis', 'dinosaurus', 'diploma', 'diktat', 'diksi'
]);

// Kata berawalan "ter-" yang BUKAN verba pasif (superlatif/adjektiva/keterangan).
const TER_NON_PASSIVE = new Set([
  // superlatif (ter- + adjektiva)
  'terbaik', 'terbesar', 'tertinggi', 'terkecil', 'tercepat', 'terindah',
  'terburuk', 'terkuat', 'terlemah', 'termuda', 'tertua', 'terpanjang',
  'terpendek', 'terbanyak', 'terdekat', 'terjauh', 'termahal', 'termurah',
  'terbaru', 'terlama', 'terdahulu', 'terhebat', 'ternama', 'terkemuka',
  'terpenting', 'terkenal',
  // adjektiva/keterangan umum
  'terang', 'teratur', 'terampil', 'terlalu', 'terutama', 'tertentu',
  'terima', 'teringat', 'teras', 'teropong', 'terompet', 'teratai',
  'terminal', 'teritori', 'terjemah', 'teri', 'teh'
]);

// Verba pasif "di-" tanpa sufiks -kan/-i yang sering muncul dalam prosa.
const DI_COMMON_PASSIVE = new Set([
  'dimakan', 'diminum', 'dibaca', 'ditulis', 'dilihat', 'didengar', 'dibawa',
  'diambil', 'dibuat', 'dikirim', 'ditemukan', 'dipakai', 'digunakan',
  'dipukul', 'ditendang', 'dipegang', 'dibunuh', 'diserang', 'dikejar',
  'ditangkap', 'dibuang', 'ditarik', 'didorong', 'dipanggil', 'dikenal',
  'ditahan', 'dijaga', 'dijual', 'dibeli', 'dikunci', 'ditutup', 'dibuka'
]);

// Verba pasif/resultatif "ter-" umum (ter- sangat ambigu, jadi pakai daftar).
const TER_COMMON_PASSIVE = new Set([
  'terbawa', 'terjatuh', 'terlihat', 'terdengar', 'tertidur', 'terbangun',
  'terluka', 'terlempar', 'terhempas', 'tersandung', 'tergeletak', 'terbaring',
  'terjebak', 'terperangkap', 'tertangkap', 'terbunuh', 'tertusuk', 'terkena',
  'tersentuh', 'terdorong', 'terangkat', 'terhapus', 'tertulis', 'terpasang',
  'terbakar', 'tersisa', 'terpaksa', 'terhanyut', 'terseret', 'tertimpa'
]);

// Buang tanda baca di awal/akhir, pertahankan tanda hubung internal (mis. "benar-benar").
function cleanToken(w: string): string {
  return w.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
}

function isPassiveID(w: string): boolean {
  if (w.length < 5) return false; // "dia", "diri", "diam", "dini" tersaring di sini
  if (w.startsWith('di')) {
    if (DI_NON_PASSIVE.has(w)) return false;
    // di- + sufiks verba (-kan/-i) → hampir pasti pasif; atau verba pasif umum
    if (/^di[a-z]{2,}(kan|i)$/.test(w)) return true;
    return DI_COMMON_PASSIVE.has(w);
  }
  if (w.startsWith('ter') && w.length >= 6) {
    if (TER_NON_PASSIVE.has(w)) return false;
    // ter- + sufiks verba, atau verba resultatif umum (daftar)
    return /^ter[a-z]{2,}(kan|i)$/.test(w) || TER_COMMON_PASSIVE.has(w);
  }
  return false;
}

const ID_ADVERBS = new Set([
  'sangat', 'amat', 'sekali', 'agak', 'paling', 'sungguh', 'begitu', 'terlalu',
  'cukup', 'hampir', 'selalu', 'sering', 'jarang', 'kadang', 'kadang-kadang',
  'biasanya', 'segera', 'tiba-tiba', 'perlahan', 'diam-diam', 'benar-benar',
  'betul-betul', 'secara', 'rupanya', 'tampaknya', 'sepertinya'
]);

export function ProseInsights({ content }: ProseInsightsProps) {
  const [language, setLanguage] = useState<Language>('id');

  const metrics = useMemo<ProseMetrics>(() => {
    const text = stripHtml(content).trim();
    if (!text) return {
      wordCount: 0,
      sentenceCount: 0,
      avgSentenceLength: 0,
      longSentences: 0,
      passiveVoiceCount: 0,
      adverbCount: 0,
      readabilityScore: 0
    };

    const words = text.split(/\s+/);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const cleanWords = words.map(cleanToken).filter(Boolean);

    let adverbs = 0;
    let passiveCount = 0;

    if (language === 'en') {
      // Simple adverb detection (ending in 'ly')
      adverbs = cleanWords.filter(w => w.endsWith('ly')).length;

      // Simple passive voice detection
      const passiveWords = ['was', 'were', 'been', 'being', 'is', 'am', 'are'];
      passiveCount = cleanWords.filter((w, i) =>
        passiveWords.includes(w) &&
        cleanWords[i + 1]?.endsWith('ed')
      ).length;
    } else {
      adverbs = cleanWords.filter(w => ID_ADVERBS.has(w)).length;
      passiveCount = cleanWords.filter(isPassiveID).length;
    }

    const longSentences = sentences.filter(s => s.trim().split(/\s+/).length > 25).length;
    
    // Flesch Reading Ease (simplified)
    const syllables = text.toLowerCase().match(/[aeiouy]+/g)?.length || 0;
    const readability = Math.max(0, Math.min(100, Math.round(
      206.835 - 1.015 * (words.length / (sentences.length || 1)) - 84.6 * (syllables / words.length)
    )));

    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      avgSentenceLength: Math.round(words.length / (sentences.length || 1)),
      longSentences,
      passiveVoiceCount: passiveCount,
      adverbCount: adverbs,
      readabilityScore: readability
    };
  }, [content, language]);

  const getReadabilityColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getReadabilityLabel = (score: number) => {
    if (language === 'en') {
      if (score >= 80) return 'Very Easy';
      if (score >= 60) return 'Standard';
      if (score >= 40) return 'Fairly Difficult';
      return 'Very Difficult';
    } else {
      if (score >= 80) return 'Sangat Mudah';
      if (score >= 60) return 'Standar';
      if (score >= 40) return 'Cukup Sulit';
      return 'Sangat Sulit';
    }
  };

  const t = {
    title: language === 'en' ? 'Prose Insights' : 'Wawasan Prosa',
    readability: language === 'en' ? 'Readability Score' : 'Skor Keterbacaan',
    targeting: language === 'en' ? 'Targeting' : 'Target gaya:',
    style: language === 'en' ? 'style.' : '',
    avgSentence: language === 'en' ? 'Avg. Sentence' : 'Rata-rata Kalimat',
    words: language === 'en' ? 'words' : 'kata',
    longSentences: language === 'en' ? 'Long Sentences' : 'Kalimat Panjang',
    styleAlerts: language === 'en' ? 'Style Alerts' : 'Peringatan Gaya',
    passiveVoice: language === 'en' ? 'Passive verbs (estimate)' : 'Kata kerja pasif (perkiraan)',
    passiveVoiceDesc: language === 'en' 
      ? 'Consider using active verbs to make your prose more punchy.' 
      : 'Pertimbangkan menggunakan kata kerja aktif agar kalimat lebih lugas.',
    adverbHeavy: language === 'en' ? 'Adverb heavy' : 'Banyak Kata Keterangan',
    adverbHeavyDesc: language === 'en'
      ? '"The road to hell is paved with adverbs." Try stronger verbs instead.'
      : 'Terlalu banyak kata keterangan bisa melemahkan kalimat. Gunakan kata kerja yang lebih kuat.',
    lengthySentences: language === 'en' ? 'Lengthy sentences' : 'Kalimat Terlalu Panjang',
    lengthySentencesDesc: language === 'en'
      ? 'Break up long sentences to improve flow and reader engagement.'
      : 'Pecah kalimat yang panjang untuk melancarkan alur bacaan.',
    aiTip: language === 'en' ? 'AI Tip' : 'Saran AI',
    aiTipDescGood: language === 'en' ? 'easy to read' : 'mudah dibaca',
    aiTipDescBad: language === 'en' ? 'a bit dense' : 'sedikit padat',
    aiTipContext: language === 'en'
      ? "Consider adjusting based on your target audience's genre expectations."
      : "Sesuaikan dengan gaya bahasa dan target pembaca genre Anda."
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 h-full flex flex-col">
      <header className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
        <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Gauge size={14} />
          {t.title}
        </h2>
        <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-700/50 p-1 rounded-md">
          <button 
            onClick={() => setLanguage('en')}
            className={`text-[9px] font-bold px-2 py-0.5 rounded transition-colors ${language === 'en' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
          >
            EN
          </button>
          <button 
            onClick={() => setLanguage('id')}
            className={`text-[9px] font-bold px-2 py-0.5 rounded transition-colors ${language === 'id' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
          >
            ID
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {/* Readability Meter */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t.readability}</span>
            <span className={`text-xs font-bold ${getReadabilityColor(metrics.readabilityScore)}`}>
              {metrics.readabilityScore} / 100
            </span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ease-out bg-current ${getReadabilityColor(metrics.readabilityScore)}`}
              style={{ width: `${Math.max(0, Math.min(100, metrics.readabilityScore))}%`, background: 'currentColor' }}
            />
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">{t.targeting} {getReadabilityLabel(metrics.readabilityScore)} {t.style}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">{t.avgSentence}</p>
            <p className="text-xl font-serif text-slate-800 dark:text-slate-200">{metrics.avgSentenceLength} <span className="text-[10px] font-sans font-medium text-slate-400 dark:text-slate-500">{t.words}</span></p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">{t.longSentences}</p>
            <p className={`text-xl font-serif ${metrics.longSentences > 5 ? 'text-orange-500' : 'text-slate-800 dark:text-slate-200'}`}>{metrics.longSentences}</p>
          </div>
        </div>

        {/* Style Alerts */}
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{t.styleAlerts}</span>
          
          <div className="space-y-2">
            {metrics.passiveVoiceCount > 0 && (
              <div className="flex items-start gap-3 p-3 bg-red-50/50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <AlertCircle size={14} className="text-red-500 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-red-700 dark:text-red-400">{t.passiveVoice} ({metrics.passiveVoiceCount})</p>
                  <p className="text-[10px] text-red-500 dark:text-red-300 leading-tight">{t.passiveVoiceDesc}</p>
                </div>
              </div>
            )}

            {metrics.adverbCount > 10 && (
              <div className="flex items-start gap-3 p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                <Sparkles size={14} className="text-indigo-500 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400">{t.adverbHeavy} ({metrics.adverbCount})</p>
                  <p className="text-[10px] text-indigo-500 dark:text-indigo-300 leading-tight">{t.adverbHeavyDesc}</p>
                </div>
              </div>
            )}

            {metrics.longSentences > 3 && (
              <div className="flex items-start gap-3 p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                <BookOpen size={14} className="text-amber-500 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">{t.lengthySentences}</p>
                  <p className="text-[10px] text-amber-500 dark:text-amber-300 leading-tight">{t.lengthySentencesDesc}</p>
                </div>
              </div>
            )}
            
            {metrics.passiveVoiceCount === 0 && metrics.adverbCount <= 10 && metrics.longSentences <= 3 && (
               <div className="flex items-start gap-3 p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
               <Sparkles size={14} className="text-emerald-500 mt-0.5" />
               <div>
                 <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">{language === 'en' ? 'Looking Good!' : 'Tampak Bagus!'}</p>
                 <p className="text-[10px] text-emerald-500 dark:text-emerald-300 leading-tight">{language === 'en' ? 'No major stylistic issues detected.' : 'Tidak ada masalah gaya penulisan major yang dideteksi.'}</p>
               </div>
             </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-indigo-600 rounded-xl text-white shadow-lg space-y-2">
          <div className="flex items-center gap-2">
            <Wand2 size={12} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{t.aiTip}</span>
          </div>
          <p className="text-[11px] font-medium leading-relaxed opacity-90">
            {language === 'en' ? 'Your prose is currently ' : 'Prosa Anda saat ini '} 
            {metrics.readabilityScore > 60 ? t.aiTipDescGood : t.aiTipDescBad}. 
            {t.aiTipContext}
          </p>
        </div>
      </div>
    </div>
  );
}
