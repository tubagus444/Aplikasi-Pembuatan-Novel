/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '../../lib/utils';
import { DB_KEY_MAP } from '../../lib/constants';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Sparkles, 
  Globe, 
  Zap, 
  User, 
  Clock, 
  StickyNote, 
  CheckCircle2, 
  MapPin, 
  Flag,
  Target,
  Palette,
  Layout,
  MessageSquare,
  Activity,
  ChevronRight
} from 'lucide-react';

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

  const lastLoadedProjectId = useRef<number | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Completion progress
  const progress = useMemo(() => {
    const fields = Object.values(formData);
    const filled = fields.filter(v => 
      Array.isArray(v) ? v.length > 0 : (v && v.toString().trim().length > 0)
    ).length;
    return Math.round((filled / fields.length) * 100);
  }, [formData]);

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
      const existing = await db.bible.where({ projectId, key }).first();
      if (existing) {
        await db.bible.update(existing.id!, { instruction: value });
      } else {
        await db.bible.add({ projectId, key, instruction: value });
      }
      setSavedField(key);
      setTimeout(() => setSavedField(null), 2000);
    } catch (e) {
      console.error('Failed to save bible field:', e);
    }
  };

  const handleChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    handleChange(field, value);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const dbKey = DB_KEY_MAP[field as string] || (field === 'genres' ? '__GENRES__' : field === 'tones' ? '__TONES__' : field === 'pov' ? '__POV__' : field === 'pacing' ? '__PACING__' : null);
      if (dbKey) saveField(dbKey, value);
    }, 800);
  };

  const handleBlur = (field: keyof typeof formData) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    const dbKey = DB_KEY_MAP[field as string] || (field === 'genres' ? '__GENRES__' : field === 'tones' ? '__TONES__' : field === 'pov' ? '__POV__' : field === 'pacing' ? '__PACING__' : null);
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

  const sectionVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6 }
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-40 pt-12 px-6 sm:px-10 lg:px-16 selection:bg-indigo-100 dark:selection:bg-indigo-900/40">
      
      {/* Progress Floating Bar */}
      <div className="sticky top-0 z-[50] py-4 mb-8 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/5 -mx-6 sm:-mx-10 lg:-mx-16 px-6 sm:px-10 lg:px-16 transition-all">
        <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <BookOpen size={16} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Story Bible</h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-500 font-medium tracking-wide uppercase">Core Story Constraints</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-1.5">Progress Dokumentasi</span>
              <div className="flex items-center gap-4">
                <div className="w-40 h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-200/50 dark:border-white/5">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: "circOut" }}
                  />
                </div>
                <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">{progress}%</span>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />
            <AnimatePresence mode="wait">
              {savedField ? (
                <motion.div 
                  key="saved"
                  initial={{ opacity: 0, scale: 0.9, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -5 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-widest shadow-sm shadow-emerald-500/10"
                >
                  <CheckCircle2 size={12} /> Tersimpan
                </motion.div>
              ) : (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border border-transparent text-[10px] font-bold uppercase tracking-widest"
                >
                  <Activity size={12} /> Auto-Saving
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      
      {/* KELOMPOK 1: Identitas Utama */}
      <motion.section 
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="space-y-12"
      >
        <div className="space-y-6">
          <div className="relative group">
            <input 
              className="w-full bg-transparent border-none p-0 text-4xl sm:text-5xl font-serif font-black text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-0 focus:outline-none transition-all"
              placeholder="Judul Proyek"
              value={formData.title}
              onChange={e => handleFieldChange('title', e.target.value)}
              onBlur={() => handleBlur('title')}
            />
            <div className="absolute -left-12 top-1/2 -translate-y-1/2 hidden lg:block opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight className="text-indigo-500 w-8 h-8" />
            </div>
          </div>
          <div className="relative">
            <input 
              className="w-full bg-transparent border-none p-0 text-2xl sm:text-3xl text-slate-400 dark:text-slate-600 placeholder:text-slate-300/50 dark:placeholder:text-slate-700/50 focus:ring-0 focus:outline-none font-light italic transition-all"
              placeholder="Tagline atau premis satu kalimat..."
              value={formData.tagline}
              onChange={e => handleFieldChange('tagline', e.target.value)}
              onBlur={() => handleBlur('tagline')}
            />
          </div>
        </div>

        <div className={cn(
          "bg-white dark:bg-slate-950 border rounded-3xl p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden group transition-all",
          formData.premise ? "border-amber-500/20" : "border-slate-200 dark:border-white/5"
        )}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-500/10 transition-colors" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                formData.premise ? "bg-amber-500 text-white" : "bg-amber-500/10 text-amber-500"
              )}>
                <Target size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-[0.2em]">Premis Utama</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-500 font-medium">Jiwa dari keseluruhan ceritamu</p>
              </div>
            </div>
            <span className={cn(
              "text-[10px] font-mono font-bold px-3 py-1 rounded-full border transition-all",
              formData.premise.length > 400 ? "border-amber-500/30 bg-amber-500/5 text-amber-500" : "border-slate-200 dark:border-white/5 text-slate-400"
            )}>
              {formData.premise.length} / 500
            </span>
          </div>
          
          <textarea 
            className="w-full bg-transparent border-none p-0 text-lg leading-relaxed text-slate-700 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-0 min-h-[140px] resize-none transition-all outline-none font-medium"
            placeholder="Seorang [Protagonis] harus [Melakukan Sesuatu] untuk [Mencapai Tujuan] tapi terhalang oleh [Antagonis/Internal Conflict]..."
            value={formData.premise}
            onChange={e => handleFieldChange('premise', e.target.value.substring(0, 500))}
            onBlur={() => handleBlur('premise')}
          />
          
          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-600 italic">
              <Sparkles size={14} className="text-amber-500" />
              Tip: Fokus pada konflik pusat dan taruhan emosional.
            </div>
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-white/10" />
              <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-white/10" />
            </div>
          </div>
        </div>
      </motion.section>

      {/* KELOMPOK 2: Pembangunan Dunia */}
      <motion.section 
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="mt-16 space-y-8"
      >
        <div className="flex items-center gap-6">
          <h2 className="text-sm font-bold text-slate-400 dark:text-slate-600 uppercase tracking-[0.4em] whitespace-nowrap">Dunia & Latar</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-white/10 to-transparent" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className={cn(
            "group relative bg-white dark:bg-slate-950 border rounded-3xl p-6 transition-all hover:shadow-xl shadow-slate-200/30 dark:shadow-none",
            formData.setting ? "border-rose-500/20" : "border-slate-200 dark:border-white/5"
          )}>
            <div className="flex items-center gap-3 mb-4">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                formData.setting ? "bg-rose-500 text-white" : "bg-rose-500/10 text-rose-500"
              )}>
                <MapPin size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Setting / Latar</h3>
            </div>
            <textarea 
              className="w-full bg-transparent border-none p-0 text-base leading-relaxed text-slate-600 dark:text-slate-400 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-0 min-h-[100px] resize-none transition-all outline-none"
              placeholder="Geografi, sistem pemerintahan, atau atmosfer unik dari duniamu..."
              value={formData.setting}
              onChange={e => handleFieldChange('setting', e.target.value.substring(0, 400))}
              onBlur={() => handleBlur('setting')}
            />
          </div>

          <div className={cn(
            "group relative bg-white dark:bg-slate-950 border rounded-3xl p-6 transition-all hover:shadow-xl shadow-slate-200/30 dark:shadow-none",
            formData.themes ? "border-emerald-500/20" : "border-slate-200 dark:border-white/5"
          )}>
            <div className="flex items-center gap-3 mb-4">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                formData.themes ? "bg-emerald-500 text-white" : "bg-emerald-500/10 text-emerald-500"
              )}>
                <Palette size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Tema & Pesan</h3>
            </div>
            <textarea 
              className="w-full bg-transparent border-none p-0 text-base leading-relaxed text-slate-600 dark:text-slate-400 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-0 min-h-[100px] resize-none transition-all outline-none"
              placeholder="Kebenaran universal, pertanyaan moral, atau motif yang ingin dieksplorasi..."
              value={formData.themes}
              onChange={e => handleFieldChange('themes', e.target.value)}
              onBlur={() => handleBlur('themes')}
            />
          </div>
        </div>
      </motion.section>

      {/* KELOMPOK 3: Karakteristik */}
      <motion.section 
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="mt-16 space-y-12"
      >
        <div className="flex items-center gap-6">
          <h2 className="text-sm font-bold text-slate-400 dark:text-slate-600 uppercase tracking-[0.4em] whitespace-nowrap">Pilar Narasi</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-white/10 to-transparent" />
        </div>

        <div className="space-y-12">
          <div className="bg-slate-50/50 dark:bg-slate-900/20 rounded-3xl p-8 border border-slate-200/50 dark:border-white/5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                  <Zap size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Genre & Atmosphere</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-500 font-medium">Pilih hingga 3 sub-genre</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white dark:bg-slate-950 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/5">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono tracking-widest">{formData.genres.length} / 3</span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {GENRES.map(g => {
                const isActive = formData.genres.includes(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => toggleArrayItem('genres', g.id, 3)}
                    className={cn(
                      "group flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all duration-300",
                      isActive 
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/30" 
                        : "bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-indigo-500/40 hover:text-indigo-600"
                    )}
                  >
                    <span className="text-lg leading-none group-hover:scale-110 transition-transform">{g.icon}</span>
                    <span className="tracking-tight">{g.label}</span>
                  </button>
                )
              })}
            </div>
            
            <div className="mt-8 mb-8 h-px bg-slate-200 dark:bg-white/10" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
                  <Palette size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Nada / Tone</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-500 font-medium">Warna emosional dominan</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white dark:bg-slate-950 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/5">
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono tracking-widest">{formData.tones.length} / 3</span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {TONES.map(t => {
                const isActive = formData.tones.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleArrayItem('tones', t.id, 3)}
                    className={cn(
                      "group flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all duration-300",
                      isActive 
                        ? "bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-500/30" 
                        : "bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-rose-500/40 hover:text-rose-600"
                    )}
                  >
                    <span className="text-lg leading-none group-hover:scale-110 transition-transform">{t.icon}</span>
                    <span className="tracking-tight">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <User size={16} />
                </div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Sudut Pandang (POV)</h3>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {POVS.map(p => {
                  const isActive = formData.pov === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => selectRadio('pov', p.id, '__POV__')}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all group relative",
                        isActive 
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/20" 
                          : "bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 hover:border-emerald-500/30"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex flex-shrink-0 items-center justify-center transition-all",
                        isActive ? "border-white bg-white/20" : "border-slate-200 dark:border-white/10 group-hover:border-emerald-500"
                      )}>
                        {isActive && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <div>
                        <p className={cn("font-bold text-xs", isActive ? "text-white" : "text-slate-800 dark:text-slate-200")}>{p.label}</p>
                        <p className={cn("text-[10px] mt-0.5 opacity-80", isActive ? "text-white" : "text-slate-500")}>{p.desc}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Clock size={16} />
                </div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Kecepatan (Pacing)</h3>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {PACINGS.map(p => {
                  const isActive = formData.pacing === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => selectRadio('pacing', p.id, '__PACING__')}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all group relative",
                        isActive 
                          ? "bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-500/20" 
                          : "bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 hover:border-amber-500/30"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex flex-shrink-0 items-center justify-center transition-all",
                        isActive ? "border-white bg-white/20" : "border-slate-200 dark:border-white/10 group-hover:border-amber-500"
                      )}>
                        {isActive && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <div>
                        <p className={cn("font-bold text-xs", isActive ? "text-white" : "text-slate-800 dark:text-slate-200")}>{p.label}</p>
                        <p className={cn("text-[10px] mt-0.5 opacity-80", isActive ? "text-white" : "text-slate-500")}>{p.desc}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* KELOMPOK 4: Catatan */}
      <motion.section 
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="mt-16 space-y-8"
      >
        <div className="flex items-center gap-6">
          <h2 className="text-sm font-bold text-slate-400 dark:text-slate-600 uppercase tracking-[0.4em] whitespace-nowrap">Catatan Penulis</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-white/10 to-transparent" />
        </div>
        
        <div className={cn(
          "bg-white dark:bg-slate-950 border rounded-3xl p-8 transition-all hover:shadow-xl relative overflow-hidden group",
          formData.notes ? "border-indigo-500/20" : "border-slate-200 dark:border-white/5"
        )}>
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-start gap-5 mb-6">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-colors shadow-inner",
              formData.notes ? "bg-indigo-600 text-white" : "bg-indigo-50 dark:bg-indigo-900/10 text-indigo-500"
            )}>
              <StickyNote size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Refleksi & Inspirasi</h3>
              <p className="text-xs text-slate-500 dark:text-slate-500 font-medium">Simpan ide liar, riset, atau pengingat penting</p>
            </div>
          </div>
          
          <textarea 
            className="w-full bg-transparent border-none p-0 text-lg font-serif leading-loose text-slate-700 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-0 min-h-[300px] resize-none transition-all outline-none"
            placeholder="Mulai menulis catatan pribadimu..."
            value={formData.notes}
            onChange={e => handleFieldChange('notes', e.target.value)}
            onBlur={() => handleBlur('notes')}
          />
        </div>
      </motion.section>

      {/* Footer */}
      <div className="mt-12 text-center pb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50/50 dark:bg-slate-900/30 rounded-full border border-slate-200/50 dark:border-white/5 mx-auto">
          <CheckCircle2 className="text-emerald-500 w-3 h-3" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">Terakhir diperbarui hari ini</p>
        </div>
      </div>

    </div>
  );
}
