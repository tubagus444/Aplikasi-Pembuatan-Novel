/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useBiblePanel } from '@/src/features/lore/hooks/useBiblePanel';
import { useToast } from '@/src/hooks/useToast';
import { GENRES, TONES, POVS, PACINGS } from '@/src/lib/storyBible';
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
  Palette,
  Target,
  Activity,
  ChevronRight,
  Copy,
  Trash2,
  Lightbulb,
  FileText,
  Bookmark,
  Check,
  ArrowRight,
  RefreshCw,
  Compass,
  Award
} from 'lucide-react';

interface BiblePanelProps {
  projectId: number;
}

// Creative Writing Scaffolds to help writers overcome writer's block
const PROMPT_SUGGESTIONS = {
  premise: [
    { title: "Fantasi Klasik", text: "Seorang [protagonis] terbuang yang menyimpan ramalan rahasia harus [misi utama] demi menyelamatkan [dunia/kerajaan] dari kegelapan abadi..." },
    { title: "Misteri Neon", text: "Ketika sebuah kasus misterius terjadi di kota megapolitan, seorang [detektif] dipaksa bekerja sama dengan musuh bebuyutannya demi mengungkap konspirasi..." },
    { title: "Tragedi Emosional", text: "Demi menebus kesalahan masa lalu, seorang [tokoh utama] harus melakukan perjalanan berbahaya demi memulihkan hubungan dengan..." }
  ],
  setting: [
    { title: "Benteng Awan", text: "Sebuah peradaban epik terapung di atas awan, berbahan bakar uap kristal purba dengan kasta sosial ekstrem..." },
    { title: "Distopia Bio-Sihir", text: "Kota modern gelap berteknologi tinggi di mana sihir telah dipatenkan sebagai komoditas yang disalurkan lewat kabel logam..." },
    { title: "Kerajaan Hutan Kuno", text: "Hutan raksasa abadi yang pohon-pohonnya berusia jutaan tahun, dihuni oleh klan penunggang binatang buas..." }
  ],
  themes: [
    { title: "Moral & Kekuasaan", text: "Apakah keadilan absolut dapat dicapai tanpa berubah menjadi tirani baru, serta bagaimana pengorbanan membentuk jati diri..." },
    { title: "Identitas Kolektif", text: "Pemberontakan individu terhadap takdir warisan leluhur dan pencarian makna kebebasan sejati di bawah bayang-bayang sejarah..." },
    { title: "Teknologi vs Jiwa", text: "Batas moralitas kemajuan ilmu pengetahuan saat harus ditukar dengan hilangnya perasaan emosional manusia..." }
  ],
  notes: [
    { title: "Catatan Mitologi", text: "Riset tambahan: Struktur kuil kuno bernuansa astrologi bintang. Batasi elemen magis agar terasa lebih misterius." },
    { title: "Rencana Konflik", text: "Klimaks utama direncanakan terjadi di bawah gerhana bulan merah untuk menambah ketegangan emosional kedua kubu." }
  ]
};

