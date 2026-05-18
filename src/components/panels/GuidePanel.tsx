import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Book, FileText, Database, LayoutList, Share2, 
  Settings as SettingsIcon, MessageSquareHeart, BarChart3, 
  Zap, Cpu, Target, PenTool, Key, Sparkles, Coins, Lightbulb,
  BrainCircuit, GripVertical, ChevronRight, Info, BookOpen, 
  MousePointer2, Command, ShieldCheck, ArrowRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigation } from '../../contexts/NavigationContext';
import { ViewMode } from '../../types';

export function GuidePanel() {
  const [activeSection, setActiveSection] = useState('getting-started');
  const { setViewMode } = useNavigation();
  const containerRef = useRef<HTMLDivElement>(null);

  const sections = [
    { id: 'getting-started', title: 'Mulai Menulis', icon: <Zap size={18} /> },
    { id: 'features', title: 'Katalog Fitur', icon: <LayoutList size={18} /> },
    { id: 'tips', title: 'Tips & Efisiensi', icon: <Lightbulb size={18} /> },
    { id: 'shortcuts', title: 'Shortcut & Sistem', icon: <Command size={18} /> },
  ];

  const features = [
    {
      id: 'feature-editor',
      targetView: 'write' as ViewMode,
      icon: <FileText className="w-6 h-6 text-indigo-500" />,
      bg: "bg-indigo-50 dark:bg-indigo-500/10",
      title: "1. Editor Utama & Mentions (@)",
      description: "Kanvas utama untuk menulis. Fokus pada teks dengan bantuan asisten cerdas.",
      howItWorks: "Asisten memantau teks Anda secara real-time. Jika Anda menyebutkan entri Codex, asisten akan menarik memori tentang entri tersebut.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 font-medium">
          <li><strong>Menulis Bebas:</strong> Gunakan Mode Fokus di kanan atas editor saat butuh ruang tenang tanpa distraksi.</li>
          <li><strong>Mentions (@):</strong> Ketik <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 font-mono text-xs border border-slate-200 dark:border-slate-700">@NamaKarakter</code>. AI akan langsung mengenali siapa yang Anda bicarakan.</li>
          <li><strong>Magic Edit (✨):</strong> Blok teks yang ingin diubah, klik ikon Sparkles, dan beri instruksi spesifik.</li>
        </ul>
      )
    },
    {
      id: 'feature-brainstorm',
      targetView: 'brainstorm' as ViewMode,
      icon: <BrainCircuit className="w-6 h-6 text-purple-500" />,
      bg: "bg-purple-50 dark:bg-purple-500/10",
      title: "2. AI Brainstorm Studio",
      description: "Ruang diskusi khusus untuk menyusun plot, lore, dan ide-ide liar.",
      howItWorks: "Chat terpisah yang memiliki akses penuh ke Story Bible dan Codex Anda. Sempurna untuk sesi 'ngobrol' panjang dengan asisten.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 font-medium">
          <li><strong>Lampirkan Lore:</strong> Gunakan ikon (+) di area chat untuk melampirkan profil Karakter ke dalam percakapan.</li>
          <li><strong>Eksplorasi Ide:</strong> Tanya seperti rekan kerja: <em>"Bagaimana @Tokoh Utama bereaksi terhadap tragedi ini?"</em></li>
        </ul>
      )
    },
    {
      id: 'feature-codex',
      targetView: 'codex' as ViewMode,
      icon: <Database className="w-6 h-6 text-emerald-500" />,
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
      title: "3. Codex (Ensiklopedia Dunia)",
      description: "Database pusat untuk Karakter, Lokasi, Item, dan Lore.",
      howItWorks: "Kumpulan pengetahuan global yang menjadi 'Long-term Memory' bagi asisten AI Anda.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 font-medium">
          <li>Isi deskripsi entri sespesifik mungkin. Gunakan poin-poin untuk ciri fisik dan motivasi.</li>
          <li>Kategorikan entri (Karakter, Lokasi, dll) agar mudah dicari saat menulis.</li>
          <li>Data Codex dipanggil otomatis oleh AI saat anda menggunakan fitur Mentions (@).</li>
        </ul>
      )
    },
    {
      id: 'feature-relationships',
      targetView: 'relationships' as ViewMode,
      icon: <Share2 className="w-6 h-6 text-rose-500" />,
      bg: "bg-rose-50 dark:bg-rose-500/10",
      title: "4. Relationship Mapper",
      description: "Peta visual untuk melihat keterkaitan antar karakter dan faksi.",
      howItWorks: "Asisten menggunakan data hubungan ini untuk memastikan dialog dan perilaku AI sesuai konteks antar-karakter.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 font-medium">
          <li>Tambahkan link antar entri Codex (misalnya: Musuh, Sahabat, Guru).</li>
          <li>Catatan ini sangat berguna dalam menjaga konsistensi intrik atau drama antar tokoh.</li>
        </ul>
      )
    },
    {
      id: 'feature-timeline',
      targetView: 'write' as ViewMode,
      icon: <GripVertical className="w-6 h-6 text-orange-500" />,
      bg: "bg-orange-50 dark:bg-orange-500/10",
      title: "5. Timeline & Story Beats",
      description: "Pelacak alur peristiwa dalam setiap bab secara kronologis.",
      howItWorks: "Sistem kartu yang mengikuti garis waktu linear untuk memastikan urutan adegan tetap konsisten.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 font-medium">
          <li>Tambahkan 'Beat' untuk setiap kejadian penting (misal: Pertemuan, Aksi, Kejutan).</li>
          <li>Gunakan sebagai panduan cepat saat menulis (Outline mini di panel samping).</li>
        </ul>
      )
    },
    {
      id: 'feature-planning',
      targetView: 'outline' as ViewMode,
      icon: <LayoutList className="w-6 h-6 text-fuchsia-500" />,
      bg: "bg-fuchsia-50 dark:bg-fuchsia-500/10",
      title: "6. Planning Board",
      description: "Pusat kendali struktur bab dan manajemen proyek.",
      howItWorks: "Papan visual yang mengelola status setiap bab (Draft, Review, Final).",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 font-medium">
          <li>Geser kartu bab (Drag & Drop) untuk merubah status pengerjaan.</li>
          <li>Buat draf outline di setiap kartu bab sebelum mulai menulis teks aslinya.</li>
        </ul>
      )
    },
    {
      id: 'feature-bible',
      targetView: 'bible' as ViewMode,
      icon: <Target className="w-6 h-6 text-sky-500" />,
      bg: "bg-sky-50 dark:bg-sky-500/10",
      title: "7. Story Bible",
      description: "Pilar utama gaya bahasa, tema, dan aturan dunia cerita.",
      howItWorks: "Data di sini akan 'memaksa' AI mengikuti instruksi global Anda di setiap fitur.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 font-medium">
          <li>Tentukan 'Voice & Tone'. Contoh: <em>"Gunakan bahasa puitis namun kelam."</em></li>
          <li>Atur aturan dunia secara eksplisit agar AI tetap konsisten pada logika cerita.</li>
        </ul>
      )
    },
    {
      id: 'feature-insights',
      targetView: 'write' as ViewMode,
      icon: <BarChart3 className="w-6 h-6 text-cyan-500" />,
      bg: "bg-cyan-50 dark:bg-cyan-500/10",
      title: "8. Prose Insights",
      description: "Analisis statistik dan gaya tulisan secara otomatis.",
      howItWorks: "Mengevaluasi skor keterbacaan, mendeteksi jumlah kalimat pasif dan adverbia pada bab yang aktif.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 font-medium">
          <li>Buka di panel sebelah kanan pada mode Editor Utama.</li>
          <li>Perbaiki kalimat yang terlalu panjang (Long Sentences) untuk memutar ritme tulisan.</li>
        </ul>
      )
    },
    {
      id: 'feature-actions',
      targetView: 'actions' as ViewMode,
      icon: <Sparkles className="w-6 h-6 text-yellow-500" />,
      bg: "bg-yellow-50 dark:bg-yellow-500/10",
      title: "9. Custom AI Snippets",
      description: "Prompt khusus dan kustom yang siap dipanggil kapan saja.",
      howItWorks: "Memungkinkan Anda membuat fungsi AI milik Anda sendiri (misal: 'Beri Kritik Tajam').",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 font-medium">
          <li>Buat Snippet baru di tab 'AI Snippets'.</li>
          <li>Panggil saat memindai paragraf untuk hasil yang jauh lebih konsisten!</li>
        </ul>
      )
    },
    {
      id: 'feature-snapshots',
      targetView: 'write' as ViewMode,
      icon: <SettingsIcon className="w-6 h-6 text-teal-500" />,
      bg: "bg-teal-50 dark:bg-teal-500/10",
      title: "10. Snapshots (Mesin Waktu)",
      description: "Sistem Auto-Backup dan riwayat versi teks Anda.",
      howItWorks: "Menyimpan secara presisi draf pada waktu tertentu. Jika AI merusak dokumen, kembalikan saja lewat Snapshot.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 font-medium">
          <li>Sistem melakukan back-up berkala.</li>
          <li>Anda juga dapat membuat snapshot manual dengan memberi label (Misal: 'Sebelum Edit Besar').</li>
        </ul>
      )
    }
  ];

  const aiEfficiencyTips = [
    {
      icon: <Cpu className="w-5 h-5 text-sky-500" />,
      title: "Blok Seperlunya Saja",
      description: "Fitur Sparkles mengolah area yang Anda blok. Hemat token dengan hanya menyorot paragraf yang butuh diperbaiki saja."
    },
    {
      icon: <Coins className="w-5 h-5 text-amber-500" />,
      title: "Batasi Ukuran Output",
      description: "Tambahkan instruksi eksplisit seperti \"maksimal 3 poin\" atau \"dalam 50 kata\" untuk mencegah AI berbicara terlalu panjang."
    },
    {
      icon: <Zap className="w-5 h-5 text-violet-500" />,
      title: "Manfaatkan @Mention",
      description: "AI membaca Codex hanya jika karakter itu di-mention (@). Ini cara terbaik menjaga konteks tanpa membebani memori AI."
    }
  ];

  const workflowSteps = [
    {
      title: "Konfigurasi Bible & Codex",
      description: "Tentukan aturan dunia dan buat profil tokoh utama sebagai pondasi kecerdasan asisten.",
      status: "Fondasi"
    },
    {
      title: "Strukturkan Planning Board",
      description: "Pecah cerita Anda menjadi bab-bab kecil agar progres lebih terukur dan tidak terasa berat.",
      status: "Perencanaan"
    },
    {
      title: "Tulis Draf di Focused Editor",
      description: "Tutup panel samping, gunakan Mentions (@) untuk memanggil data lore tanpa keluar dari editor.",
      status: "Eksekusi"
    },
    {
      title: "Poles dengan Asisten AI",
      description: "Gunakan Brainstorm Studio untuk membedah plot hole atau Sparkles untuk memperindah gaya bahasa.",
      status: "Iterasi"
    }
  ];

  const quickShortcuts = [
    { key: "@", action: "Panggil Menu Mention" },
    { key: "Ctrl + K", action: "Global Search & Command" },
    { key: "Esc", action: "Keluar Mode/Tutup Panel" },
    { key: "Sparkles", action: "AI Writing Assistant" },
  ];

  // Scroll spy effect for navigation
  useEffect(() => {
    const scrollContainer = containerRef.current?.parentElement;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const scrollPosition = scrollContainer.scrollTop + 150;
      
      const scrollSections = sections.map(s => {
        const element = document.getElementById(s.id);
        if (element) {
          return { id: s.id, offset: element.offsetTop };
        }
        return null;
      }).filter(Boolean);

      for (let i = scrollSections.length - 1; i >= 0; i--) {
        const section = scrollSections[i];
        if (section && scrollPosition >= section.offset) {
          setActiveSection(section.id);
          break;
        }
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [sections]);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    const scrollContainer = containerRef.current?.parentElement;
    if (element && scrollContainer) {
      scrollContainer.scrollTo({
        top: element.offsetTop - 40,
        behavior: 'smooth'
      });
    }
  };

  const handleBackToTop = () => {
    const scrollContainer = containerRef.current?.parentElement;
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto px-4 sm:px-6 pb-24 pt-4 lg:pt-8 min-h-screen">
      
      {/* Sticky Navigation Sidebar - Hidden on mobile */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-24 space-y-1">
          <div className="px-3 mb-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Navigasi Manual</h3>
          </div>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
                activeSection === s.id 
                  ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-500/20" 
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              )}
            >
              <span className={cn(
                "p-1.5 rounded-lg transition-colors",
                activeSection === s.id ? "bg-indigo-500/20" : "bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"
              )}>
                {s.icon}
              </span>
              {s.title}
            </button>
          ))}

          <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
             <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-5 rounded-2xl text-white shadow-lg overflow-hidden relative group">
                <Sparkles className="absolute -right-2 -bottom-2 w-24 h-24 opacity-20 rotate-12 group-hover:scale-110 transition-transform duration-700" />
                <h4 className="font-bold text-sm mb-2 relative z-10">Butuh Bantuan?</h4>
                <p className="text-xs text-indigo-100 leading-relaxed mb-4 relative z-10">Tanyakan langsung pada AI Brainstorm Studio.</p>
                <button 
                  onClick={() => setViewMode('brainstorm')}
                  className="relative z-10 bg-white/20 hover:bg-white/30 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 group/btn"
                >
                  Buka Chat
                  <ArrowRight size={12} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl space-y-24">
        
        {/* Hero Header */}
        <header id="getting-started" className="relative">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-full mb-8 text-xs font-bold tracking-widest uppercase border border-indigo-100 dark:border-indigo-500/20"
          >
            <Sparkles size={14} /> Documentation & Manual
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.1]"
          >
            Kuasai Setiap <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500">Narasi.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="text-slate-500 dark:text-slate-400 text-lg md:text-xl leading-relaxed font-medium mb-12 max-w-2xl"
          >
            AetherScribe bukan sekadar editor teks—ia adalah partner literatur yang memahami database dunia Anda. Pelajari cara memaksimalkannya di sini.
          </motion.p>

          {/* Workflow Implementation Section - Redeisgned as Modern Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative">
             {workflowSteps.map((step, i) => (
               <button 
                 key={i} 
                 onClick={() => {
                   if (i === 0) setViewMode('bible');
                   if (i === 1) setViewMode('outline');
                   if (i === 2) setViewMode('write');
                   if (i === 3) setViewMode('brainstorm');
                 }}
                 className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all hover:-translate-y-1 text-left"
               >
                  <div className="text-4xl font-black text-slate-100 dark:text-slate-800 absolute -top-2 -left-2 opacity-50 group-hover:scale-110 transition-transform">0{i+1}</div>
                  <div className="relative z-10">
                     <span className="inline-block text-[10px] font-bold uppercase tracking-tighter text-indigo-500 mb-2 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full">{step.status}</span>
                     <h3 className="font-bold text-slate-900 dark:text-white mb-2 leading-tight group-hover:text-indigo-500 transition-colors flex items-center justify-between">
                       {step.title}
                       <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-indigo-500" />
                     </h3>
                     <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{step.description}</p>
                  </div>
               </button>
             ))}
             {/* Invisible line connecting steps for visual grouping */}
             <div className="hidden lg:block absolute top-[40%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent -z-10" />
          </div>
        </header>

        {/* Features Catalog Section */}
        <section id="features" className="space-y-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-900 dark:bg-white rounded-2xl flex items-center justify-center text-white dark:text-slate-900 shadow-xl">
              <LayoutList size={24} />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Katalog Fitur Utama</h2>
              <p className="text-slate-500 dark:text-slate-400 shrink-0">Pelajari cara kerja setiap modul aplikasi.</p>
            </div>
          </div>

          <div className="space-y-8">
            {features.map((item, idx) => (
              <motion.div 
                key={idx} id={item.id}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }}
                className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group overflow-hidden"
              >
                <div className="p-8 md:p-10 flex flex-col md:flex-row gap-8">
                  <div className="md:w-1/3 flex flex-col">
                    <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-inner", item.bg)}>
                      {item.icon}
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight mb-4">{item.title}</h3>
                    <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{item.description}</p>
                  </div>

                  <div className="flex-1 space-y-6">
                    <div className="bg-slate-50 dark:bg-slate-800/20 rounded-3xl p-6 md:p-8 border border-slate-100 dark:border-slate-800 relative">
                      <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                        <Info size={14} className="text-indigo-500" /> Bagaimana ia bekerja?
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm font-medium">{item.howItWorks}</p>
                      
                      <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                           <MousePointer2 size={14} className="text-indigo-500" /> Panduan Penggunaan
                        </div>
                        <div className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                          {item.howToUse}
                        </div>
                      </div>

                      <div className="mt-8 pt-6 flex justify-end">
                         <button 
                           onClick={() => setViewMode(item.targetView)}
                           className="flex items-center gap-2 text-xs font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 px-4 py-2.5 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md group/try"
                         >
                            Buka Fitur Ini
                            <ChevronRight size={14} className="group-hover/try:translate-x-1 transition-transform" />
                         </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Tips & Efficiency Section */}
        <section id="tips" className="space-y-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <Zap size={24} />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Efisiensi & Token</h2>
              <p className="text-slate-500 dark:text-slate-400">Maksimalkan penggunaan AI dengan cara yang cerdas.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {aiEfficiencyTips.map((tip, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl relative overflow-hidden group hover:border-amber-500/50 transition-colors shadow-sm"
              >
                <div className="bg-slate-50 dark:bg-slate-800 w-12 h-12 rounded-xl flex items-center justify-center mb-6 shadow-inner text-amber-500 group-hover:scale-110 transition-transform">
                  {tip.icon}
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-3 text-lg leading-tight">{tip.title}</h4>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{tip.description}</p>
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[80px] rounded-full pointer-events-none" />
              </motion.div>
            ))}
          </div>
        </section>

        {/* Shortcuts & Technical Section - Redeisgned as Key Caps */}
        <section id="shortcuts" className="space-y-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <Key size={24} />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Shortcut & Teknis</h2>
              <p className="text-slate-500 dark:text-slate-400">Navigasi secepat kilat menggunakan keyboard.</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
             <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
                <div className="p-8 md:p-12 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800">
                    <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
                       <Command size={20} className="text-indigo-500" /> Akselerasi Alur Kerja
                    </h3>
                    <div className="space-y-4">
                       {quickShortcuts.map((item, i) => (
                         <div key={i} className="flex items-center justify-between group">
                            <span className="text-slate-500 dark:text-slate-400 font-medium group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{item.action}</span>
                            <kbd className="min-w-[2.5rem] text-center bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-700 px-2 py-1 rounded text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shadow-sm transition-all active:translate-y-0.5 active:border-b-0">
                               {item.key}
                            </kbd>
                         </div>
                       ))}
                    </div>
                </div>

                <div className="p-8 md:p-12 bg-slate-50/50 dark:bg-slate-800/10 flex flex-col justify-center">
                   <div className="flex items-center gap-3 mb-6 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm self-start">
                      <ShieldCheck className="text-emerald-500" size={24} />
                      <span className="text-sm font-bold tracking-tight">API & Keamanan</span>
                   </div>
                   <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">
                      AetherScribe menyimpan semua API Key Anda secara lokal di browser. Data cerita Anda diproses secara anonim tergantung pada penyedia model bahasa yang Anda gunakan di menu <strong>Settings</strong>.
                   </p>
                   <div className="space-y-3">
                      <div className="flex items-center gap-3 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                         <ChevronRight size={14} /> <span>Enkripsi Lokal</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                         <ChevronRight size={14} /> <span>Auto-save Snapshots</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                         <ChevronRight size={14} /> <span>Privasi Penulis Terjamin</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </section>

        {/* Footer Support Callout */}
        <footer className="text-center py-12 px-8 bg-gradient-to-b from-transparent to-slate-50 dark:to-slate-900/50 rounded-b-[3rem]">
           <BookOpen className="mx-auto mb-6 text-slate-300 dark:text-slate-700" size={64} />
           <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Mulai Tulis Kisahmu Hari Ini</h3>
           <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto mb-10 leading-relaxed font-medium">
              Semakin sering Anda berinteraksi dengan asisten, semakin ia memahami pola pikir kreatif Anda. Jadikan ini partner literatur sejati Anda.
           </p>
           <button 
             onClick={handleBackToTop}
             className="inline-flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 shadow-xl hover:shadow-indigo-500/20"
           >
              Kembali ke Atas
           </button>
        </footer>

      </main>
    </div>
  );
}
