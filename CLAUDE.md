# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyek

**AetherScribe** — lingkungan penulisan novel berbasis browser yang **local-first** (IWE). Tujuan produknya bukan "AI menulis cerita", melainkan membantu penulis **mengelola novel panjang, menjaga konsistensi lore/karakter/gaya, dan mempercepat revisi**. **Tidak ada database backend**: seluruh data pengguna tersimpan di browser via Dexie/IndexedDB. Server Express (`server.ts`) hanya berperan sebagai **proxy AI + penyaji file statis** — tidak menyimpan state apa pun.

README berbahasa Indonesia; string yang tampil ke pengguna dan pesan error sebagian besar juga berbahasa Indonesia. Ikuti gaya itu saat menyentuh teks UI.

## Perintah

```bash
npm run dev      # tsx server.ts → Express + Vite (mode middleware) di http://localhost:3000
npm run build    # vite build (frontend) + esbuild bundle server.ts → dist/server.cjs
npm run start    # node dist/server.cjs (menyajikan dist/ secara statis; set NODE_ENV=production)
npm test         # vitest (mode watch). Pakai `npx vitest run` untuk sekali jalan tanpa watch
npm run lint     # tsc --noEmit (hanya type-check; tidak ada ESLint)
npm run clean    # rm -rf dist
```

- **Menjalankan satu test:** `npx vitest run src/lib/ahoCorasick.test.ts` atau filter berdasarkan nama `npx vitest run -t "pola"`.
- **Tidak ada config vitest terpisah**; Vitest membaca `vite.config.ts`, jadi alias `@` juga berlaku di test.
- Test diletakkan berdampingan sebagai `*.test.ts` di sebelah unit yang diuji (saat ini hanya di `src/lib/`: ahoCorasick, chunkEngine, loreUtils, utils).
- **`npm run dev` TIDAK menjalankan `vite` langsung** — ia menjalankan `server.ts`, yang memasang Vite sebagai middleware sehingga proxy API dan SPA berbagi port 3000. Mengubah frontend saja? Tetap lewat `npm run dev`.

## Alias import (gampang keliru)

`@` dipetakan ke **root repository** (`vite.config.ts` dan `paths` di `tsconfig.json`), jadi import sumber ditulis `@/src/db`, `@/src/services/ai`, `@/src/lib/utils` — **bukan** `@/db`. Pertahankan prefix ini saat menambah import.

## Arsitektur

### Data & state
- **Penyimpanan:** Dexie (`src/db.ts`), nama DB `AetherScribeDB`, saat ini **skema versi 17**. Skema bersifat append-only — untuk mengubah tabel, tambahkan blok `this.version(N).stores({...})` baru dengan migrasi `.upgrade()`; **jangan** mengedit versi yang sudah ada. Tabel: projects, chapters, codex, bible, aiActions, snapshots, timeline, relationships, errors, backups, chatSessions, embeddings, aiUsageLogs.
- **State:** React Context (`src/contexts/`: Project, Navigation, UI, EditorPanel) + **Dexie live query** (`dexie-react-hooks` `useLiveQuery`, dibungkus di `src/hooks/useOptimizedLiveQuery.ts` / `useProjectData.ts`). Tidak ada Redux/Zustand.
- **Routing tampilan** berupa string `viewMode` di `NavigationContext`. `src/components/layout/MainView.tsx` berpindah panel berdasarkan nilai itu; semua panel di-`React.lazy` kecuali editor. Editor di-mount **hanya** saat `viewMode === 'write'` (disengaja, untuk menghemat RAM) dan di-key dengan `activeChapterId`.
- Susunan provider tetap di `src/main.tsx` (Project → Navigation → UI → Toast → Backup → ErrorBoundary). `oramaSync.setupHooks()` serta handler global `error`/`unhandledrejection` juga dipasang di sana.

### Alur AI (inti aplikasi)
Kode fitur tidak pernah memanggil provider secara langsung. Jalurnya:

```
fitur → src/services/ai/index.ts (facade: processRewrite / processChat / extractToCodex / expandCodexEntry / checkConsistency)
      → callAI() ……… ketahanan: circuit breaker per-provider + exponential backoff + fallback otomatis
      → callProxy() (src/services/ai/proxy.ts)
      → POST /api/ai/proxy  (server.ts)
      → provider asli (Gemini / Claude / Groq / OpenRouter / Ollama)
```

