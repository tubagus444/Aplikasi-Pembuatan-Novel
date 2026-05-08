import React from 'react';
import { motion } from 'motion/react';
import { Book, FileText, Database, Sparkles, LayoutList, Share2, Settings as SettingsIcon } from 'lucide-react';

export function GuidePanel() {
  const features = [
    {
      icon: <FileText className="text-indigo-500" />,
      title: "Editor",
      description: "Menulis bab dengan Tiptap editor. Fitur ini memiliki mode Typewriter, Mode Fokus, sinkronisasi otomatis, serta mention (@) ke entri Codex. Gunakan tombol Sparkler untuk bantuan AI seperti menyempurnakan tulisan (Show don't tell) pada teks yang dihighlight."
    },
    {
      icon: <LayoutList className="text-fuchsia-500" />,
      title: "Planning Board / Outline",
      description: "Papan perencanaan cerita Anda. Susun garis besar untuk setiap bab menggunakan drag-and-drop. Tulis ringkasan dan tetapkan status draft (Draft, Revisi, Selesai)."
    },
    {
      icon: <Database className="text-emerald-500" />,
      title: "Codex",
      description: "Pusat informasi dunia/worldbuilding Anda. Buat entri daftar karakter, lokasi, item, atau faksi. Entri yang ada di Codex bisa dimention dalam Editor cukup dengan mengetik '@'."
    },
    {
      icon: <Book className="text-amber-500" />,
      title: "Story Bible",
      description: "Buku acuan aturan dasar cerita, misalnya sistem sihir atau penokohan utama. AI akan memperhatikan aturan ini saat membantu memberikan saran konflik atau ide cerita."
    },
    {
      icon: <Share2 className="text-pink-500" />,
      title: "Relations",
      description: "Grafik relasi dinamis untuk memvisualisasikan hubungan antar entri di Codex Anda, misalnya hubungan pertemanan, permusuhan, dll."
    },
    {
      icon: <Sparkles className="text-blue-500" />,
      title: "AI Snippets",
      description: "Buat custom prompt atau 'mantra' AI yang bisa Anda terapkan pada Editor, seperti mengubah nada obrolan menjadi lebih dramatis."
    },
  ];

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-10">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-3">
          <Book size={24} className="text-indigo-600" />
          Panduan Fitur
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Selamat datang di AetherScribe. Berikut adalah penjelasan untuk setiap fitur yang tersedia di aplikasi ini.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((item, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center rounded-xl mb-4">
              {item.icon}
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">{item.title}</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{item.description}</p>
          </motion.div>
        ))}
      </div>
      
      <div className="mt-12 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 p-6 rounded-2xl">
         <h3 className="font-bold text-indigo-900 dark:text-indigo-200 mb-2 flex items-center gap-2">
           <SettingsIcon size={18} /> Pengaturan API Key
         </h3>
         <p className="text-indigo-700/80 dark:text-indigo-300/80 text-sm">
           Agar fitur AI (Sparkles) dan AI Assistant dapat berjalan, pastikan Anda telah memasukkan API Key di halaman Pengaturan. Aplikasi ini mendukung beberapa provider AI seperti Gemini, OpenAI, Claude, dan Groq.
         </p>
      </div>
    </div>
  );
}
