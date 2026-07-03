# AetherScribe

Editor novel berbasis browser yang **local-first** dengan mesin AI modular untuk
menjaga konsistensi cerita, lore, karakter, dan gaya penulisan. Fokusnya bukan
sekadar "AI menulis cerita", melainkan membantu penulis **mengelola novel panjang,
menjaga konteks, dan mempercepat revisi** — tanpa membutuhkan database backend.

## Fitur Utama

- **Editor kaya** berbasis TipTap: highlight codex, mention `@`, cari & ganti (dalam-bab & lintas-bab), mode fokus/typewriter, zoom, catatan revisi (margin notes), dan snapshot/riwayat versi per bab.
- **Story Bible & Codex** — basis data worldbuilding lokal (karakter, lokasi, item, sihir, event) lengkap dengan alias, kategori kustom, dan relasi antar-entitas (Graph-RAG). **Kategori kustom bisa punya template field terstruktur** (mis. Bestiari: Habitat/Kelemahan/Level Ancaman) yang ikut ke AI & ekspor — satu mekanisme menggantikan banyak "modul" terpisah. **Lokakarya Codex**: bangun/rombak entri lewat diskusi AI. **Kebenaran Tersembunyi**: tandai entri/fakta sebagai rahasia penulis (kanon vs yang diketahui pembaca) — disembunyikan dari sorotan, saran & ekspor, tapi tetap diberikan ke AI agar konsistensi twist terjaga.
- **Mesin Konteks hybrid** yang menyuntikkan lore relevan ke prompt AI:
  - Pencocokan nama/alias eksak (Aho-Corasick, di Web Worker).
  - Pencarian semantik lokal via embeddings `Xenova/all-MiniLM-L6-v2` (berjalan di browser, di-cache di IndexedDB).
  - Pencarian leksikal (BM25) via Orama sebagai fallback.
- **Analisis & konsistensi** — sebagian **nol token** (deterministik, lokal):
  - Cek Konsistensi per-bab (AI) & Konsistensi Inline (garis bawah: timeline amber, ejaan nama/"Buku Gaya" merah, temuan AI ungu).
  - Peta Kontinuitas, Lensa Karakter, Wawasan Prosa, Timeline Cerita, Saran Entitas, dan Janji Plot (Chekhov's Gun).
  - **Kelengkapan Dunia**: status kematangan per entri lore (Solid/Parsial/Rangka, manual + saran otomatis) plus daftar TODO — peta bagian worldbuilding yang masih perlu digarap.
  - **Heatmap Tensi/Pacing**: kurva naik-turun tensi per bab (manual 1–5 + saran otomatis dari sinyal prosa) untuk evaluasi makro — deteksi bagian yang tegang terus (pembaca jenuh) atau melandai.
- **Asisten AI**: Magic Edit (tulis ulang per-seleksi), Studio Asisten & Scribble (chat), snippet/aksi kustom, plus pencarian adegan semantik.
- **AI multi-provider** dengan fallback otomatis, circuit breaker, dan exponential backoff:
  Google Gemini, Anthropic Claude, Groq, OpenRouter, Hugging Face, dan Ollama (lokal). Prompt caching & penyetel token/biaya bawaan.
- **Daemon latar belakang**: auto-backup (gzip), auto-summarizer per bab.
- **Backup berlapis & ekspor**: cadangan otomatis (IndexedDB), ke folder lokal (File System Access), dan Google Drive (BYOK); ekspor/impor per-novel; ekspor manuskrip ke **Markdown/PDF/DOCX/EPUB**.
- **Dashboard & progres**: statistik pemakaian AI (token, cache-hit) serta target menulis harian + streak.
- **Penyimpanan lokal** penuh via Dexie/IndexedDB — data tetap di perangkat Anda.

## Arsitektur Singkat

- Frontend: React 19 + Vite + TypeScript + Tailwind v4.
- Penyimpanan: Dexie/IndexedDB (skema terversi, lihat `src/db.ts`).
- Server (`server.ts`): Express tipis yang hanya berperan sebagai **proxy** ke provider AI
  dan menyajikan build statis. Tidak ada database server.
- Komputasi berat (matching codex, embeddings, token counting) dijalankan di **Web Workers**.

## Menjalankan Secara Lokal

**Prasyarat:** Node.js

1. Install dependency:
   ```bash
   npm install
   ```
2. (Opsional) Salin `.env.example` menjadi `.env` dan isi kunci API provider yang ingin
   dijadikan default sisi server. Kunci API juga bisa dimasukkan langsung lewat menu
   **Pengaturan** di aplikasi (BYOK) — ini cara yang disarankan untuk pemakaian pribadi.
   ```bash
   cp .env.example .env
   ```
   Variabel yang didukung: `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `CLAUDE_API_KEY`, `HF_API_KEY`.
3. Jalankan server pengembangan:
   ```bash
   npm run dev
   ```
   Aplikasi berjalan di `http://localhost:3000`.

> Untuk Ollama, jalankan Ollama secara lokal; aplikasi memakai endpoint OpenAI-compatible
> (`/v1/chat/completions`) di base URL yang dikonfigurasi pada Pengaturan.

## Skrip

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` | Jalankan server + Vite (mode pengembangan). |
| `npm run build` | Build frontend (Vite) dan bundle server (esbuild). |
| `npm run start` | Jalankan hasil build produksi. |
| `npm test` | Jalankan unit test (Vitest). |
| `npm run lint` | Type-check via `tsc --noEmit`. |
