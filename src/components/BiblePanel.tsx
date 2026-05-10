/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '../lib/utils';

interface BiblePanelProps {
  projectId: number;
}

const GENRES = [
  { id: 'epic', label: 'Epic Fantasy', icon: '⚔️' },
  { id: 'dark', label: 'Dark Fantasy', icon: '🌑' },
  { id: 'urban', label: 'Urban Fantasy', icon: '🏙️' },
  { id: 'high', label: 'High Fantasy', icon: '🏰' },
  { id: 'low', label: 'Low Fantasy', icon: '🗡️' },
  { id: 'mythpunk', label: 'Mythpunk', icon: '🌀' },
  { id: 'grimdark', label: 'Grimdark', icon: '💀' },
  { id: 'cozy', label: 'Cozy Fantasy', icon: '☕' },
  { id: 'portal', label: 'Portal Fantasy', icon: '🚪' },
  { id: 'flintlock', label: 'Flintlock', icon: '🔫' },
  { id: 'progression', label: 'Progression', icon: '📈' },
  { id: 'romantasy', label: 'Romantasy', icon: '🌹' },
];

const TONES = [
  { id: 'epik', label: 'Epik', icon: '⚡' },
  { id: 'gelap', label: 'Gelap', icon: '🔮' },
  { id: 'whimsical', label: 'Whimsical', icon: '🦋' },
  { id: 'tragis', label: 'Tragis', icon: '💔' },
  { id: 'penuh-harap', label: 'Penuh Harap', icon: '🌅' },
  { id: 'misterius', label: 'Misterius', icon: '📓' },
  { id: 'humoris', label: 'Humoris', icon: '🤩' },
  { id: 'realistis', label: 'Realistis', icon: '🌧️' },
  { id: 'romantis', label: 'Romantis', icon: '🌹' },
];

const POVS = [
  { id: '1st-single', label: 'Orang Pertama Tunggal', desc: '"Aku berjalan ke..."' },
  { id: '1st-plural', label: 'Orang Pertama Jamak', desc: '"Kami berjalan ke..."' },
  { id: '3rd-limited', label: 'Orang Ketiga Terbatas', desc: 'Mengikuti satu karakter' },
  { id: '3rd-omniscient', label: 'Orang Ketiga Omniscient', desc: 'Semua perspektif' },
  { id: '2nd', label: 'Orang Kedua', desc: '"Kamu berjalan ke..."' },
  { id: 'multi', label: 'Multi-POV', desc: 'Bergantian antar karakter' },
];

const PACINGS = [
  { id: 'slow', label: 'Slow Burn', desc: 'Membangun perlahan, kaya detail' },
  { id: 'balanced', label: 'Seimbang', desc: 'Campuran aksi dan refleksi' },
  { id: 'fast', label: 'Bergerak Cepat', desc: 'Aksi terus menerus' },
  { id: 'episodic', label: 'Episodik', desc: 'Cerita dalam cerita' },
];