export function BiblePanel({ projectId }: BiblePanelProps) {
  const {
    formData,
    savedField,
    progress,
    handleFieldChange,
    handleBlur,
    flushField,
    toggleArrayItem,
    selectRadio
  } = useBiblePanel(projectId);

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'world' | 'narrative' | 'notes'>('overview');

  // Check if safe values exist
  const safeTitle = formData.title || '';
  const safeTagline = formData.tagline || '';
  const safePremise = formData.premise || '';
  const safeSetting = formData.setting || '';
  const safeThemes = formData.themes || '';
  const safeNotes = formData.notes || '';
  const safeGenres = formData.genres || [];
  const safeTones = formData.tones || [];
  const safePov = formData.pov || '';
  const safePacing = formData.pacing || '';
  const safeTargetAudience = formData.targetAudience || '';

  // Helpers to copy to clipboard safely
  const handleCopy = (text: string, label: string) => {
    if (!text.trim()) {
      toast.warning(`Kolom "${label}" masih kosong!`);
      return;
    }
    navigator.clipboard.writeText(text);
    toast.success(`"${label}" berhasil disalin ke clipboard!`);
  };

  // Helper clear field with safety confirm
  const handleClear = (field: 'title' | 'tagline' | 'premise' | 'setting' | 'themes' | 'notes', label: string) => {
    if (!formData[field]) return;
    if (window.confirm(`Apakah Anda yakin ingin menghapus isi "${label}"? Tindakan ini akan segera disimpan.`)) {
      handleFieldChange(field, '');
      handleBlur(field);
      toast.info(`"${label}" telah dibersihkan.`);
    }
  };

  // Helper to inject prompt text — simpan nilai gabungan secara eksplisit & langsung
  const handleInjectPrompt = (field: 'premise' | 'setting' | 'themes' | 'notes', text: string) => {
    const currentValue = formData[field] || '';
    const updatedValue = currentValue ? `${currentValue}\n${text}` : text;
    flushField(field, updatedValue);
    toast.success("Inspirasi berhasil disematkan!");
  };

  // Calculate fields filled per category for micro progress details
  const categoriesStatus = useMemo(() => {
    const checkFilled = (val: any) => {
      if (Array.isArray(val)) return val.length > 0;
      return val && val.toString().trim().length > 0;
    };

    return {
      overview: {
        total: 3,
        filled: (checkFilled(safeTitle) ? 1 : 0) + (checkFilled(safeTagline) ? 1 : 0) + (checkFilled(safePremise) ? 1 : 0)
      },
      world: {
        total: 2,
        filled: (checkFilled(safeSetting) ? 1 : 0) + (checkFilled(safeThemes) ? 1 : 0)
      },
      narrative: {
        total: 5,
        filled: (safeGenres.length > 0 ? 1 : 0) + (safeTones.length > 0 ? 1 : 0) + (checkFilled(safePov) ? 1 : 0) + (checkFilled(safePacing) ? 1 : 0) + (checkFilled(safeTargetAudience) ? 1 : 0)
      },
      notes: {
        total: 1,
        filled: checkFilled(safeNotes) ? 1 : 0
      }
    };
  }, [safeTitle, safeTagline, safePremise, safeSetting, safeThemes, safeGenres, safeTones, safePov, safePacing, safeNotes, safeTargetAudience]);

  // Tab definitions
  const tabs = [
    { id: 'overview' as const, label: 'Identitas & Premis', icon: Sparkles, color: 'text-indigo-500' },
    { id: 'world' as const, label: 'Dunia & Latar', icon: Globe, color: 'text-emerald-500' },
    { id: 'narrative' as const, label: 'Pilar Narasi', icon: Zap, color: 'text-amber-500' },
    { id: 'notes' as const, label: 'Catatan Penulis', icon: StickyNote, color: 'text-rose-500' }
  ];

  // Stagger animations for container elements
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  } as any;

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 25 } }
  } as any;

  return (
    <div className="max-w-4xl mx-auto pb-40 pt-10 px-4 sm:px-8 lg:px-12 selection:bg-indigo-100 dark:selection:bg-indigo-950">
      
      {/* Static Integrated Progress Header */}
      <div className="py-5 mb-8 border-b border-slate-200/50 dark:border-white/5 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/10">
              <BookOpen size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Story Bible 
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9px] uppercase tracking-wider font-extrabold">Creative Vault</span>
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wider uppercase">Konstitusi Dasar Karya Sastra</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between sm:justify-end gap-5">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-3">
                <div className="hidden md:block w-32 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">{progress}%</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 hidden sm:inline">Selesai</span>
                </div>
              </div>
            </div>
            
            <div className="h-6 w-px bg-slate-200 dark:bg-white/10" />
            
            <AnimatePresence mode="wait">
              {savedField ? (
                <motion.div 
                  key="saved"
                  initial={{ opacity: 0, scale: 0.9, y: 3 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -3 }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-widest shadow-sm shadow-emerald-500/5"
                >
                  <CheckCircle2 size={12} className="animate-pulse" /> Tersimpan
                </motion.div>
              ) : (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest"
                >
                  <Activity size={12} className="animate-pulse text-indigo-500" /> Auto-Saving
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* Main Header Card (Title & Tagline) */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200/50 dark:border-white/5 rounded-3xl p-6 sm:p-8 mb-8 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full -mr-24 -mt-24 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full -ml-16 -mb-16 blur-2xl" />
        
        <div className="flex items-center gap-2 mb-4 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
          <BookOpen size={14} />
          <span>Sampul & Judul Cerita</span>
        </div>

        <div className="space-y-4 relative z-10">
          <div className="relative border-b border-indigo-100 dark:border-slate-800 pb-2 focus-within:border-indigo-500 transition-colors">
            <input 
              id="story-title-input"
              className="w-full bg-transparent border-none p-0 text-3xl sm:text-4xl font-serif font-black text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-0 focus:outline-none transition-all"
              placeholder="Berikan Judul Proyek Mahakarya..."
              value={safeTitle}
              onChange={e => handleFieldChange('title', e.target.value)}
              onBlur={() => handleBlur('title')}
            />
            {safeTitle && (
              <button 
                onClick={() => handleClear('title', 'Judul Proyek')}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-rose-500 transition-colors"
                title="Hapus judul"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <div className="relative pb-1">
            <input 
              id="story-tagline-input"
              className="w-full bg-transparent border-none p-0 text-lg sm:text-xl text-slate-500 dark:text-slate-400 placeholder:text-slate-300/60 dark:placeholder:text-slate-700/60 focus:ring-0 focus:outline-none font-sans italic font-light transition-all"
              placeholder="Tuliskan tagline pemicu gairah pembaca atau premis satu kalimat..."
              value={safeTagline}
              onChange={e => handleFieldChange('tagline', e.target.value)}
              onBlur={() => handleBlur('tagline')}
            />
            {safeTagline && (
              <button 
                onClick={() => handleClear('tagline', 'Tagline')}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-rose-500 transition-colors"
                title="Hapus tagline"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-2">
            <Award size={14} className="text-amber-500" />
            <span>Simpan draf identitas utama untuk memicu imajinasi awal mendalam.</span>
          </div>
          {safeTitle && (
            <button 
              onClick={() => handleCopy(`${safeTitle} - Tagline: ${safeTagline}`, 'Sampul')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/40 dark:border-white/5 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 hover:dark:bg-slate-800 transition-colors"
            >
              <Copy size={11} /> Salin Detail
            </button>
          )}
        </div>
      </div>

      {/* Advanced UI/UX Segmented Tab Switcher with micro status badges */}
      <div className="bg-slate-100 dark:bg-slate-900/50 p-1.5 rounded-2xl flex items-center justify-between gap-1 mb-8 border border-slate-200/50 dark:border-white/5 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const status = categoriesStatus[tab.id];
          const isDone = status.filled === status.total;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex-1 min-w-[130px] flex items-center justify-center gap-2 py-3 px-1.5 rounded-xl text-xs font-bold transition-all text-ellipsis whitespace-nowrap",
                isActive 
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" 
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              {isActive && (
                <motion.div 
                  layoutId="activeTabOutline" 
                  className="absolute inset-0 border border-indigo-500/30 rounded-xl pointer-events-none" 
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon size={14} className={cn(isActive ? tab.color : "opacity-70")} />
              <span>{tab.label}</span>
              
              {/* Mini pill indicating progress per tab */}
              <div className={cn(
                "flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-mono",
                isDone 
                  ? "bg-emerald-500/15 text-emerald-500 dark:bg-emerald-500/20"
                  : status.filled > 0 
                    ? "bg-indigo-500/15 text-indigo-500 dark:bg-indigo-500/20"
                    : "bg-slate-200 text-slate-400 dark:bg-slate-900"
              )}>
                {isDone ? <Check size={8} strokeWidth={3} /> : status.filled}
              </div>
            </button>
          );
        })}
      </div>

      {/* Animated Tab Contents */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={containerVariants}
          initial="hidden"
          animate="show"
          exit="hidden"
          className="space-y-8"
        >
          
          {/* TAB 1: IDENTITAS & PREMIS */}
          {activeTab === 'overview' && (
            <motion.div className="space-y-6" variants={itemVariants}>
              <div className={cn(
                "bg-white dark:bg-slate-950 border rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden group transition-all",
                safePremise ? "border-indigo-500/10 shadow-indigo-500/[0.01]" : "border-slate-200 dark:border-white/5"
              )}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      safePremise ? "bg-indigo-600 text-white" : "bg-indigo-50 dark:bg-indigo-950 text-indigo-500"
                    )}>
                      <Target size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Premis Utama (Logline)</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Jiwa pengikat konflik dan resolusi karya</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleCopy(safePremise, 'Premis Utama')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all"
                      title="Salin premis"
                    >
                      <Copy size={14} />
                    </button>
                    <button 
                      onClick={() => handleClear('premise', 'Premis Utama')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all"
                      title="Kosongkan premis"
                    >
                      <Trash2 size={14} />
                    </button>
                    <span className={cn(
                      "text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border",
                      safePremise.length > 400 ? "border-amber-500/30 bg-amber-500/5 text-amber-500" : "border-slate-200 dark:border-white/5 text-slate-400"
                    )}>
                      {safePremise.length} / 500
                    </span>
                  </div>
                </div>
                
                <textarea 
                  id="story-premise-textarea"
                  className="w-full bg-transparent border-none p-0 text-base leading-relaxed text-slate-700 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-0 min-h-[140px] resize-none transition-all outline-none font-serif font-light"
                  placeholder="Seorang [Protagonis] harus [Melakukan Sesuatu] untuk [Mencapai Tujuan] tapi terhalang oleh [Antagonis/Internal Conflict]..."
                  value={safePremise}
                  onChange={e => handleFieldChange('premise', e.target.value.substring(0, 500))}
                  onBlur={() => handleBlur('premise')}
                />

                {/* Interactive Scaffolds Suggestions to kick writer's block */}
                <div className="mt-6 pt-5 border-t border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">
                    <Lightbulb size={13} className="text-amber-500" />
                    <span>Inspirasi Kilat (Klik salah satu formulasi cerita):</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PROMPT_SUGGESTIONS.premise.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => handleInjectPrompt('premise', p.text)}
                        className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-white/5 text-slate-600 dark:text-slate-300 hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-900 transition-all text-left"
                      >
                        ⚡ <strong>{p.title}</strong>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 italic">
                  <Sparkles size={11} className="text-amber-500" />
                  <span>Petunjuk: Sebutkan motif psikologis terkuat mengapa protagonis harus bertindak.</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: DUNIA & LATAR */}
          {activeTab === 'world' && (
            <motion.div className="grid grid-cols-1 gap-6" variants={containerVariants}>
              
              {/* Setting Card */}
              <motion.div 
                variants={itemVariants}
                className={cn(
                  "bg-white dark:bg-slate-950 border rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden group transition-all",
                  safeSetting ? "border-emerald-500/10" : "border-slate-200 dark:border-white/5"
                )}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105",
                      safeSetting ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40"
                    )}>
                      <MapPin size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Latar / Setting Semesta</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium font-sans">Geografi, sistem masyarakat, aturan magis, fisik dunia</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleCopy(safeSetting, 'Latar Semesta')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all"
                      title="Salin latar"
                    >
                      <Copy size={14} />
                    </button>
                    <button 
                      onClick={() => handleClear('setting', 'Latar Semesta')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all"
                      title="Hapus latar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <textarea 
                  id="story-setting-textarea"
                  className="w-full bg-transparent border-none p-0 text-base leading-relaxed text-slate-600 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-0 min-h-[110px] resize-none transition-all outline-none"
                  placeholder="Deskripsikan kondisi iklim dunia, struktur kekuasaan sosial, legenda yang dipercaya, atau keunikan bentang alam..."
                  value={safeSetting}
                  onChange={e => handleFieldChange('setting', e.target.value.substring(0, 1000))}
                  onBlur={() => handleBlur('setting')}
                />

                {/* Setting Prompt Suggestions */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">
                    <Compass size={11} className="text-emerald-500" />
                    <span>Inspirasi Geografis:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PROMPT_SUGGESTIONS.setting.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleInjectPrompt('setting', s.text)}
                        className="text-[9px] font-semibold px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-white/5 text-slate-600 dark:text-slate-300 hover:border-emerald-500/40 hover:text-emerald-600 transition-all"
                      >
                        🌿 {s.title}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Themes Card */}
              <motion.div 
                variants={itemVariants}
                className={cn(
                  "bg-white dark:bg-slate-950 border rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden group transition-all",
                  safeThemes ? "border-indigo-500/10" : "border-slate-200 dark:border-white/5"
                )}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105",
                      safeThemes ? "bg-indigo-500 text-white" : "bg-indigo-50 text-indigo-500 dark:bg-indigo-950/40"
                    )}>
                      <Palette size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Tema & Filosofi</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium font-sans">Pertanyaan moral besar, motif berulang, esensi filosofis</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleCopy(safeThemes, 'Tema & Filosofi')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all"
                      title="Salin tema"
                    >
                      <Copy size={14} />
                    </button>
                    <button 
                      onClick={() => handleClear('themes', 'Tema & Filosofi')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all"
                      title="Hapus tema"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <textarea 
                  id="story-themes-textarea"
                  className="w-full bg-transparent border-none p-0 text-base leading-relaxed text-slate-600 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-0 min-h-[110px] resize-none transition-all outline-none"
                  placeholder="Pesan moral apa yang ingin disematkan? Pertanyaan filosofis apa yang harus dicarikan jawabannya oleh perjalanan tokoh utama?"
                  value={safeThemes}
                  onChange={e => handleFieldChange('themes', e.target.value)}
                  onBlur={() => handleBlur('themes')}
                />

                {/* Themes Prompt Suggestions */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">
                    <Bookmark size={11} className="text-indigo-500" />
                    <span>Inspirasi Moral:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PROMPT_SUGGESTIONS.themes.map((t, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleInjectPrompt('themes', t.text)}
                        className="text-[9px] font-semibold px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-white/5 text-slate-600 dark:text-slate-300 hover:border-indigo-500/40 hover:text-indigo-600 transition-all"
                      >
                        ⛓️ {t.title}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>

            </motion.div>
          )}

          {/* TAB 3: PILAR NARASI (GEnre, Tone, POV, Pacing) */}
          {activeTab === 'narrative' && (
            <motion.div className="space-y-8" variants={containerVariants}>
              
              {/* Sub-genre selection and Tone side-by-side / bento grid */}
              <motion.div variants={itemVariants} className="bg-slate-50/70 dark:bg-slate-900/40 rounded-3xl p-6 sm:p-8 border border-slate-200/50 dark:border-white/5">
                
                {/* GENRE */}
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/10">
                        <Zap size={20} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Genre & Roda Semesta</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tentukan jangkar genre utama (pilih hingga 3 sub-genre)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-white/5 self-start sm:self-center">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono tracking-widest">{safeGenres.length} / 3</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {GENRES.map(g => {
                      const isActive = safeGenres.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          onClick={() => toggleArrayItem('genres', g.id, 3)}
                          className={cn(
                            "group flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all duration-300 overflow-hidden relative",
                            isActive 
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20" 
                              : "bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-indigo-500/30 hover:bg-slate-50/50 dark:hover:bg-slate-900"
                          )}
                        >
                          <span className="text-base leading-none group-hover:scale-115 transition-transform">{g.icon}</span>
                          <span className="tracking-tight truncate">{g.label}</span>
                          {isActive && (
                            <motion.span 
                              layoutId={`genre-check-${g.id}`} 
                              className="absolute right-2 text-white bg-white/20 p-0.5 rounded-full"
                            >
                              <Check size={8} strokeWidth={3} />
                            </motion.span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                <div className="my-8 h-px bg-slate-200/60 dark:bg-white/5" />
                
                {/* TONES */}
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-md shadow-rose-500/10">
                        <Palette size={20} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Nada / Tone Cerita</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Spektrum emosi dominan yang menyelimuti pembaca</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-white/5 self-start sm:self-center">
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono tracking-widest">{safeTones.length} / 3</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {TONES.map(t => {
                      const isActive = safeTones.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggleArrayItem('tones', t.id, 3)}
                          className={cn(
                            "group flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all duration-300 overflow-hidden relative",
                            isActive 
                              ? "bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-500/20" 
                              : "bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-rose-500/30 hover:bg-slate-50/50 dark:hover:bg-slate-900"
                          )}
                        >
                          <span className="text-base leading-none group-hover:scale-115 transition-transform">{t.icon}</span>
                          <span className="tracking-tight truncate">{t.label}</span>
                          {isActive && (
                            <motion.span 
                              layoutId={`tone-check-${t.id}`} 
                              className="absolute right-2 text-white bg-white/20 p-0.5 rounded-full"
                            >
                              <Check size={8} strokeWidth={3} />
                            </motion.span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </motion.div>

              {/* POV & Pacing Bento Grid layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* POV Section */}
                <motion.div variants={itemVariants} className="space-y-4 bg-white dark:bg-slate-950 border border-slate-200/50 dark:border-white/5 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <User size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Fokus Sudut Pandang (POV)</h3>
                      <p className="text-[9px] text-slate-400 font-medium">Jendela perspektif cerita</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2.5">
                    {POVS.map(p => {
                      const isActive = safePov === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => selectRadio('pov', p.id, '__POV__')}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 group relative",
                            isActive 
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/10" 
                              : "bg-slate-50/50 dark:bg-slate-900/35 border-slate-200/60 dark:border-white/5 hover:border-emerald-500/30"
                          )}
                        >
                          <div className={cn(
                            "w-4 h-4 rounded-full border-2 flex flex-shrink-0 items-center justify-center transition-all",
                            isActive ? "border-white bg-white/25" : "border-slate-300 dark:border-slate-700 group-hover:border-emerald-500"
                          )}>
                            {isActive && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>
                          <div className="overflow-hidden">
                            <p className={cn("font-bold text-xs", isActive ? "text-white" : "text-slate-800 dark:text-slate-200")}>{p.label}</p>
                            <p className={cn("text-[9px] mt-0.5 opacity-85 truncate", isActive ? "text-white" : "text-slate-400 dark:text-slate-500")}>{p.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>

                {/* PACING Section */}
                <motion.div variants={itemVariants} className="space-y-4 bg-white dark:bg-slate-950 border border-slate-200/50 dark:border-white/5 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <Clock size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Kecepatan Alur (Pacing)</h3>
                      <p className="text-[9px] text-slate-400 font-medium">Kecepatan dinamika detak narasi</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2.5">
                    {PACINGS.map(p => {
                      const isActive = safePacing === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => selectRadio('pacing', p.id, '__PACING__')}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 group relative",
                            isActive 
                              ? "bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-500/10" 
                              : "bg-slate-50/50 dark:bg-slate-900/35 border-slate-200/60 dark:border-white/5 hover:border-amber-500/30"
                          )}
                        >
                          <div className={cn(
                            "w-4 h-4 rounded-full border-2 flex flex-shrink-0 items-center justify-center transition-all",
                            isActive ? "border-white bg-white/25" : "border-slate-300 dark:border-slate-700 group-hover:border-amber-500"
                          )}>
                            {isActive && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>
                          <div className="overflow-hidden">
                            <p className={cn("font-bold text-xs", isActive ? "text-white" : "text-slate-800 dark:text-slate-200")}>{p.label}</p>
                            <p className={cn("text-[9px] mt-0.5 opacity-85 truncate", isActive ? "text-white" : "text-slate-400 dark:text-slate-500")}>{p.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>

              </div>

              {/* TARGET AUDIENCE */}
              <motion.div
                variants={itemVariants}
                className={cn(
                  "bg-white dark:bg-slate-950 border rounded-3xl p-6 shadow-sm relative overflow-hidden group transition-all",
                  safeTargetAudience ? "border-sky-500/10" : "border-slate-200/50 dark:border-white/5"
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      safeTargetAudience ? "bg-sky-500 text-white" : "bg-sky-50 text-sky-500 dark:bg-sky-950/40"
                    )}>
                      <Target size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Target Pembaca</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium font-sans">Untuk siapa cerita ini? Usia, selera, & buku pembanding</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(safeTargetAudience, 'Target Pembaca')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all"
                      title="Salin target pembaca"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>

                <textarea
                  id="story-target-audience-textarea"
                  className="w-full bg-transparent border-none p-0 text-base leading-relaxed text-slate-600 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-0 min-h-[80px] resize-none transition-all outline-none"
                  placeholder="Mis. dewasa muda penggemar fantasi epik ala Sanderson; pembaca yang menyukai politik istana & sistem sihir keras..."
                  value={safeTargetAudience}
                  onChange={e => handleFieldChange('targetAudience', e.target.value.substring(0, 500))}
                  onBlur={() => handleBlur('targetAudience')}
                />
              </motion.div>

            </motion.div>
          )}

          {/* TAB 4: CATATAN PENULIS */}
          {activeTab === 'notes' && (
            <motion.div className="space-y-6" variants={itemVariants}>
              <div className={cn(
                "bg-white dark:bg-slate-950 border rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden group transition-all",
                safeNotes ? "border-indigo-500/10" : "border-slate-200 dark:border-white/5"
              )}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-2xl animate-pulse" />
                
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center transition-colors shadow-inner",
                      safeNotes ? "bg-indigo-600 text-white" : "bg-indigo-50 dark:bg-indigo-950 text-indigo-500"
                    )}>
                      <StickyNote size={22} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Refleksi & Inspirasi</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium font-sans">Simpan plot twist rahasia, pengingat, riset, atau ide dadakan</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleCopy(safeNotes, 'Catatan Penulis')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all"
                      title="Salin catatan"
                    >
                      <Copy size={14} />
                    </button>
                    <button 
                      onClick={() => handleClear('notes', 'Catatan Penulis')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all"
                      title="Hapus catatan"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <textarea 
                  id="story-notes-textarea"
                  className="w-full bg-transparent border-none p-0 text-base leading-relaxed text-slate-600 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:ring-0 min-h-[250px] resize-none transition-all outline-none font-serif font-light"
                  placeholder="Mulai ketikkan corat-coret ide gilamu di sini tanpa takut dibatasi format..."
                  value={safeNotes}
                  onChange={e => handleFieldChange('notes', e.target.value)}
                  onBlur={() => handleBlur('notes')}
                />

                {/* Notes Templates suggestions */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">
                    <FileText size={11} className="text-indigo-500" />
                    <span>Inspirasi Catatan Sandbox:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PROMPT_SUGGESTIONS.notes.map((n, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleInjectPrompt('notes', n.text)}
                        className="text-[9px] font-semibold px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-white/5 text-slate-600 dark:text-slate-300 hover:border-indigo-500/40 hover:text-indigo-600 transition-all"
                      >
                        📌 {n.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Smooth Footer Navigation controls to cycle tabs */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/40 dark:border-white/5 p-4 rounded-2xl">
            <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="text-emerald-500 w-4 h-4 shrink-0" />
              <span>Semua draf tersimpan di peramban secara otomatis (Offline Dexie).</span>
            </div>

            {activeTab !== 'notes' && (
              <button
                onClick={() => {
                  const currentIndex = tabs.findIndex(t => t.id === activeTab);
                  if (currentIndex !== -1 && currentIndex < tabs.length - 1) {
                    setActiveTab(tabs[currentIndex + 1].id);
                    // scroll to top smoothly
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-500/10 hover:bg-indigo-500 transition-colors cursor-pointer"
              >
                <span>Selesaikan & Lanjut</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>

        </motion.div>
      </AnimatePresence>

      {/* Decorative credit footer */}
      <div className="mt-8 text-center">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-600 font-bold">Terakhir diperbarui hari ini</p>
      </div>

    </div>
  );
}