- **Kunci BYOK ada di sisi klien.** Disimpan di `localStorage` ter-encode base64 (atau `sessionStorage`) dengan kunci `ai_key_<provider>`, dibaca oleh `getSettings()` di `index.ts`, lalu diteruskan ke proxy lewat header `x-api-key`. Server memprioritaskan kunci dari klien dan jatuh ke `.env` (`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `CLAUDE_API_KEY`) sebagai cadangan. Provider/model/contextDepth juga berupa kunci localStorage (`ai_provider`, `ai_model_<provider>`, `ai_context_depth`).
- **Urutan fallback** adalah `['openrouter','google','claude','groq']`; fallback dilewati untuk `INVALID_KEY`/`QUOTA_EXCEEDED` (percuma mengulang kunci yang salah) dan hanya dipakai untuk error koneksi/server/rate-limit. Circuit terbuka setelah 3 kegagalan beruntun selama 30 detik.
- **Dua mode injeksi konteks** (keduanya di `index.ts`):
  - **Mode caching** untuk google/claude/openrouter saat `contextDepth !== 'minimal'`: *seluruh* Story Bible + Codex diurutkan secara deterministik dan ditempatkan di system prompt yang **statis** untuk memaksimalkan cache prompt provider; teks scene yang dinamis diletakkan di user prompt.
  - **Mode RAG legacy** selain itu: `getRelevantContext`/`getRelevantBibleRules` memfilter lore secara dinamis lewat context worker.
- Template prompt ada di `src/lib/aiPrompts.ts`. `AbortController` per-aksi memungkinkan `cancelAI(type)`.

### Komputasi berat berjalan di Web Worker (jangan di main thread)
- `src/services/contextWorker.ts` (dikendalikan `src/services/contextEngine.ts`): mesin konteks hibrida — pencocokan nama/alias eksak **Aho-Corasick** (`src/lib/ahoCorasick.ts`), **embedding semantik lokal** via `@xenova/transformers` (`Xenova/all-MiniLM-L6-v2`, embedding di-cache di tabel IndexedDB `embeddings`), dan **penghitungan token** via `js-tiktoken`. Komunikasi berbasis request/id dengan timeout 30 detik; progres indexing disiarkan sebagai window event `semantic-indexing-progress`.
- `src/services/rag/oramaWorker.ts` + `oramaStore.ts` + `oramaSync.ts`: pencarian leksikal **BM25 Orama** sebagai fallback RAG, dijaga sinkron dengan Dexie via hooks.
- `src/workers/tokenWorker.ts`: penghitungan token untuk meter konteks live.

### Editor
TipTap 3 (`src/features/editor/`). Extension kustom di `extensions/`: `PassiveCodexHighlight` dan `SemanticHighlight` (menyorot entitas codex di dalam teks), `SearchAndReplace`. Perilaku editor disusun dari `hooks/` (`useNovelEditor`, `useEditorAI`, `useEditorCodex`, `useEditorSave`, `useTypewriterMode`, …).

### Daemon latar belakang (dimulai dari `src/App.tsx`)
- `useAutoBackup` — backup berkala terkompresi gzip ke tabel `backups` (`backupService.ts`); sinkronisasi Google Drive opsional (`driveBackupService.ts`, `googleAuth.ts`, BYOK).
- `useAutoSummarizer` — ringkasan AI per-bab.
- `cleanupAILogs()` dan pengecekan kuota penyimpanan berjalan saat mount.

### Organisasi kode
Berbasis fitur di bawah `src/features/{assistant,chapters,codex,editor,lore}` (masing-masing punya `components/` + `hooks/`); UI lintas-fitur di `src/components/{layout,panels,modals,common}`; logika murni dan algoritma di `src/lib/`; integrasi/service di `src/services/`.

## Konvensi & jebakan
- **Extension TipTap dipin tepat ke `3.22.5`** di semua paket `@tiptap/*` — jaga tetap seragam saat upgrade, kalau tidak editor rusak.
- `experimentalDecorators` aktif dan `noEmit` diset (Vite/esbuild yang melakukan transpilasi sebenarnya); `tsc` hanya untuk type-check.
- Catatan `HMR`/`DISABLE_HMR` di `vite.config.ts` untuk lingkungan host Google AI Studio (proyek ini di-scaffold sebagai applet AI Studio); biarkan apa adanya.
- `firebase-applet-config.json` berisi nilai placeholder — sinkronisasi Firebase bersifat opt-in dan config asli berasal dari pengguna, bukan file ini.
- Ini **aplikasi pribadi, satu pengguna**; sesuai keputusan pemilik, pengerasan keamanan proxy (auth, rate limiting, base URL Ollama yang dikontrol klien / permukaan SSRF di `server.ts`) sengaja di luar cakupan kecuali diangkat secara eksplisit.

## Audit kualitas kode
`RENCANA-AUDIT-KODE.md` (root) adalah tracker audit bertahap: 12 area dengan prioritas, status per-item (✅/🔄/⬜), dan temuan. Item berdampak-tinggi sudah diperbaiki (P0 jantung AI, data-loss autosave, body-limit server, backup chatSessions, ketahanan DB/worker, dll). Sisa item bersifat cosmetic/opt-in/refactor besar. Cek file itu sebelum mengerjakan ulang area yang sudah diaudit, dan perbarui statusnya bila menyentuh temuan terkait.

## Optimasi penggunaan AI
`RENCANA-OPTIMASI-AI.md` (root) adalah tracker optimasi token/biaya AI (status per-item ✅/🔄/⬜): prompt caching trio + extended TTL Claude, plafon `max_tokens` per-aksi, dan routing model per-tugas sudah selesai; sisa item (cache riwayat chat, tuning `MAX_CACHED_LORE_CHARS` berbasis data Dashboard) belum. Cek file itu sebelum menyentuh jalur AI terkait token/caching/model.
