# AetherScribe

Editor novel berbasis browser yang **local-first** dengan mesin AI modular untuk
menjaga konsistensi cerita, lore, karakter, dan gaya penulisan. Fokusnya bukan
sekadar "AI menulis cerita", melainkan membantu penulis **mengelola novel panjang,
menjaga konteks, dan mempercepat revisi** — tanpa membutuhkan database backend.

## Fitur Utama

- **Editor kaya** berbasis TipTap (highlight codex, mention, search & replace, mode fokus/typewriter).
- **Story Bible & Codex** — basis data worldbuilding lokal (karakter, lokasi, item, sihir, event) lengkap dengan alias, tag, dan relasi antar-entitas (Graph-RAG).
- **Mesin Konteks hybrid** yang menyuntikkan lore relevan ke prompt AI:
  - Pencocokan nama/alias eksak (Aho-Corasick, di Web Worker).
  - Pencarian semantik lokal via embeddings `Xenova/all-MiniLM-L6-v2` (berjalan di browser, di-cache di IndexedDB).
  - Pencarian leksikal (BM25) via Orama sebagai fallback.
- **AI multi-provider** dengan fallback otomatis, circuit breaker, dan exponential backoff:
  Google Gemini, Anthropic Claude, Groq, OpenRouter, dan Ollama (lokal).
- **Daemon latar belakang**: auto-backup (gzip), auto-summarizer per bab.
- **Sinkronisasi opsional** ke Google Drive (BYOK) dan Firebase.
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
   Variabel yang didukung: `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `CLAUDE_API_KEY`.
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
