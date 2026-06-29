import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Book, FileText, Database, LayoutList, Share2,
  Zap, Cpu, Target, PenTool, Key, Sparkles, Coins, Lightbulb,
  BrainCircuit, ChevronRight, ChevronDown, Info, BookOpen,
  MousePointer2, Command, ShieldCheck, ArrowRight,
  ReplaceAll, History, CalendarClock, UserSearch, MessagesSquare,
  Gauge, Cloud, FileDown, Wand2, AtSign, Layers,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useNavigation } from '@/src/contexts/NavigationContext';
import { useUI } from '@/src/contexts/UIContext';
import { ViewMode } from '@/src/types';

type FeatureGroupId = 'group-write' | 'group-world' | 'group-ai' | 'group-output';

interface FeatureItem {
  id: string;
  group: FeatureGroupId;
  icon: React.ReactNode;
  bg: string;
  badge: string; // lokasi/menu tempat fitur diakses
  title: string;
  description: string;
  howItWorks: string;
  howToUse: React.ReactNode;
  action: () => void;
  actionLabel: string;
}

export function GuidePanel() {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const { setViewMode } = useNavigation();
  const { setIsReplaceOpen, setIsExportOpen } = useUI();
  const containerRef = useRef<HTMLDivElement>(null);

  const go = (view: ViewMode) => () => setViewMode(view);

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sections = [
    { id: 'getting-started', title: 'Mulai di Sini', icon: <Zap size={16} />, sub: false },
    { id: 'group-write', title: 'Menulis & Editor', icon: <PenTool size={16} />, sub: true },
    { id: 'group-world', title: 'Dunia & Konsistensi', icon: <Database size={16} />, sub: true },
    { id: 'group-ai', title: 'AI & Asisten', icon: <BrainCircuit size={16} />, sub: true },
    { id: 'group-output', title: 'Progres & Ekspor', icon: <FileDown size={16} />, sub: true },
    { id: 'tips', title: 'Tips & Token', icon: <Lightbulb size={16} /> , sub: false },
    { id: 'shortcuts', title: 'Shortcut', icon: <Command size={16} />, sub: false },
  ];

  const groups: { id: FeatureGroupId; title: string; subtitle: string; icon: React.ReactNode; color: string }[] = [
    { id: 'group-write', title: 'Menulis & Editor', subtitle: 'Kanvas utama dan semua alat penyuntingan.', icon: <PenTool size={22} />, color: 'bg-indigo-600' },
    { id: 'group-world', title: 'Dunia, Lore & Konsistensi', subtitle: 'Bangun kanon cerita dan jaga agar tetap konsisten.', icon: <Database size={22} />, color: 'bg-emerald-600' },
    { id: 'group-ai', title: 'AI & Asisten', subtitle: 'Partner kreatif, otomasi, dan pengaturan kecerdasan.', icon: <BrainCircuit size={22} />, color: 'bg-purple-600' },
    { id: 'group-output', title: 'Progres, Data & Ekspor', subtitle: 'Kelola proyek, lacak target, cadangkan, dan terbitkan.', icon: <FileDown size={22} />, color: 'bg-orange-600' },
  ];

  const features: FeatureItem[] = [
    // ── MENULIS & EDITOR ─────────────────────────────────────────────────────
    {
      id: 'feature-editor',
      group: 'group-write',
      icon: <FileText className="w-6 h-6 text-indigo-500" />,
      bg: 'bg-indigo-50 dark:bg-indigo-500/10',
      badge: 'Menu: Editor',
      title: 'Editor & Magic Edit (✨)',
      description: 'Kanvas menulis kaya teks yang bersih dan bebas distraksi, terhubung langsung dengan AI di dalam teks.',
      howItWorks: 'Saat Anda menyorot teks, sebuah menu mengambang muncul. Dari sana Anda bisa memformat (tebal/miring/heading) atau meminta AI menyunting bagian itu — hasilnya bisa Anda Terima, Sisipkan di bawah, atau Buang.',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li><strong>Magic Edit:</strong> sorot satu paragraf, klik ikon ✨ pada menu mengambang, ketik perintah seperti <em>"buat lebih dramatis"</em>, lalu jalankan. Bandingkan hasilnya sebelum menerima.</li>
          <li><strong>Mode Fokus:</strong> sembunyikan semua panel untuk menulis tenang (tombol layar penuh di kanan atas, atau <kbd className="font-mono text-xs">Ctrl+Alt+F</kbd>).</li>
          <li><strong>Mode Mesin Tik & Zoom:</strong> di bilah bawah editor, aktifkan Typewriter (baris aktif tetap di tengah) dan atur perbesaran teks.</li>
          <li><strong>Ganti dalam bab:</strong> <kbd className="font-mono text-xs">Ctrl+H</kbd> membuka cari &amp; ganti untuk bab yang sedang dibuka (dengan opsi case-sensitive, regex, dan pencarian semantik AI).</li>
        </ul>
      ),
      action: go('write'),
      actionLabel: 'Buka Editor',
    },
    {
      id: 'feature-mentions',
      group: 'group-write',
      icon: <AtSign className="w-6 h-6 text-amber-500" />,
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      badge: 'Di dalam Editor',
      title: 'Mentions (@) & Sorotan Codex',
      description: 'Cara tercepat mengarahkan perhatian AI ke karakter atau lore tertentu tanpa keluar dari layar ketik.',
      howItWorks: 'AetherScribe mencocokkan nama/alias Codex di naskah Anda secara otomatis (sorotan garis-titik). Mengetik @ memanggil entitas itu secara eksplisit sehingga AI membaca seluruh profilnya.',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Ketik <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-amber-600 dark:text-amber-400 font-mono text-xs border border-slate-200 dark:border-slate-700">@</code> di editor → pilih karakter, entri Codex, atau bab dari daftar.</li>
          <li>Kata yang cocok dengan Codex otomatis bergaris-titik. <strong>Arahkan mouse</strong> ke kata itu untuk membaca biografinya tanpa membuka menu.</li>
          <li>Saat Anda menyuruh AI mengubah dialog tokoh yang di-mention, AI sudah tahu kepribadian dan gaya bahasanya.</li>
        </ul>
      ),
      action: go('write'),
      actionLabel: 'Buka Editor',
    },
    {
      id: 'feature-replace',
      group: 'group-write',
      icon: <ReplaceAll className="w-6 h-6 text-indigo-500" />,
      bg: 'bg-indigo-50 dark:bg-indigo-500/10',
      badge: 'Ikon ⇄ di bilah atas (Header)',
      title: 'Cari & Ganti Seluruh Naskah',
      description: 'Ganti sebuah kata atau nama di SEMUA bab sekaligus — bukan hanya bab yang sedang dibuka.',
      howItWorks: 'Modal ini memindai seluruh bab dan menampilkan jumlah kecocokan per bab beserta cuplikan konteksnya. Penggantian dilakukan aman: bab yang sedang Anda edit disimpan dulu, lalu dimuat ulang setelah diganti agar tidak ada perubahan yang hilang.',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Klik ikon <ReplaceAll size={12} className="inline" /> di bilah atas → ketik kata yang dicari dan kata penggantinya.</li>
          <li>Aktifkan <strong>Aa</strong> (case-sensitive) atau <strong>.*</strong> (regex) bila perlu. Mode regex mendukung backref seperti <code className="font-mono text-xs">$1</code>.</li>
          <li>Gunakan <strong>"Ganti Semua"</strong> untuk semua bab, atau tombol <strong>"Ganti"</strong> per bab untuk kendali lebih halus. Klik judul bab untuk melompat ke sana.</li>
        </ul>
      ),
      action: () => setIsReplaceOpen(true),
      actionLabel: 'Buka Ganti Global',
    },
    {
      id: 'feature-snapshots',
      group: 'group-write',
      icon: <History className="w-6 h-6 text-teal-500" />,
      bg: 'bg-teal-50 dark:bg-teal-500/10',
      badge: 'Panel kanan Editor',
      title: 'Snapshots (Mesin Waktu)',
      description: 'Riwayat versi per bab. Penyelamat saat sebuah revisi besar ternyata salah arah dan Anda ingin kembali.',
      howItWorks: 'Aplikasi menyimpan salinan draf otomatis (ditimpa berkala), sementara snapshot manual berlabel disimpan permanen sampai Anda hapus.',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Buka <strong>Snapshots</strong> dari panel kanan editor.</li>
          <li>Sebelum perombakan besar, klik <strong>"Ambil Snapshot Manual"</strong> dan beri label (mis. <em>"Sebelum ubah ending"</em>).</li>
          <li>Kapan pun, pilih sebuah snapshot dan <strong>Restore</strong> untuk mengembalikan isi bab persis seperti saat itu.</li>
        </ul>
      ),
      action: go('write'),
      actionLabel: 'Buka Editor',
    },

    // ── DUNIA, LORE & KONSISTENSI ────────────────────────────────────────────
    {
      id: 'feature-codex',
      group: 'group-world',
      icon: <Database className="w-6 h-6 text-emerald-500" />,
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      badge: 'Menu: Kamus Data',
      title: 'Kamus Data / Codex',
      description: 'Ensiklopedia dunia Anda: karakter, lokasi, item, sihir, peristiwa — memori jangka panjang proyek.',
      howItWorks: 'Codex bukan teks diam. Setiap entri otomatis dikenali di naskah (sorotan garis-titik) dan menjadi bahan konteks untuk AI. Anda bisa membuat kategori sendiri di luar 6 kategori bawaan.',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li><strong>Alias:</strong> tambahkan variasi nama (mis. "Budi", "Bos Budi") agar semua bentuk terdeteksi di naskah dan oleh AI.</li>
          <li><strong>Kategori kustom:</strong> lewat pengelola kategori, buat label sendiri (mis. "Faksi", "Ras") dengan ikon &amp; warna.</li>
          <li><strong>Lengkapi via AI:</strong> minta AI memperluas deskripsi sebuah entri agar lebih kaya.</li>
        </ul>
      ),
      action: go('codex'),
      actionLabel: 'Buka Kamus Data',
    },
    {
      id: 'feature-orphans',
      group: 'group-world',
      icon: <UserSearch className="w-6 h-6 text-lime-600" />,
      bg: 'bg-lime-50 dark:bg-lime-500/10',
      badge: 'Menu: Saran Entitas',
      title: 'Saran Entitas',
      description: 'Menemukan nama-diri yang sering muncul di naskah tapi belum tercatat di Codex — agar tidak ada tokoh/tempat yang terlewat.',
      howItWorks: 'Aplikasi memindai naskah untuk nama berhuruf kapital yang berulang namun belum punya entri Codex (kebalikan dari pencocokan biasa), lalu menyarankannya.',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Buka <strong>Saran Entitas</strong> untuk melihat kandidat beserta frekuensi kemunculannya.</li>
          <li>Tambahkan kandidat yang relevan ke Codex dengan sekali klik; AI dapat membantu mengisi deskripsi awalnya.</li>
        </ul>
      ),
      action: go('orphans'),
      actionLabel: 'Buka Saran Entitas',
    },
    {
      id: 'feature-relationships',
      group: 'group-world',
      icon: <Share2 className="w-6 h-6 text-rose-500" />,
      bg: 'bg-rose-50 dark:bg-rose-500/10',
      badge: 'Menu: Relasi Karakter',
      title: 'Relasi Karakter (Peta Hubungan)',
      description: 'Peta visual interaktif yang memetakan ikatan dan konflik antar entitas Codex.',
      howItWorks: 'Lingkaran (node) mewakili entitas, garis (edge) mewakili hubungan berlabel. Studio Asisten membaca peta ini secara pasif.',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Tarik node untuk merapikan tata letak.</li>
          <li>Tautkan dua entitas dan beri label hubungan (mis. <em>"Musuh bebuyutan"</em>).</li>
          <li>Saat AI menulis percakapan A &amp; B, ia otomatis tahu sentimen mereka tanpa diingatkan.</li>
        </ul>
      ),
      action: go('relationships'),
      actionLabel: 'Buka Relasi Karakter',
    },
    {
      id: 'feature-bible',
      group: 'group-world',
      icon: <Book className="w-6 h-6 text-sky-500" />,
      bg: 'bg-sky-50 dark:bg-sky-500/10',
      badge: 'Menu: Buku Cerita',
      title: 'Buku Cerita (Story Bible)',
      description: 'Konstitusi cerita: genre, tone, sudut pandang, tempo, tema, dan aturan baku yang mengikat seluruh respons AI.',
      howItWorks: 'Nilai-nilai ini disuntikkan ke instruksi AI di semua jalur (Magic Edit, Studio, Konsistensi) sehingga keluaran AI selalu sesuai pakem cerita Anda.',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Tetapkan <strong>Tone</strong> (mis. <em>"Gelap, gotik, tanpa romansa"</em>) dan <strong>POV</strong> (mis. <em>"Orang pertama 'Aku'"</em>).</li>
          <li>Isi Premis, Tema, dan Catatan Penulis sebagai arahan tambahan.</li>
          <li>Aturan bisa diaktif/nonaktifkan agar fleksibel saat bereksperimen.</li>
        </ul>
      ),
      action: go('bible'),
      actionLabel: 'Buka Buku Cerita',
    },
    {
      id: 'feature-timeline',
      group: 'group-world',
      icon: <CalendarClock className="w-6 h-6 text-violet-500" />,
      bg: 'bg-violet-50 dark:bg-violet-500/10',
      badge: 'Menu: Timeline Cerita',
      title: 'Timeline Cerita',
      description: 'Kronologi peristiwa untuk mencegah plot hole dan urutan kejadian yang bertabrakan.',
      howItWorks: 'Anda mencatat peristiwa beserta waktunya; data ini menjadi acuan saat pemeriksaan konsistensi mendeteksi pertentangan kronologi.',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Tambahkan peristiwa penting beserta urutan/waktunya.</li>
          <li>Gunakan bersama <strong>Cek Konsistensi</strong> untuk menjaring kontradiksi waktu antar bab.</li>
        </ul>
      ),
      action: go('timeline'),
      actionLabel: 'Buka Timeline',
    },
    {
      id: 'feature-consistency',
      group: 'group-world',
      icon: <ShieldCheck className="w-6 h-6 text-green-600" />,
      bg: 'bg-green-50 dark:bg-green-500/10',
      badge: 'Menu: Cek Konsistensi',
      title: 'Cek Konsistensi',
      description: 'Audit satu bab terhadap Codex, Buku Cerita, relasi, dan timeline untuk menemukan pertentangan kanon.',
      howItWorks: 'AI membandingkan isi bab dengan data dunia Anda, lalu menandai bagian yang berpotensi tidak konsisten (mis. ciri tokoh berubah, urutan waktu salah).',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Pilih bab, jalankan pemeriksaan, lalu telusuri daftar temuan.</li>
          <li>Klik sebuah temuan untuk <strong>melompat ke kutipannya di editor</strong> (otomatis tersorot) dan perbaiki di tempat.</li>
        </ul>
      ),
      action: go('consistency'),
      actionLabel: 'Buka Cek Konsistensi',
    },

    // ── AI & ASISTEN ─────────────────────────────────────────────────────────
    {
      id: 'feature-studio',
      group: 'group-ai',
      icon: <MessagesSquare className="w-6 h-6 text-purple-500" />,
      bg: 'bg-purple-50 dark:bg-purple-500/10',
      badge: 'Menu: Studio Asisten',
      title: 'Studio Asisten',
      description: 'Ruang percakapan penuh untuk brainstorming, menyusun plot, atau kritik prosa — dengan riwayat sesi.',
      howItWorks: 'Anda bisa berganti "persona" AI dan melampirkan konteks. "Smart Auto-Context" menyelipkan teks bab yang sedang Anda kerjakan ke tiap jawaban agar selalu relevan.',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li><strong>Persona:</strong> berpindah antara mode seperti <em>Bedah Plot</em>, <em>Kritik Prosa</em>, atau <em>Worldbuilder</em>.</li>
          <li><strong>Lampirkan (+):</strong> impor entri Codex/Bible tertentu agar diskusi terfokus.</li>
          <li><strong>Smart Auto-Context:</strong> aktifkan toggle di header asisten. Gunakan saat buntu ide (writer's block).</li>
          <li>Bisa <strong>Stop</strong> di tengah jawaban atau <strong>Regenerasi</strong> untuk variasi.</li>
        </ul>
      ),
      action: go('brainstorm'),
      actionLabel: 'Buka Studio',
    },
    {
      id: 'feature-scribble',
      group: 'group-ai',
      icon: <Wand2 className="w-6 h-6 text-fuchsia-500" />,
      bg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10',
      badge: 'Panel samping Editor / Codex',
      title: 'Scribble (Asisten Ringkas)',
      description: 'Asisten obrolan kecil yang menempel di samping editor/codex untuk pertanyaan cepat tanpa pindah ke Studio.',
      howItWorks: 'Scribble berbagi sistem sesi dengan Studio namun ditujukan untuk interaksi singkat di tengah menulis (riwayatnya terpisah agar tidak mencampuri Studio).',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Buka panel Scribble dari sisi editor atau codex untuk tanya jawab cepat (mis. <em>"beri 3 alternatif nama kota"</em>).</li>
          <li>Cocok untuk dorongan kecil; pindah ke <strong>Studio Asisten</strong> bila diskusi makin panjang.</li>
        </ul>
      ),
      action: go('write'),
      actionLabel: 'Buka Editor',
    },
    {
      id: 'feature-actions',
      group: 'group-ai',
      icon: <Sparkles className="w-6 h-6 text-yellow-500" />,
      bg: 'bg-yellow-50 dark:bg-yellow-500/10',
      badge: 'Menu: Snippet AI',
      title: 'Snippet AI (Aksi Kustom)',
      description: 'Simpan prompt yang sering dipakai sebagai tombol pintas — seperti "macro" untuk AI.',
      howItWorks: 'Buat fungsi AI milik Anda sendiri (mis. <em>"ubah ke gaya bahasa formal"</em>) lalu panggil berulang kali dari Magic Edit tanpa mengetik ulang.',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Buat snippet baru di menu <strong>Snippet AI</strong>.</li>
          <li>Panggil lewat popup Magic Edit saat menyorot teks — sangat menghemat waktu untuk revisi berulang lintas bab.</li>
        </ul>
      ),
      action: go('actions'),
      actionLabel: 'Buka Snippet AI',
    },
    {
      id: 'feature-ai-settings',
      group: 'group-ai',
      icon: <Key className="w-6 h-6 text-slate-500" />,
      bg: 'bg-slate-100 dark:bg-slate-500/10',
      badge: 'Menu: Pengaturan',
      title: 'Penyedia AI, Kunci (BYOK) & Optimasi',
      description: 'Pilih penyedia & model AI, masukkan kunci API Anda sendiri, dan setel optimasi hemat biaya.',
      howItWorks: 'Aplikasi memakai prinsip BYOK — kunci API disimpan lokal di browser Anda, tidak di server. Bila satu penyedia bermasalah, sistem otomatis mencoba penyedia cadangan.',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Masukkan kunci untuk penyedia pilihan (mis. Google/Gemini, Claude, Groq, OpenRouter, Hugging Face) dan pilih modelnya.</li>
          <li>Atur <strong>"Kedalaman Konteks"</strong> untuk menyeimbangkan kualitas vs hemat token.</li>
          <li>Di <strong>"Optimasi AI Lanjutan"</strong>: batasi lore yang di-cache, pilih model tugas-ringan, dan atur masa hidup cache.</li>
        </ul>
      ),
      action: go('settings'),
      actionLabel: 'Buka Pengaturan',
    },

    // ── PROGRES, DATA & EKSPOR ───────────────────────────────────────────────
    {
      id: 'feature-planning',
      group: 'group-output',
      icon: <LayoutList className="w-6 h-6 text-fuchsia-500" />,
      bg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10',
      badge: 'Menu: Papan Rencana',
      title: 'Papan Rencana & Manajemen Bab',
      description: 'Papan gaya Kanban untuk memantau status bab (Outline → Draft → Selesai) dan menyusun urutannya.',
      howItWorks: 'Setiap bab adalah kartu yang bisa dipindah antar kolom status; ringkasan singkat per bab membantu AI memahami isi bab walau belum selesai ditulis.',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li><strong>Drag &amp; drop</strong> kartu antar kolom saat tahap pengerjaan berubah.</li>
          <li>Urutkan ulang bab dengan menarik ikon "grip" di daftar bab.</li>
          <li>Tulis <strong>Ringkasan</strong> bab agar AI tahu garis besar isinya.</li>
        </ul>
      ),
      action: go('outline'),
      actionLabel: 'Buka Papan Rencana',
    },
    {
      id: 'feature-stats',
      group: 'group-output',
      icon: <Target className="w-6 h-6 text-cyan-500" />,
      bg: 'bg-cyan-50 dark:bg-cyan-500/10',
      badge: 'Header (pil %) + panel kanan Editor',
      title: 'Statistik, Target Harian & Streak',
      description: 'Lacak jumlah kata, target naskah, target harian, dan rentetan hari produktif (streak).',
      howItWorks: 'Klik pil persentase di bilah atas untuk membuka ringkasan target. "Kata hari ini" dihitung dari pertambahan kata Anda; bila target harian tercapai beberapa hari berturut-turut, streak ikut bertambah.',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Klik pil <strong>%</strong> di header → setel <strong>Target Naskah</strong> dan <strong>Target Harian</strong>, pantau progress bar &amp; <strong>streak</strong> 🔥.</li>
          <li><strong>Prose Insights:</strong> buka panel grafik di sisi kanan editor untuk menyorot kalimat terlalu panjang/pasif dan keterbacaan.</li>
        </ul>
      ),
      action: go('write'),
      actionLabel: 'Buka Editor',
    },
    {
      id: 'feature-dashboard',
      group: 'group-output',
      icon: <Gauge className="w-6 h-6 text-indigo-500" />,
      bg: 'bg-indigo-50 dark:bg-indigo-500/10',
      badge: 'Menu: Dashboard',
      title: 'Dashboard Penggunaan AI',
      description: 'Pantau pemakaian token, perkiraan biaya, tingkat cache-hit, dan model yang paling sering dipakai.',
      howItWorks: 'Setiap panggilan AI dicatat lokal. Dashboard merangkumnya menjadi kartu metrik agar Anda bisa menyetel optimasi berdasarkan data nyata, bukan tebakan.',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Lihat kartu <strong>"Token dari Cache"</strong> &amp; cache hit rate untuk memastikan caching bekerja (hemat biaya).</li>
          <li>Bandingkan dengan setelan di <strong>Pengaturan → Optimasi AI Lanjutan</strong> bila ingin menekan biaya.</li>
        </ul>
      ),
      action: go('dashboard'),
      actionLabel: 'Buka Dashboard',
    },
    {
      id: 'feature-export',
      group: 'group-output',
      icon: <FileDown className="w-6 h-6 text-orange-500" />,
      bg: 'bg-orange-50 dark:bg-orange-500/10',
      badge: 'Ikon unduh di Header',
      title: 'Ekspor Multi-Format (MD / PDF / DOCX / EPUB)',
      description: 'Rajut bab-bab menjadi satu berkas siap kirim, dengan pilihan bab yang ingin disertakan.',
      howItWorks: 'Anda mencentang bab mana saja yang diekspor (default semua) lalu memilih format. PDF/DOCX/EPUB mempertahankan format tebal &amp; miring; EPUB menghasilkan e-book standar.',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Klik ikon <FileDown size={12} className="inline" /> di header → pilih format (Markdown, PDF, Word, atau EPUB).</li>
          <li>Centang bab yang ingin disertakan (atau "Pilih Semua"); ringkasan menampilkan jumlah kata yang akan diekspor.</li>
        </ul>
      ),
      action: () => setIsExportOpen(true),
      actionLabel: 'Buka Ekspor',
    },
    {
      id: 'feature-backup',
      group: 'group-output',
      icon: <Cloud className="w-6 h-6 text-blue-500" />,
      bg: 'bg-blue-50 dark:bg-blue-500/10',
      badge: 'Menu: Pengaturan',
      title: 'Backup, Restore & Sinkronisasi',
      description: 'Lindungi karya dengan cadangan otomatis lokal, ekspor/impor berkas cadangan, hingga sinkronisasi Google Drive.',
      howItWorks: 'Cadangan internal terkompresi dibuat berkala. Anda juga bisa menyimpan cadangan ke berkas/folder, atau menyalakan sinkronisasi Drive (BYOK) untuk salinan luar perangkat.',
      howToUse: (
        <ul className="list-disc pl-5 space-y-2 mt-2 text-slate-700 dark:text-slate-300 font-medium">
          <li>Di <strong>Pengaturan</strong>, gunakan <strong>Backup/Restore</strong> untuk menyimpan atau memulihkan seluruh data proyek.</li>
          <li>Opsional: hubungkan <strong>Google Drive</strong> agar cadangan tersimpan di luar perangkat secara berkala.</li>
          <li>Semua data tersimpan <strong>lokal di browser</strong> — rutin buat cadangan agar aman dari hapus cache/ganti perangkat.</li>
        </ul>
      ),
      action: go('settings'),
      actionLabel: 'Buka Pengaturan',
    },
  ];

  const aiEfficiencyTips = [
    {
      icon: <Cpu className="w-5 h-5 text-sky-500" />,
      title: 'Blok Seperlunya Saja',
      description: 'Magic Edit hanya mengolah area yang Anda sorot. Sorot paragraf yang butuh diperbaiki saja untuk menghemat token.',
    },
    {
      icon: <Coins className="w-5 h-5 text-amber-500" />,
      title: 'Batasi Ukuran Output',
      description: 'Beri instruksi eksplisit seperti "maksimal 3 poin" atau "dalam 50 kata" agar AI tidak menjawab terlalu panjang.',
    },
    {
      icon: <Layers className="w-5 h-5 text-emerald-500" />,
      title: 'Kelompokkan Edit Lore',
      description: 'Mengedit Codex/Bible membatalkan cache. Selesaikan semua editing lore dulu, baru menulis, agar cache tetap "hangat" dan murah.',
    },
    {
      icon: <Zap className="w-5 h-5 text-violet-500" />,
      title: 'Manfaatkan @Mention',
      description: 'AI membaca profil Codex secara mendalam saat dipanggil dengan @ — cara terfokus menjaga konteks tanpa membebani memori.',
    },
  ];

  const workflowSteps = [
    { title: 'Susun Buku Cerita & Codex', description: 'Tetapkan aturan dunia dan profil tokoh utama sebagai fondasi kecerdasan asisten.', status: 'Fondasi', view: 'bible' as ViewMode },
    { title: 'Rancang di Papan Rencana', description: 'Pecah cerita menjadi bab-bab kecil agar progres terukur dan tidak terasa berat.', status: 'Perencanaan', view: 'outline' as ViewMode },
    { title: 'Tulis di Editor Fokus', description: 'Tutup panel samping, panggil lore dengan @mention tanpa keluar dari editor.', status: 'Eksekusi', view: 'write' as ViewMode },
    { title: 'Poles & Periksa', description: 'Gunakan Studio Asisten untuk ide, Magic Edit untuk gaya bahasa, dan Cek Konsistensi untuk plot hole.', status: 'Iterasi', view: 'brainstorm' as ViewMode },
  ];

  const quickShortcuts = [
    { key: '@', action: 'Panggil Menu Mention (di editor)' },
    { key: 'Ctrl + K', action: 'Pencarian Global (lompat bab/codex)' },
    { key: 'Ctrl + F', action: 'Pencarian Global (alternatif)' },
    { key: 'Ctrl + H', action: 'Cari & Ganti dalam Bab' },
    { key: 'Ctrl + Alt + F', action: 'Mode Fokus (layar penuh)' },
    { key: 'Esc', action: 'Tutup panel / keluar mode' },
  ];

  const selectTab = (id: string) => {
    setActiveSection(id);
    containerRef.current?.parentElement?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderFeatureCard = (item: FeatureItem) => {
    const isOpen = expandedCards.has(item.id);
    return (
      <motion.div
        key={item.id} id={item.id}
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }}
        className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow group overflow-hidden scroll-mt-24"
      >
        {/* Header — selalu tampil, klik untuk expand */}
        <button
          type="button"
          onClick={() => toggleCard(item.id)}
          aria-expanded={isOpen}
          className="w-full text-left p-6 md:p-8 flex items-start gap-5"
        >
          <div className={cn('w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center shadow-inner', item.bg)}>
            {item.icon}
          </div>
          <div className="flex-1 min-w-0">
            <span className="inline-block text-[10px] font-bold uppercase tracking-tighter text-slate-500 dark:text-slate-400 mb-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
              {item.badge}
            </span>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight mb-2">{item.title}</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed text-sm">{item.description}</p>
          </div>
          <ChevronDown
            size={22}
            className={cn('shrink-0 mt-1 text-slate-400 transition-transform duration-300', isOpen && 'rotate-180')}
          />
        </button>

        {/* Detail — collapsible */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-6 md:px-8 pb-6 md:pb-8">
                <div className="bg-slate-50 dark:bg-slate-800/20 rounded-3xl p-6 md:p-8 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                    <Info size={14} className="text-indigo-500" /> Bagaimana ia bekerja?
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm font-medium">{item.howItWorks}</p>

                  <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                      <MousePointer2 size={14} className="text-indigo-500" /> Panduan Penggunaan
                    </div>
                    <div className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">{item.howToUse}</div>
                  </div>

                  <div className="mt-8 pt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={item.action}
                      className="flex items-center gap-2 text-xs font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 px-4 py-2.5 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md group/try"
                    >
                      {item.actionLabel}
                      <ChevronRight size={14} className="group-hover/try:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div ref={containerRef} className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto px-4 sm:px-6 pb-24 pt-4 lg:pt-8 min-h-screen">

      {/* Sticky Navigation Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-24 space-y-1">
          <div className="px-3 mb-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Navigasi Panduan</h3>
          </div>
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectTab(s.id)}
              className={cn(
                'w-full flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                s.sub ? 'pl-7 pr-4' : 'px-4',
                activeSection === s.id
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-500/20'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50',
              )}
            >
              <span className={cn(
                'p-1.5 rounded-lg transition-colors',
                activeSection === s.id ? 'bg-indigo-500/20' : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700',
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
              <p className="text-xs text-indigo-100 leading-relaxed mb-4 relative z-10">Tanyakan langsung pada Studio Asisten.</p>
              <button
                type="button"
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

      {/* Main Content */}
      <main className="flex-1 max-w-4xl space-y-24">

        {/* Tab bar (mobile) */}
        <div className="lg:hidden -mx-4 sm:-mx-6 px-4 sm:px-6 sticky top-0 z-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md py-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectTab(s.id)}
                className={cn(
                  'flex items-center gap-2 shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all',
                  activeSection === s.id
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
                )}
              >
                {s.icon}
                {s.title}
              </button>
            ))}
          </div>
        </div>

        {/* Hero */}
        {activeSection === 'getting-started' && (
        <header id="getting-started" className="relative scroll-mt-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-full mb-8 text-xs font-bold tracking-widest uppercase border border-indigo-100 dark:border-indigo-500/20"
          >
            <Sparkles size={14} /> Dokumentasi & Panduan
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
            AetherScribe adalah ruang kerja menulis novel yang berjalan sepenuhnya di perangkat Anda (local-first). Semua fitur di bawah dikelompokkan agar mudah ditelusuri — mulai dari menulis, membangun dunia, hingga menerbitkan.
          </motion.p>

          {/* Workflow timeline */}
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-6">Alur Kerja yang Disarankan</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative">
            {workflowSteps.map((step, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setViewMode(step.view)}
                className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all hover:-translate-y-1 text-left"
              >
                <div className="text-4xl font-black text-slate-100 dark:text-slate-800 absolute -top-2 -left-2 opacity-50 group-hover:scale-110 transition-transform">0{i + 1}</div>
                <div className="relative z-10">
                  <span className="inline-block text-[10px] font-bold uppercase tracking-tighter text-indigo-500 mb-2 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full">{step.status}</span>
                  <h3 className="font-bold text-slate-900 dark:text-white mb-2 leading-tight group-hover:text-indigo-500 transition-colors flex items-center justify-between">
                    {step.title}
                    <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-indigo-500 shrink-0" />
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{step.description}</p>
                </div>
              </button>
            ))}
            <div className="hidden lg:block absolute top-[40%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent -z-10" />
          </div>
        </header>
        )}

        {/* Feature groups */}
        {groups.filter(g => g.id === activeSection).map((g) => (
          <section key={g.id} id={g.id} className="space-y-10 scroll-mt-24">
            <div className="flex items-center gap-4">
              <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg', g.color)}>
                {g.icon}
              </div>
              <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{g.title}</h2>
                <p className="text-slate-500 dark:text-slate-400">{g.subtitle}</p>
              </div>
            </div>

            <div className="space-y-8">
              {features.filter(f => f.group === g.id).map(renderFeatureCard)}
            </div>
          </section>
        ))}

        {/* Tips */}
        {activeSection === 'tips' && (
        <section id="tips" className="space-y-12 scroll-mt-24">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <Lightbulb size={24} />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Tips Efisiensi & Token</h2>
              <p className="text-slate-500 dark:text-slate-400">Maksimalkan AI dengan cara yang cerdas dan hemat.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {aiEfficiencyTips.map((tip, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl relative overflow-hidden group hover:border-amber-500/50 transition-colors shadow-sm"
              >
                <div className="bg-slate-50 dark:bg-slate-800 w-12 h-12 rounded-xl flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform">
                  {tip.icon}
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-3 text-lg leading-tight">{tip.title}</h4>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{tip.description}</p>
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[80px] rounded-full pointer-events-none" />
              </motion.div>
            ))}
          </div>
        </section>
        )}

        {/* Shortcuts & technical */}
        {activeSection === 'shortcuts' && (
        <section id="shortcuts" className="space-y-12 scroll-mt-24">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <Key size={24} />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Shortcut & Keamanan</h2>
              <p className="text-slate-500 dark:text-slate-400">Navigasi cepat dan bagaimana data Anda dijaga.</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
              <div className="p-8 md:p-12 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800">
                <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
                  <Command size={20} className="text-indigo-500" /> Pintasan Keyboard
                </h3>
                <div className="space-y-4">
                  {quickShortcuts.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-4 group">
                      <span className="text-slate-500 dark:text-slate-400 font-medium group-hover:text-slate-900 dark:group-hover:text-white transition-colors text-sm">{item.action}</span>
                      <kbd className="min-w-[2.5rem] text-center bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-700 px-2 py-1 rounded text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shadow-sm transition-all active:translate-y-0.5 active:border-b-0 shrink-0">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-8 md:p-12 bg-slate-50/50 dark:bg-slate-800/10 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-6 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm self-start">
                  <ShieldCheck className="text-emerald-500" size={24} />
                  <span className="text-sm font-bold tracking-tight">Privasi & Keamanan Data</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">
                  Semua naskah dan kunci API Anda disimpan <strong>lokal di browser</strong> (tidak ada server penyimpanan). Teks hanya dikirim ke penyedia AI yang Anda pilih saat sebuah fitur AI dijalankan.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    <ChevronRight size={14} /> <span>Data tersimpan di perangkat (local-first)</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    <ChevronRight size={14} /> <span>Kunci API milik Anda (BYOK)</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    <ChevronRight size={14} /> <span>Backup otomatis + sinkronisasi Drive opsional</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        )}

        {/* Footer */}
        <footer className="text-center py-12 px-8 bg-gradient-to-b from-transparent to-slate-50 dark:to-slate-900/50 rounded-b-[3rem]">
          <BookOpen className="mx-auto mb-6 text-slate-300 dark:text-slate-700" size={64} />
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Mulai Tulis Kisahmu Hari Ini</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto mb-10 leading-relaxed font-medium">
            Semakin sering Anda berinteraksi dengan asisten, semakin ia memahami pola pikir kreatif Anda. Jadikan ini partner literatur sejati Anda.
          </p>
          <button
            type="button"
            onClick={() => selectTab('getting-started')}
            className="inline-flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 shadow-xl hover:shadow-indigo-500/20"
          >
            Kembali ke Mulai
          </button>
        </footer>

      </main>
    </div>
  );
}
