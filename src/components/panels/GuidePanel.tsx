import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Book, FileText, Database, LayoutList, Share2, 
  Settings as SettingsIcon, MessageSquareHeart, BarChart3, 
  Zap, Cpu, Target, PenTool, Key, Sparkles, Coins, Lightbulb,
  BrainCircuit, GripVertical, ChevronRight, Info, BookOpen, 
  MousePointer2, Command, ShieldCheck, ArrowRight
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { ViewMode } from '@/src/types';

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
      title: "1. Editor Utama & Magic Edit (✨)",
      description: "Kanvas utama untuk menulis dengan fitur editor kaya teks (Rich Text) yang terintegrasi dengan asisten AI secara langsung.",
      howItWorks: "AI berjalan di latar belakang (background) dan mengawasi setiap teks yang Anda tulis. Editor ini dirancang agar bersih, bebas distraksi, dan sangat responsif.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li><strong>Menulis Bebas:</strong> Klik tombol layar penuh di kanan atas untuk masuk ke mode fokus. Semua panel akan disembunyikan.</li>
          <li><strong>Magic Edit (✨):</strong> Blok (highlight) sebagian paragraf yang ingin Anda perbaiki, lalu klik ikon panah panah (✨) kecil mengambang. Ketik perintah seperti "Ubah menjadi lebih dramatis" dan klik tombol untuk biarkan AI menyulap teks Anda secara ajaib!</li>
          <li><strong>Auto-Format:</strong> Tulis dialog dengan biasa, editor mendukung fitur bold, italic, list, hingga heading (H1, H2, H3) melalui menu Selection Floating (yang muncul ketika Anda menyorot tulisan).</li>
          <li><strong>Penggantian Otomatis:</strong> Gunakan kotak "Search & Replace" di pojok kanan bawah editor untuk merombak nama atau kata di satu chapter utuh.</li>
        </ul>
      )
    },
    {
      id: 'feature-mentions',
      targetView: 'write' as ViewMode,
      icon: <Zap className="w-6 h-6 text-amber-500" />,
      bg: "bg-amber-50 dark:bg-amber-500/10",
      title: "2. Sistem Mentions (@) & Konteks",
      description: "Cara tercepat mengarahkan perhatian AI pada karakter atau lore khusus langsung dari layar ketik tanpa membuka menu lain.",
      howItWorks: "Sistem AI Studio ini menggunakan Context Chunking cerdas. AI tidak menelan seluruh teks Anda yang akan sangat boros memori; ia hanya membaca teks jika dipanggil secara spesifik via mention.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Ketik <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-amber-600 dark:text-amber-400 font-mono text-xs border border-slate-200 dark:border-slate-700">@</code> di dalam editor. Menu Autocomplete otomatis akan menampilkan daftar karakter, entri Codex, maupun chapter.</li>
          <li>Apabila Anda meng-klik salah satunya, itu akan ter-highlight dalam kotak kuning di editor.</li>
          <li>AI kemudian otomatis secara 'ajaib' membaca seluruh deskripsi tentang karakter tersebut dari Codex, termasuk kepribadian dan gaya bahasanya saat Anda menyuruh AI mengubah dialog mereka!</li>
        </ul>
      )
    },
    {
      id: 'feature-brainstorm',
      targetView: 'brainstorm' as ViewMode,
      icon: <BrainCircuit className="w-6 h-6 text-purple-500" />,
      bg: "bg-purple-50 dark:bg-purple-500/10",
      title: "3. AI Assistant Studio & Mode Sesi",
      description: "Ruang percakapan dedicated (terpisah) selayaknya WhatsApp untuk sesi diskusi tingkat berat (brainstorming), penyusunan Plot, atau kritik ringan.",
      howItWorks: "Di modul ini, Anda dapat merubah 'Persona' dari AI (contoh: Mode Bedah Perencanaan Plot atau Mode Bedah Prosa) untuk memberikan bobot gaya respon yang berbeda.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li><strong>Ubah Sesi (Persona):</strong> Klik tombol di kanan atas kolom obrolan untuk berpindah antara "Plot Brainstorm", "Prose Critic", atau "Worldbuilder". Model AI akan merubah gaya menjawabnya sesuai kebutuhan Anda!</li>
          <li><strong>Lampirkan Konteks (+):</strong> Klik simbol (+) dari kotak chat untuk mengimpor entri Bible, atau Codex tertentu agar AI terfokus pada topik tersebut.</li>
          <li><strong>Smart Auto-Context:</strong> Hidupkan toggle di pojok header asisten ini. Dengan begitu, AI akan selalu menyelundupkan 'Teks Bab yang sedang kamu edit' jadi setiap jawaban selalu relevan!</li>
          <li>Gunakan mode chat ini ketika butuh "ide baru" saat tersangkut (writer's block), dibanding Magic Edit yang lebih cocok untuk merombak teks yang "sudah ada".</li>
        </ul>
      )
    },
    {
      id: 'feature-codex',
      targetView: 'codex' as ViewMode,
      icon: <Database className="w-6 h-6 text-emerald-500" />,
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
      title: "4. Codex (Ensiklopedia Lore)",
      description: "Sistem database modular (Karakter, Item, Sihir, Lokasi, Event) yang saling mengait. Otak memori jangka panjang untuk proyek buku Anda.",
      howItWorks: "Codex bukan sekadar teks diam. Sistem Passive Highlighting dari AetherScribe akan membaca setiap kata di dokumen utama. Jika ada kata yang sama dengan nama entri di Codex, kata itu akan otomatis di-highlight dengan efek titik-titik pada bawah kata.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li><strong>Klasifikasi Warna:</strong> Setiap kategori diwakili oleh warna ikon yang berbeda (Karakter = biru, Lokasi = Cyan). Gunakan label dengan bijak!</li>
          <li><strong>Sistem Alias:</strong> Pada form entri Codex, tambahkan 'Alias' (Contoh: "Budi", "Bud", "Bos Budi"). AI dan Editor otomatis mendeteksi semua variasi nama ini di naskahmu.</li>
          <li><strong>Hover Cepat:</strong> Di editor utama, arahkan mouse ke kata yang memiliki titik-titik garis bawah. Mini-popup dari entri Codex akan muncul, memudahkan Anda membaca biografi tanpa mesti buka menu!</li>
        </ul>
      )
    },
    {
      id: 'feature-relationships',
      targetView: 'relationships' as ViewMode,
      icon: <Share2 className="w-6 h-6 text-rose-500" />,
      bg: "bg-rose-50 dark:bg-rose-500/10",
      title: "5. Relationship Mapper",
      description: "Sebuah peta visual interaktif (Node Diagram) yang membedah jaringan konflik dan ikatan batin antar berbagai entitas (Codex).",
      howItWorks: "Modul menggunakan algoritma fisika graf d3.js. Lingkaran (Node) mewakili karakter/lokasi, sedangkan garis (Edge) mewakili sentimen/hubungan.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Tarik dan geser (drag) lingkaran bebas sesuka Anda untuk merapikan graf.</li>
          <li>Klik simbol '+' untuk menciptakan ikatan (contohnya: Tautkan karakter 'A' ke karakter 'B', dan set label "Musuh Bebuyutan").</li>
          <li>AI Assistant Studio secara pasif 'membaca' peta ini. Saat membuat percakapan antara A & B, AI akan otomatis tahu kalau mereka bermusuhan tanpa diperintah lagi!</li>
        </ul>
      )
    },
    {
      id: 'feature-planning',
      targetView: 'outline' as ViewMode,
      icon: <LayoutList className="w-6 h-6 text-fuchsia-500" />,
      bg: "bg-fuchsia-50 dark:bg-fuchsia-500/10",
      title: "6. Planning Board & Manajemen Bab",
      description: "Papan tugas gaya Kanban-board lengkap dengan daftar urutan bab. Memudahkan rotasi nasib dan alur waktu naskah.",
      howItWorks: "Tiap karya pasti punya fase 'Blueprint'. Di sini adalah wadah bagi 'Skeleton' dari proyek yang dikelompokan dalam kolom status mulai dari Outline, Draft, hingga Done.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li><strong>Ubah Status:</strong> Tekan dan seret (Drag & Drop) kartu ke kolom sebelah ('Outline' -{'>'} 'Draft') jika bab sudah pindah tahap pengerjaan. Visual ini mempercepat pengukuran rampungnya novel Anda.</li>
          <li><strong>Manajemen Bab Bawah:</strong> Urutkan kembali Bab dengan menarik ikon "Grip" di sisi kiri pada daftar baris bab.</li>
          <li>Bisa buat Ringkasan Singkat (Summary) pada setiap bab agar AI bisa mengetahui isi dari semua bab sekalipun bab tersebut belum selesai ditulis dengan penuh!</li>
        </ul>
      )
    },
    {
      id: 'feature-bible',
      targetView: 'bible' as ViewMode,
      icon: <Target className="w-6 h-6 text-sky-500" />,
      bg: "bg-sky-50 dark:bg-sky-500/10",
      title: "7. Story Bible & Tone Enforcement",
      description: "Pilar absolut bagi seluruh sistem aplikasi. Intruksi konstitusi utama, hukum cerita, bahasa baku, dan tema sentral.",
      howItWorks: "Aturan (Rules) dalam Story Bible adalah Sistem Prompt yang menimpa keseluruhan tabiat dan respon dari asisten. Sangat kritis bagi kualitas ouput yang dihasilkan AI Magic Edit maupun Brainstorming.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Buatlah aturan seperti <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs">Tone</code> dengan nilai <em>"Gelap, gotik, suram, tanpa romansa."</em></li>
          <li>Tambahkan <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs">Format</code> dengan nilai <em>"Gunakan sudut pandang orang pertama (Aku), jangan pakai POV orang ketiga."</em></li>
          <li>Bisa dimatikan dan direkayasa (Toggle Active/Inactive) agar menyesuaikan perombakan alur ketika diperlukan.</li>
        </ul>
      )
    },
    {
      id: 'feature-insights',
      targetView: 'write' as ViewMode,
      icon: <BarChart3 className="w-6 h-6 text-cyan-500" />,
      bg: "bg-cyan-50 dark:bg-cyan-500/10",
      title: "8. Modul Prose Insights & Statistik",
      description: "Sebuah instrumen presisi yang membedah kelemahan kalimat, keterbacaan (readability), statistik jumlah kata bab, hingga melacak target harian (Goals).",
      howItWorks: "Algoritma memproses array of words dari Bab aktif dan akan menampilkan diagram metriks seperti kalimat pasif atau terlalu banyak Adverbia (kata keterangan berlebihan).",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li><strong>Prose Insights:</strong> Buka sidebar kanan pada Editor (tombol 'Chart'), temukan kalimat panjang yang di-highlight warna abu untuk memperbaikinya, pangkas menjadi dua kalimat pendek agar buku punya tempo yang dinamis!</li>
          <li><strong>Writing Stats:</strong> Terletak di header utama, klik angka jumlah kata untuk membuka popup khusus target mingguan!</li>
          <li>Setel gol 'Daily Kata' agar aplikasi melacak produktivitas waktu senggang harian!</li>
        </ul>
      )
    },
    {
      id: 'feature-actions',
      targetView: 'actions' as ViewMode,
      icon: <Sparkles className="w-6 h-6 text-yellow-500" />,
      bg: "bg-yellow-50 dark:bg-yellow-500/10",
      title: "9. Custom AI Snippets (Actions Panel)",
      description: "Tumpukan fungsi prompt yang dirakit khusus yang dapat diakses dengan cepat kapan saja di masa mendatang.",
      howItWorks: "Mirip seperti 'Macro' di Excel, di mana Anda membuat fungsi AI milik Anda sendiri (misal prompt: 'Terjemahkan dialog ke gaya Victoria') sebagai tombol pintasan.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Buat Snippet baru di tab 'AI Snippets / Actions Panel'.</li>
          <li>Panggil snippet ini lewat popup Magic Edit. Tidak perlu mengetik ulang promps panjang setiap kali butuh translasi atau modifikasi berulang.</li>
          <li>Sangat hemat waktu untuk revisi skala masif yang sering terjadi berulang-ulang di berbagai bab.</li>
        </ul>
      )
    },
    {
      id: 'feature-snapshots',
      targetView: 'write' as ViewMode,
      icon: <SettingsIcon className="w-6 h-6 text-teal-500" />,
      bg: "bg-teal-50 dark:bg-teal-500/10",
      title: "10. Snapshots (Mesin Waktu)",
      description: "Sistem Version-Control atau Undo System jangka panjang tingkat dewa. Sangat penting ketika tulisan dirombak lalu Anda menyesal.",
      howItWorks: "Men-database-kan secara presisi 'foto/salinan' draf pada waktu tertentu hanya untuk bab tersebut.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Sistem melakukan back-up secara otomatis (namun versi ini ditimpa berkala).</li>
          <li><strong>Simpan Manual:</strong> Pada Sidebar Editor fitur, buka Snapshots Panel, klik 'Take Manual Snapshot', dan beri label (Misal: 'Sebelum Edit Besar oleh Si Botot AI'). Snapshots berlabel ini aman tak akan hilang tertimpa, kapan pun Anda dapat merestorenya kembali sempurna!</li>
        </ul>
      )
    },
    {
      id: 'feature-project-export',
      targetView: 'settings' as ViewMode,
      icon: <Book className="w-6 h-6 text-orange-500" />,
      bg: "bg-orange-50 dark:bg-orange-500/10",
      title: "11. Manajemen Proyek & Ekspor Multi-Format",
      description: "Menghadirkan Workspace multi-proyek dan engine Ekspor utuh untuk membekukan karya jadi material mentah final.",
      howItWorks: "Bisa buat berapapun jumlah proyek novel di satu aplikasi ini. Sistem ekspor merajut seluruh bab yang ditandai 'Aktif' menjadi 1 berkas berurutan.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li><strong>Pindah Proyek:</strong> Klik Nama Proyek Anda di pojok paling kiri Header (Sebelah ikon Sidebar). Ini akan membuka Project Modal (Pilih, Tambah, Hapus).</li>
          <li><strong>Ekspor (Export):</strong> Klik Menu Settings (⚙️) panel, lalu klik tombol Hijau di atas berlabel "Export Project". Centang bab apa saja yang ingin Anda cetak, dan pilih output formatnya: (Markdown bersih padat, Dokumen Microsoft Word (docx), atau Epub standar e-book)!</li>
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
      description: "Gunakan Assistant Studio untuk membedah plot hole atau Sparkles untuk memperindah gaya bahasa.",
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
                <p className="text-xs text-indigo-100 leading-relaxed mb-4 relative z-10">Tanyakan langsung pada AI Assistant Studio.</p>
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