export function BiblePanel({ projectId }: BiblePanelProps) {
  const allRules = useLiveQuery(() => 
    db.bible.where('projectId').equals(projectId).toArray()
  , [projectId]);

  const [formData, setFormData] = useState({
    title: '',
    tagline: '',
    genres: [] as string[],
    premise: '',
    setting: '',
    themes: '',
    tones: [] as string[],
    pov: '',
    pacing: '',
    notes: ''
  });

  const [savedField, setSavedField] = useState<string | null>(null);

  const DB_KEY_MAP: Record<string, string> = {
    title: '__STORY_TITLE__',
    tagline: '__STORY_TAGLINE__',
    premise: '__CORE_PREMISE__',
    setting: '__WORLD_SETTING__',
    themes: '__THEMES__',
    notes: '__AUTHOR_NOTES__',
  };

  const lastLoadedProjectId = useRef<number | null>(null);

  // Load from DB
  useEffect(() => {
    if (allRules && lastLoadedProjectId.current !== projectId) {
      lastLoadedProjectId.current = projectId;
      const getVal = (k: string) => allRules.find(r => r.key === k)?.instruction || '';
      const getArr = (k: string) => {
        const val = getVal(k);
        try { return val ? JSON.parse(val) : []; } catch (e) { return []; }
      };

      setFormData({
        title: getVal('__STORY_TITLE__'),
        tagline: getVal('__STORY_TAGLINE__'),
        genres: getArr('__GENRES__'),
        premise: getVal('__CORE_PREMISE__'),
        setting: getVal('__WORLD_SETTING__'),
        themes: getVal('__THEMES__'),
        tones: getArr('__TONES__'),
        pov: getVal('__POV__'),
        pacing: getVal('__PACING__'),
        notes: getVal('__AUTHOR_NOTES__')
      });
    }
  }, [allRules, projectId]);

  const saveField = async (key: string, value: string) => {
    try {
      await db.bible.put({ projectId, key, instruction: value });
      setSavedField(key);
      setTimeout(() => setSavedField(null), 1500);
    } catch (e) {
      console.error('Failed to save bible field:', e);
    }
  };

  const handleChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBlur = (field: keyof typeof formData) => {
    const dbKey = DB_KEY_MAP[field as string];
    if (dbKey) saveField(dbKey, String(formData[field]));
  };

  const toggleArrayItem = (field: 'genres' | 'tones', id: string, max?: number) => {
    const arr = formData[field];
    let newArr = [...arr];
    if (newArr.includes(id)) {
      newArr = newArr.filter(i => i !== id);
    } else {
      if (max && newArr.length >= max) {
        newArr.shift(); // Remove oldest if exceeding max
      }
      newArr.push(id);
    }
    handleChange(field, newArr);
    saveField(field === 'genres' ? '__GENRES__' : '__TONES__', JSON.stringify(newArr));
  };

  const selectRadio = (field: 'pov' | 'pacing', id: string, dbKey: string) => {
    handleChange(field, id);
    saveField(dbKey, id);
  };

  return (
    <div className="max-w-3xl mx-auto pb-32 mt-8 px-4 sm:px-6 md:px-8">
      
      {/* KELOMPOK 1: Identitas Utama */}
      <section className="space-y-8">
        <div className="space-y-2 border-b border-slate-200 dark:border-white/5 pb-8">
          <div className="relative">
            <input 
              className="w-full bg-transparent border-none p-0 text-4xl sm:text-5xl font-serif font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700/50 focus:ring-0 focus:outline-none transition-colors"
              placeholder="Judul Novel..."
              value={formData.title}
              onChange={e => handleChange('title', e.target.value)}
              onBlur={() => handleBlur('title')}
            />
            {savedField === '__STORY_TITLE__' && (
              <span className="text-sm text-emerald-500 font-normal absolute top-0 right-0 mt-3">✓ Tersimpan</span>
            )}
          </div>
          <div className="relative">
            <input 
              className="w-full bg-transparent border-none p-0 text-xl sm:text-2xl text-slate-500 dark:text-slate-400 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:ring-0 focus:outline-none font-light transition-colors"
              placeholder="Satu kalimat tagline esensial..."
              value={formData.tagline}
              onChange={e => handleChange('tagline', e.target.value)}
              onBlur={() => handleBlur('tagline')}
            />
            {savedField === '__STORY_TAGLINE__' && (
              <span className="text-xs text-emerald-500 font-normal absolute top-0 right-0 mt-1">✓ Tersimpan</span>
            )}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-end mb-3">
            <h3 className="flex items-center text-sm font-semibold text-slate-900 dark:text-slate-200 tracking-wide">
              Premis Utama
              {savedField === '__CORE_PREMISE__' && (
                <span className="text-xs text-emerald-500 ml-2 font-normal">✓ Tersimpan</span>
              )}
            </h3>
            <span className="text-xs text-slate-400 dark:text-slate-500">{formData.premise.length}/500</span>
          </div>
          <div className="relative">
            <textarea 
              className="w-full bg-slate-50 dark:bg-[#1F1F22] border-0 rounded-2xl p-5 text-base leading-relaxed text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-1 focus:ring-amber-500/50 min-h-[160px] resize-none transition-all"
              placeholder="mis. Seorang pencuri yatim piatu menemukan bahwa kekuatannya berasal dari dewa yang terlupakan..."
              value={formData.premise}
              onChange={e => handleChange('premise', e.target.value.substring(0, 500))}
              onBlur={() => handleBlur('premise')}
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 flex items-center gap-1.5"><span className="text-amber-500">💡</span> Formula: <strong>[Siapa] harus [Apa] sebelum [Taruhan], atau [Konsekuensi].</strong></p>
        </div>
      </section>

      {/* KELOMPOK 2: Pembangunan Dunia */}
      <section className="mt-16 space-y-8">
        <div className="border-b border-slate-200 dark:border-white/5 pb-4 mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pembangunan Dunia</h2>
          <p className="text-sm text-slate-500 mt-1">Latar belakang, aturan, dan roh ceritamu.</p>
        </div>

        <div>
          <div className="flex justify-between items-end mb-3">
            <h3 className="flex items-center text-sm font-semibold text-slate-900 dark:text-slate-200 tracking-wide">
              Setting Dunia
              {savedField === '__WORLD_SETTING__' && (
                <span className="text-xs text-emerald-500 ml-2 font-normal">✓ Tersimpan</span>
              )}
            </h3>
            <span className="text-xs text-slate-400 dark:text-slate-500">{formData.setting.length}/400</span>
          </div>
          <textarea 
            className="w-full bg-slate-50 dark:bg-[#1F1F22] border-0 rounded-2xl p-5 text-base leading-relaxed text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-1 focus:ring-amber-500/50 min-h-[120px] resize-none transition-all"
            placeholder="mis. Dunia di mana sihir berasal dari musik..."
            value={formData.setting}
            onChange={e => handleChange('setting', e.target.value.substring(0, 400))}
            onBlur={() => handleBlur('setting')}
          />
        </div>

        <div>
          <div className="mb-3">
            <h3 className="flex items-center text-sm font-semibold text-slate-900 dark:text-slate-200 tracking-wide">
              Tema & Pesan
              {savedField === '__THEMES__' && (
                <span className="text-xs text-emerald-500 ml-2 font-normal">✓ Tersimpan</span>
              )}
            </h3>
          </div>
          <textarea 
            className="w-full bg-slate-50 dark:bg-[#1F1F22] border-0 rounded-2xl p-5 text-base leading-relaxed text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-1 focus:ring-amber-500/50 min-h-[120px] resize-none transition-all"
            placeholder="mis. Pengorbanan vs. ambisi • Identitas di tengah ekspektasi keluarga..."
            value={formData.themes}
            onChange={e => handleChange('themes', e.target.value)}
            onBlur={() => handleBlur('themes')}
          />
        </div>
      </section>

      {/* KELOMPOK 3: Karakteristik */}
      <section className="mt-16 space-y-10">
        <div className="border-b border-slate-200 dark:border-white/5 pb-4 mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Karakteristik</h2>
          <p className="text-sm text-slate-500 mt-1">Genre, nuansa, sudut pandang, hingga laju penceritaan.</p>
        </div>

        <div>
          <div className="mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 tracking-wide">Genre</h3>
              <p className="text-xs text-slate-500 mt-0.5">Pilih sub-genre yang paling mendekati ceritamu.</p>
            </div>
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">{formData.genres.length}/3 dipilih</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {GENRES.map(g => {
              const isActive = formData.genres.includes(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => toggleArrayItem('genres', g.id, 3)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all",
                    isActive 
                      ? "bg-amber-500/10 border-amber-500/50 text-amber-600 dark:text-amber-400" 
                      : "bg-transparent border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  <span className="text-lg leading-none">{g.icon}</span>
                  <span>{g.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 tracking-wide">Nada / Tone</h3>
              <p className="text-xs text-slate-500 mt-0.5">Nuansa cerita yang membangun audiens.</p>
            </div>
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">{formData.tones.length}/3 dipilih</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {TONES.map(t => {
              const isActive = formData.tones.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleArrayItem('tones', t.id, 3)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all",
                    isActive 
                      ? "bg-amber-500/10 border-amber-500/50 text-amber-600 dark:text-amber-400" 
                      : "bg-transparent border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  <span className="text-lg leading-none">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 tracking-wide">Sudut Pandang (POV)</h3>
            </div>
            <div className="space-y-3">
              {POVS.map(p => {
                const isActive = formData.pov === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectRadio('pov', p.id, '__POV__')}
                    className={cn(
                      "w-full flex items-start gap-4 p-4 rounded-2xl border text-left transition-all",
                      isActive 
                        ? "bg-amber-500/5 border-amber-500/30" 
                        : "bg-slate-50 dark:bg-[#1F1F22] border-transparent hover:bg-slate-100 dark:hover:bg-[#252529]"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex flex-shrink-0 items-center justify-center mt-0.5 transition-colors",
                      isActive ? "border-amber-500" : "border-slate-300 dark:border-slate-600"
                    )}>
                      {isActive && <div className="w-2.5 h-2.5 bg-amber-500 rounded-full" />}
                    </div>
                    <div>
                      <p className={cn("font-medium text-sm transition-colors", isActive ? "text-amber-600 dark:text-amber-500" : "text-slate-800 dark:text-slate-200")}>{p.label}</p>
                      <p className={cn("text-xs mt-1 transition-colors", isActive ? "text-amber-600/80 dark:text-amber-500/80" : "text-slate-500 dark:text-slate-500")}>{p.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 tracking-wide">Kecepatan Narasi</h3>
            </div>
            <div className="space-y-3">
              {PACINGS.map(p => {
                const isActive = formData.pacing === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectRadio('pacing', p.id, '__PACING__')}
                    className={cn(
                      "w-full flex items-start gap-4 p-4 rounded-2xl border text-left transition-all",
                      isActive 
                        ? "bg-amber-500/5 border-amber-500/30" 
                        : "bg-slate-50 dark:bg-[#1F1F22] border-transparent hover:bg-slate-100 dark:hover:bg-[#252529]"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex flex-shrink-0 items-center justify-center mt-0.5 transition-colors",
                      isActive ? "border-amber-500" : "border-slate-300 dark:border-slate-600"
                    )}>
                      {isActive && <div className="w-2.5 h-2.5 bg-amber-500 rounded-full" />}
                    </div>
                    <div>
                      <p className={cn("font-medium text-sm transition-colors", isActive ? "text-amber-600 dark:text-amber-500" : "text-slate-800 dark:text-slate-200")}>{p.label}</p>
                      <p className={cn("text-xs mt-1 transition-colors", isActive ? "text-amber-600/80 dark:text-amber-500/80" : "text-slate-500 dark:text-slate-400")}>{p.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* KELOMPOK 4: Catatan */}
      <section className="mt-16 space-y-6">
        <div className="border-b border-slate-200 dark:border-white/5 pb-4 mb-6">
          <h2 className="flex items-center text-2xl font-bold text-slate-900 dark:text-white">
            Catatan Penulis
            {savedField === '__AUTHOR_NOTES__' && (
              <span className="text-sm text-emerald-500 ml-3 font-normal">✓ Tersimpan</span>
            )}
          </h2>
          <p className="text-sm text-slate-500 mt-1">Inspirasi, referensi, atau reminder pribadimu.</p>
        </div>
        
        <textarea 
          className="w-full bg-slate-50 dark:bg-[#1F1F22] border-0 rounded-2xl p-5 text-base leading-relaxed text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-1 focus:ring-amber-500/50 min-h-[160px] resize-none transition-all"
          placeholder="Apa yang menginspirasi cerita ini? Buku, film, atau pengalaman apa yang menjadi referensi? Hal apa yang TIDAK boleh terjadi dalam cerita ini?..."
          value={formData.notes}
          onChange={e => handleChange('notes', e.target.value)}
          onBlur={() => handleBlur('notes')}
        />
      </section>

    </div>
  );
}
