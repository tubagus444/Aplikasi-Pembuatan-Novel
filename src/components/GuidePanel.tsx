import React from 'react';
import { motion } from 'motion/react';
import { Book, FileText, Database, Sparkles, LayoutList, Share2, Settings as SettingsIcon, MessageSquareHeart, BarChart3 } from 'lucide-react';

export function GuidePanel() {
  const features = [
    {
      icon: <FileText className="text-indigo-500" />,
      title: "1. Editor Utama & Fitur Mention (@)",
      description: "Kanvas utama tempat Anda menulis naskah. Dilengkapi dengan asisten AI terintegrasi dan sistem mention interaktif.",
      howItWorks: "Teks yang Anda ketik disimpan secara otomatis per bab. Mengetik '@' akan memicu pencarian ke database Codex.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong>Menulis Biasa:</strong> Ketik cerita Anda seperti biasa di area editor. Di pojok ada toggle untuk Mode Fokus (menyembunyikan menu lain) dan Mode Mesin Tik.</li>
          <li><strong>Fitur Mention (@):</strong> Ketik simbol <strong>@</strong> langsung di dalam teks, diikuti nama Karakter atau Lokasi yang sudah Anda buat di Codex (Contoh: <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded text-cyan-600 dark:text-cyan-400">@Budi</code>). Pop-up akan muncul, klik namanya. Teks akan berubah menjadi link informasi. Jika Anda klik link tersebut, akan muncul detail karakternya tanpa harus pindah halaman.</li>
          <li><strong>Edit via AI (Sparkles):</strong> Blok teks/paragraf tertentu dengan mouse, lalu klik ikon ✨ yang melayang di atasnya untuk meminta AI mengubah gaya bahasa (contoh: ubah jadi "Show, Don't Tell" atau buat dialog jadi lebih emosional).</li>
        </ul>
      )
    },
    {
      icon: <Database className="text-emerald-500" />,
      title: "2. Codex (Worldbuilding)",
      description: "Database ensiklopedia duniamu. Tempat menyimpan informasi Karakter, Lokasi, Item, Faksi, dan Lore.",
      howItWorks: "Data di sini bersifat global dan menjadi sumber 'jawaban' bagi Editor saat Anda mengetik @, serta memberikan konteks pada AI Assistant.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Masuk ke menu Codex, klik <strong>"Tambah Entri"</strong>.</li>
          <li>Pilih kategori (misalnya Karakter), isi Nama, dan deskripsinya sedetail mungkin (penampilan, sifat, latar belakang). Konfirmasi simpan.</li>
          <li>Setelah tersimpan di Codex, entri ini siap dipanggil di Editor menggunakan simbol <strong>@</strong>.</li>
        </ul>
      )
    },
    {
      icon: <LayoutList className="text-fuchsia-500" />,
      title: "3. Planning Board / Outline",
      description: "Papan perencanaan cerita visual bergaya Kanban.",
      howItWorks: "Membagi alur cerita besar menjadi kartu-kartu ringkasan per-bab, memudahkan menyusun pacing.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Tambahkan kartu bab baru, berikan judul dan tulis poin-poin penting (outline) apa saja yang akan terjadi di bab tersebut.</li>
          <li>Ubah Status (Draft, Revisi, Selesai) untuk melacak progress penulisan Anda. Anda bisa menggeser urutannya jika ada perubahan plot.</li>
        </ul>
      )
    },
    {
      icon: <MessageSquareHeart className="text-red-500" />,
      title: "4. AI Assistant",
      description: "Co-pilot penulisan yang pintar dan paham konteks cerita Anda.",
      howItWorks: "Chatbot yang akan membaca Bab Anda yang aktif, data karakter di Codex terkait, dan aturan dari Story Bible sebelum menjawab pertanyaan.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Buka panel AI Assistant di sebelah kanan.</li>
          <li>Karena dia paham konteks, Anda bisa bertanya langsung: <em>"Berdasarkan cerita bab ini, kira-kira plot twist apa yang pas agar @KarakterA terlihat mengkhianati tokoh utama?"</em></li>
          <li>Gunakan ide dari Assistant tersebut, atau perintahkan AI untuk mengkritik alur tulisan Anda.</li>
        </ul>
      )
    },
    {
      icon: <Book className="text-amber-500" />,
      title: "5. Story Bible",
      description: "Dokumen pondasi atau aturan absolut untuk dunia dan cerita Anda.",
      howItWorks: "Jika Codex menyimpan entri satuan (Karakter, Item), Story Bible menyimpan 'Hukum Alam' cerita. Dokumen ini memaksa AI mematuhi aturan cerita Anda.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Tulis pedoman utama cerita Anda. Contoh: <em>"Genre cerita ini dark-fantasy petualangan, di mana sihir terlarang. Nada penceritaan suram / grimdark."</em></li>
          <li>Dengan adanya pedoman ini, AI Assistant tidak akan memberikan saran ide cerita yang konyol atau keluar jalur dari tone yang sudah Anda asaskan.</li>
        </ul>
      )
    },
    {
      icon: <Share2 className="text-pink-500" />,
      title: "6. Relasi (Relationships)",
      description: "Grafik jaring laba-laba untuk melihat koneksi setiap tokoh.",
      howItWorks: "Secara visual memetakan hubungan dua entri di Codex ke dalam kanvas yang bisa digeser.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Buka entri Codex atau panel Relasi, lalu tambahkan hubungan. Contoh: <em>"Jon Snow" -&gt; "Musuh" -&gt; "Night King"</em>.</li>
          <li>Tabel dan grafik ini membantu Anda mengingat siapa benci siapa, siapa sekutu siapa dalam cerita berskala besar.</li>
        </ul>
      )
    },
    {
      icon: <BarChart3 className="text-blue-500" />,
      title: "7. Prose Insights",
      description: "Penganalisis statistik teks (kualitas narasi).",
      howItWorks: "Memindai teks pada bab yang sedang aktif untuk mencari adverbia (-ly), pemborosan kata, atau kalimat pasif dalam tata bahasa.",
      howToUse: (
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Buka panel Insights, klik <strong>Analyze</strong>.</li>
          <li>Aplikasi akan menyoroti kata-kata lemah yang mungkin ingin Anda ganti atau buang agar tulisan Anda terasa lebih 'padat' dan profesional.</li>
        </ul>
      )
    }
  ];

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-10">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-3">
          <Book size={24} className="text-indigo-600" />
          Panduan Lengkap Fitur AetherScribe
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">
          Pelajari bagaimana setiap fitur bekerja dan cara memaksimalkannya untuk mempercepat proses penulisan Anda.
        </p>
      </div>

      <div className="space-y-8">
        {features.map((item, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm"
          >
            <div className="flex gap-4 items-start mb-4">
              <div className="w-12 h-12 shrink-0 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center rounded-xl">
                {item.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-2">{item.title}</h3>
            </div>
            
            <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed mb-6 font-medium">
              {item.description}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 border border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Cara Kerja</h4>
                <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{item.howItWorks}</p>
              </div>
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Cara Menggunakan</h4>
                <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                  {item.howToUse}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      <div className="mt-12 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 p-6 rounded-2xl">
         <h3 className="font-bold text-indigo-900 dark:text-indigo-200 mb-2 flex items-center gap-2">
           <SettingsIcon size={18} /> Persyaratan API Key AI
         </h3>
         <p className="text-indigo-700/80 dark:text-indigo-300/80 text-sm leading-relaxed">
           Seluruh fitur yang menggunakan <strong>AI</strong> (AI Assistant, Sparkles Edit, dan Story Brainstorming) <strong>memerlukan API Key</strong> agar dapat berfungsi. <br/>
           Silakan klik icon Gear (Pengaturan) di bagian menu atas, pilih Provider AI pilihan Anda (misalnya Gemini, OpenAI, Claude, atau Groq), lalu tempelkan kunci rahasia API Anda di kolom yang tersedia. Data API Key disimpan secara lokal di perangkat Anda.
         </p>
      </div>
    </div>
  );
}

