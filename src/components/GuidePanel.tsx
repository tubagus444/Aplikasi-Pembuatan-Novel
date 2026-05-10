import React from 'react';
import { motion } from 'motion/react';
import { 
  Book, FileText, Database, LayoutList, Share2, 
  Settings as SettingsIcon, MessageSquareHeart, BarChart3, 
  Zap, Cpu, Target, PenTool, Key, Sparkles, Coins, Lightbulb
} from 'lucide-react';

export function GuidePanel() {
  const features = [
    {
      icon: <FileText className="w-6 h-6 text-indigo-500" />,
      bg: "bg-indigo-50 dark:bg-indigo-500/10",
      title: "1. Editor Utama & Mentions (@)",
      description: "Kanvas utama untuk menulis. Fokus pada teks dengan asisten tanpa batas.",
      howItWorks: "Ketik '@' untuk memanggil nama Karakter/Lokasi dari Codex. Data tersimpan otomatis dan AI akan melihat 'Mention' ini sebagai kunci pengingat memori.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li><strong>Menulis Bebas:</strong> Gunakan Mode Fokus di kanan atas editor saat butuh ruang tenang tanpa distraksi visual.</li>
          <li><strong>Mentions (@):</strong> Ketik <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600 dark:text-indigo-400 font-mono text-xs">@NamaKarakter</code>. Hasilnya menjadi tautan; saat diklik, memunculkan popup biodata cepat karakter tersebut.</li>
          <li><strong>Magic Edit (✨):</strong> Blok bagian teks yang terasa kurang pas, klik ikon Sparkles, dan perintahkan AI: <em>"Ubah gaya bahasanya jadi lebih melankolis"</em>.</li>
        </ul>
      )
    },
    {
      icon: <Database className="w-6 h-6 text-emerald-500" />,
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
      title: "2. Codex (Ensiklopedia Dunia)",
      description: "Tempat Anda membangun profil Karakter, Lokasi, Item, Faksi, dan Lore.",
      howItWorks: "Kumpulan data global yang dibaca otomatis oleh AI ketika dipanggil dalam teks atau chat.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li>Tambahkan entri melalui menu Codex. Isi deskripsi (penampilan, motivasi, latar belakang) dengan padat dan jelas.</li>
          <li>Info Codex menjadi 'otak' asisten. Selama karakter terdaftar, AI takkan melupakan siapa dia.</li>
        </ul>
      )
    },
    {
      icon: <LayoutList className="w-6 h-6 text-fuchsia-500" />,
      bg: "bg-fuchsia-50 dark:bg-fuchsia-500/10",
      title: "3. Planning Board (Outline Kanban)",
      description: "Visualisasi tata letak bab dan plot cerita secara menyeluruh.",
      howItWorks: "Bentuk kartu-kartu yang bisa dipindahkan (Drag & Drop) untuk mengatur struktur bab (Draft, Review, Final).",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li>Buat kartu untuk titik pijak plot (misal: "Bab 3 - Pelarian sihir dari menara"). Tulis ringkasannya di dalam.</li>
          <li>Gunakan fitur ini sebagai kompas agar tak kehilangan arah ketika menulis dokumen naskah yang terlampau panjang.</li>
        </ul>
      )
    },
    {
      icon: <MessageSquareHeart className="w-6 h-6 text-pink-500" />,
      bg: "bg-pink-50 dark:bg-pink-500/10",
      title: "4. AI Assistant",
      description: "Rekan diskusi virtual (Co-pilot) yang paham seluk-beluk cerita yang sedang ditulis.",
      howItWorks: "Setiap pertanyaan yang Anda ketik, akan dievaluasi AI berdasarkan narasi bab aktif, profil tokoh Codex, dan aturan dari Story Bible.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li>Tanya soal plot: <em>"Bantu saya menemukan alasan logis mengapa @Elya harus membohongi protagonis di bab ini."</em></li>
          <li>Gunakan sebagai kritikus: <em>"Tolong kritisi pacing dialog di bab ini, apakah terlalu lambat?"</em></li>
        </ul>
      )
    },
    {
      icon: <Book className="w-6 h-6 text-amber-500" />,
      bg: "bg-amber-50 dark:bg-amber-500/10",
      title: "5. Story Bible",
      description: "Kitab suci pondasi tema dan gaya penulisan literatur Anda.",
      howItWorks: "Aturan absolut yang akan memaksa (prompt-inject) AI agar selalu berada di jalur genre dan mood yang Anda tentukan.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li>Isikan instruksi tema secara konkret. Contoh: <em>"Tone: Horor Cosmic. Jangan berikan solusi bahagia. Buat dialog terdengar misterius abad pertengahan."</em></li>
        </ul>
      )
    },
    {
      icon: <Share2 className="w-6 h-6 text-orange-500" />,
      bg: "bg-orange-50 dark:bg-orange-500/10",
      title: "6. Relationship Mapper",
      description: "Jaring visualisasi dinamika hubungan antar kelompok atau ras.",
      howItWorks: "Merender entri Codex yang saling terhubung dalam grafis Node 2D.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li>Catat relasi di dalam profil Karakter (Misal: Arya -&gt; Membenci -&gt; Hound).</li>
          <li>Buka menu Relasi untuk melihat gambaran utuh intrik politik dunia cerita Anda.</li>
        </ul>
      )
    },
    {
      icon: <BarChart3 className="w-6 h-6 text-blue-500" />,
      bg: "bg-blue-50 dark:bg-blue-500/10",
      title: "7. Prose Insights",
      description: "Pengecek gramatikal dan kualitas prosa (tanpa AI).",
      howItWorks: "Algoritme scanning lokal yang cepat mendeteksi kalimat keriting, pasif, atau adverbs (keterangan) berlebihan.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2">
          <li>Pindai bab, lihat highlight kalimat yang terdeteksi, lalu edit jika memang mengurangi keindahan bahasa ("Show, Don't Tell").</li>
        </ul>
      )
    }
  ];

  const aiEfficiencyTips = [
    {
      icon: <Cpu className="w-5 h-5 text-sky-500" />,
      title: "Blok Seperlunya Saja (Sparkles ✨)",
      description: "Fitur Sparkles mengolah area yang Anda blok. Alih-alih memblok seluruh bab berisi ribuan kata untuk memperbaiki sedikit percakapan, sorotlah paragraf yang relevan saja. Respons akan lebih cepat dan sangat hemat Token API."
    },
    {
      icon: <Coins className="w-5 h-5 text-amber-500" />,
      title: "Batasi Ukuran Output",
      description: "AI secara alami suka berbicara panjang lebar. Tambahkan batasan pada prompt di Chat, misal: \"Berikan 3 ide nama senjata mematikan (maksimal 20 kata per poin)\". Mencegah AI boros limit output API."
    },
    {
      icon: <Database className="w-5 h-5 text-emerald-500" />,
      title: "Poin Singkat (Bullet Points)",
      description: "Karena instruksi Story Bible selalu ikut dikirim ke AI setiap saat, berhentilah menuliskan essay paragraf di sana. Gunakan susunan ringkas bernomor/bullet. Konteks terbaca sama, tapi konsumsi token menurun drastis."
    },
    {
      icon: <Zap className="w-5 h-5 text-violet-500" />,
      title: "Mention Adalah Kunci Efisiensi",
      description: "AI membaca Codex *hanya* jika karakter itu di-mention (@) atau ditulis tepat pada editor yang sedang aktif. Tidak perlu khawatir AI membaca ratusan profil karakter lain yang tidak relevan dengan bab tersebut."
    }
  ];

  const generalTips = [
    {
      icon: <Target className="w-5 h-5 text-indigo-500" />,
      title: "Tulis Kasar, Edit Pintar",
      description: "Jangan memoles setiap akhir kalimat dengan AI secara impulsif. Tulis dulu sampai draf 0 bab tersebut tamat (Gunakan Mode Fokus). Saat momen perenungan tiba barulah bedah struktur kalimat menggunakan Prose Insights atau Chat AI."
    },
    {
      icon: <PenTool className="w-5 h-5 text-rose-500" />,
      title: "Bangun Codex Organik",
      description: "Kesalahan umum penulis fantasi adalah memeras otak mengisi puluhan kota dan nama leluhur di Worldbuilding tanpa menulis plot babnya sama sekali. Isi Codex secukupnya hanya pada hal krusial; perbanyak ia sambil jalan."
    }
  ];

  return (
    <div className="max-w-5xl mx-auto pb-24 px-4 sm:px-6">
      
      {/* Header Section */}
      <header className="mb-14 text-center md:text-left mt-4 md:mt-0">
        <motion.div 
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-full mb-6 text-sm font-semibold tracking-widest uppercase"
        >
          <Sparkles size={16} /> Pusat Bantuan
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mb-5"
        >
          Kuasai Alur Kerjamu.
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed max-w-2xl"
        >
          Jelajahi fungsionalitas AetherScribe, dari pengaturan penuangan narasi dasar hingga strategi pro-literatur menggunakan kekuatan kecerdasan buatan.
        </motion.p>
      </header>

      <div className="space-y-16">
        
        {/* Section 1: Tutorial Fitur */}
        <section>
          <div className="flex items-center gap-3 mb-8 border-b border-slate-200 dark:border-slate-800 pb-3">
            <LayoutList className="text-slate-800 dark:text-slate-200" size={24} />
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Ekosistem Fitur Utama</h2>
          </div>

          <div className="space-y-6">
            {features.map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="p-6 md:p-8">
                  <div className="flex items-start gap-4 mb-6">
                    <div className={`p-3 rounded-2xl ${item.bg} shrink-0`}>
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white capitalize leading-tight">{item.title}</h3>
                      <p className="text-slate-500 dark:text-slate-400 mt-1.5 font-medium">{item.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-5 border border-slate-100 dark:border-slate-800/60">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1.5">
                        <Lightbulb size={14} /> Cara Sistem Bekerja
                      </h4>
                      <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{item.howItWorks}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Panduan Aksi</h4>
                      <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                        {item.howToUse}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Section 2: AI Efficiency & Tokens */}
        <section>
          <div className="flex items-center gap-3 mb-8 border-b border-amber-200 dark:border-amber-900/50 pb-3">
            <Zap className="text-amber-500" size={24} />
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Cerdas Hemat Token AI (API Key)</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {aiEfficiencyTips.map((tip, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -15 : 15 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-6 rounded-2xl relative overflow-hidden group hover:border-amber-400 dark:hover:border-amber-500/50 transition-colors shadow-sm"
              >
                <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-110 transition-all duration-500 pointer-events-none">
                  {React.cloneElement(tip.icon, { className: "w-32 h-32 text-slate-900 dark:text-white" })}
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 w-12 h-12 shadow-sm rounded-xl flex items-center justify-center mb-5 relative z-10">
                  {tip.icon}
                </div>
                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2 relative z-10">{tip.title}</h4>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed relative z-10">{tip.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Section 3: Writer's Wisdom/Tips Penulisan */}
        <section>
          <div className="flex items-center gap-3 mb-8 border-b border-slate-200 dark:border-slate-800 pb-3">
            <PenTool className="text-indigo-500" size={24} />
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Pola Pikir Sang Arsitek Teks</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {generalTips.map((tip, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                 <div className="flex items-center gap-3 mb-3">
                    <div className="shrink-0">{tip.icon}</div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200">{tip.title}</h4>
                 </div>
                 <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{tip.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Alert/Reminder Bottom */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/60 p-6 md:p-8 rounded-2xl flex flex-col sm:flex-row gap-6 relative overflow-hidden shadow-sm"
        >
          <div className="shrink-0 p-3 bg-blue-100 dark:bg-blue-800/50 rounded-xl w-14 h-14 flex items-center justify-center">
            <Key className="w-7 h-7 text-blue-700 dark:text-blue-300" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-2">Persyaratan Penggunaan API Key</h3>
            <p className="text-blue-800/80 dark:text-blue-200/70 text-sm leading-relaxed mb-5 max-w-3xl">
              Agar asisten pintar AetherScribe dapat memahami teks, membedah tokoh, dan berbicara kepada Anda, aplikasi membutuhkan akses Model Bahasa Besar (LLM). Pastikan Anda telah menaruh <strong>Secret Token API</strong> milik spesifikasi AI yang Anda inginkan sebelum memulai.
            </p>
            <div className="inline-flex flex-wrap items-center gap-2 text-blue-900 dark:text-blue-300 text-sm font-semibold bg-blue-100/50 dark:bg-blue-900/40 py-2 px-3 rounded-lg border border-blue-200 dark:border-blue-700/50">
              <SettingsIcon size={16} /> Klik Settings (kanan atas) &rarr; Konfigurasi AI Provider &rarr; Paste API Key (Token disimpan lokal).
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
