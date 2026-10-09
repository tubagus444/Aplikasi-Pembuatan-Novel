# ROADMAP & BACKLOG AKTIF — AetherScribe

> **Pusat Rencana & Backlog Proyek.** Dokumen ini adalah satu-satunya pelacak kerja aktif untuk AetherScribe. 
> Semua fitur yang sudah selesai dan riwayat keputusan teknis telah diarsipkan dengan rapi di direktori [`docs/archive/`](file:///d:/novel/Aplikasi%20Novel/Aplikasi-Pembuatan-Novel/docs/archive/).

---

## 1. Prioritas Terbuka (Actionable)

Item-item yang memiliki desain jelas dan siap dikerjakan jika diperlukan peningkatan pada area terkait:

### 1.1 Worldbuilding: Fase 2 Kalender Dunia & Kalkulator Perjalanan (SELESAI ✅)
- **Status:** Selesai (`chronologyAudit.ts`, `CalendarCalculatorModal.tsx`, `ChronologyAuditModal.tsx`, integrasi `continuity.ts`).
- **Pencapaian:**
  1. **Deteksi Urutan Mundur Waktu Antar-Bab:** Audit deterministik membandingkan tanggal peristiwa dengan `Chapter.order`, mendeteksi urutan tanggal terbalik dalam satu bab, serta rentang tanggal tidak valid.
  2. **Toleransi Kilas Balik (*Flashback*):** Otomatis mengenali penanda flashback/analepsis tanpa memicu alarm palsu.
  3. **Kalkulator Jarak Waktu & Perjalanan:** Menghitung selisih hari, pemecah unit waktu ramah-baca (`breakdownDays`), proyeksi tanggal tiba berdasarkan kecepatan moda transportasi fantasi, dan tombol instan membuat peristiwa rentang linimasa.
  4. **Integrasi Panel:** Terhubung langsung ke Dasbor Peta Kontinuitas (`chronology-retrograde` check) dan lencana peringatan interaktif di header Kalender Dunia.

### 1.2 Penyimpanan & Performa: Diet Jalur Backup Serialisasi
- **Status:** Jalur internal sudah dioptimasi (`assembleBackupJson` 1x stringify).
- **Tujuan:** Untuk proyek dengan naskah sangat masif:
  - Pertimbangkan memindahkan proses serialisasi JSON / kompresi gzip ke Web Worker agar main thread sama sekali tidak mengalami jank pada naskah ratusan ribu kata.

### 1.3 Database: Konvensi Migrasi Streaming
- **Status:** Catatan teknis untuk migrasi skema masa depan.
- **Tujuan:** Migrasi Dexie di masa depan sebaiknya menghindari `toArray()` seluruh tabel besar di dalam transaksi jika hanya butuh memodifikasi field parsial. Buat pola cursor/streaming untuk update bertahap.

### 1.4 Ekspor Manuskrip: Cakupan Unicode Font PDF
- **Status:** Aman untuk bahasa Indonesia standar (huruf latin, tanda petik lengkung, em-dash).
- **Tujuan:** Jika di masa depan novel menggunakan karakter/glyph khusus (alfabet fiksi / aksara non-latin), integrasikan font kustom ber-subset UTF-8 ke generator jsPDF.

---

## 2. Peningkatan Halus (Nice to Have)

Fitur kecil yang memperkaya pengalaman tanpa mengubah alur inti:

- **Glosarium:** Mode `strictMatch` opt-in per-entri untuk istilah pendek/huruf-kecil yang rawan false-positive.
- **Janji Plot:** Rekomendasi otomatis kandidat kata kunci dari kata berhuruf kapital atau entri glosarium saat membuat janji baru.
- **Audit Konsistensi Batch:** Antrian pemeriksaan konsistensi untuk beberapa bab berurutan dengan memanfaatkan cache Knowledge Base yang sama.

---

## 3. Ide Diparkir (❄️ Riset & Backburner)

Ide-ide konseptual yang diparkir karena membutuhkan fondasi baru, rawan false-positive, atau di luar urgensi saat ini:

- **Simulator Dunia (State Entitas Berubah Lintas-Bab):**
  - Melacak status hidup/mati karakter, kepemilikan artefak, atau pangkat yang berubah sepanjang bab, serta validasi jarak/waktu tempuh. *(Dibutuhkan fondasi "state-per-bab" terlebih dahulu).*
- **Lensa Suara Dialog (Analisis Gaya Bicara):**
  - Metrik panjang ujaran, variasi kosakata, dan gaya bicara deterministik per-tokoh untuk mendeteksi apakah semua karakter terdengar serupa.
- **Moodboard / Referensi Visual Codex:**
  - Galeri visual (wajah/kostum) per entri Codex. *(Perlu mitigasi kuota penyimpanan IndexedDB).*
- **Peringatan POV Aktif:**
  - Deteksi loncatan sudut pandang narasi (*anti head-hopping*). *(Tantangan: rawan false-positive tinggi pada deteksi teks bahasa Indonesia).*

---

## 4. Indeks Arsip Historis

Dokumen masa lalu yang telah diselesaikan dan dirangkum untuk referensi arsitektur:
- [`docs/archive/RENCANA-AUDIT-KODE.md`](file:///d:/novel/Aplikasi%20Novel/Aplikasi-Pembuatan-Novel/docs/archive/RENCANA-AUDIT-KODE.md) — Keputusan audit 12 area kualitas kode inti.
- [`docs/archive/RENCANA-OPTIMASI-AI.md`](file:///d:/novel/Aplikasi%20Novel/Aplikasi-Pembuatan-Novel/docs/archive/RENCANA-OPTIMASI-AI.md) — Rekam 14 optimasi token, prompt caching, dan routing model AI.
- [`docs/archive/RENCANA-ATLAS-DUNIA.md`](file:///d:/novel/Aplikasi%20Novel/Aplikasi-Pembuatan-Novel/docs/archive/RENCANA-ATLAS-DUNIA.md) — Spesifikasi awal dan arsitektur panel peta interaktif Atlas.
- [`docs/archive/ARSIP-AUDIT-FABLE.md`](file:///d:/novel/Aplikasi%20Novel/Aplikasi-Pembuatan-Novel/docs/archive/ARSIP-AUDIT-FABLE.md) — Riwayat lengkap perbaikan audit menyeluruh Fable Batch 1–3.
- [`docs/archive/ARSIP-FITUR-WORLDBUILDING.md`](file:///d:/novel/Aplikasi%20Novel/Aplikasi-Pembuatan-Novel/docs/archive/ARSIP-FITUR-WORLDBUILDING.md) — Riwayat implementasi 17 modul worldbuilding (Kalender, Glosarium, Faksi, Graf Lore, dll).
