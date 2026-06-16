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
- Test diletakkan berdampingan sebagai `*.test.ts` di sebelah unit yang diuji (saat ini di `src/lib/`: ahoCorasick, chunkEngine, loreUtils, utils, orphanEntities, timelineSummary).
- **`npm run dev` TIDAK menjalankan `vite` langsung** — ia menjalankan `server.ts`, yang memasang Vite sebagai middleware sehingga proxy API dan SPA berbagi port 3000. Mengubah frontend saja? Tetap lewat `npm run dev`.

## Alias import (gampang keliru)

`@` dipetakan ke **root repository** (`vite.config.ts` dan `paths` di `tsconfig.json`), jadi import sumber ditulis `@/src/db`, `@/src/services/ai`, `@/src/lib/utils` — **bukan** `@/db`. Pertahankan prefix ini saat menambah import.

## Arsitektur

### Data & state
- **Penyimpanan:** Dexie (`src/db.ts`), nama DB `AetherScribeDB`, saat ini **skema versi 18**. Skema bersifat append-only — untuk mengubah tabel, tambahkan blok `this.version(N).stores({...})` baru dengan migrasi `.upgrade()`; **jangan** mengedit versi yang sudah ada. Tabel: projects, chapters, codex, bible, aiActions, snapshots, timeline, relationships, errors, backups, chatSessions, embeddings, aiUsageLogs.
- **State:** React Context (`src/contexts/`: Project, Navigation, UI, EditorPanel) + **Dexie live query** (`dexie-react-hooks` `useLiveQuery`, dibungkus di `src/hooks/useOptimizedLiveQuery.ts` / `useProjectData.ts`). Tidak ada Redux/Zustand.
- **Routing tampilan** berupa string `viewMode` di `NavigationContext`. `src/components/layout/MainView.tsx` berpindah panel berdasarkan nilai itu; semua panel di-`React.lazy` kecuali editor. Editor di-mount **hanya** saat `viewMode === 'write'` (disengaja, untuk menghemat RAM) dan di-key dengan `activeChapterId`.
- Susunan provider tetap di `src/main.tsx` (Project → Navigation → UI → Toast → Backup → ErrorBoundary). `oramaSync.setupHooks()` serta handler global `error`/`unhandledrejection` juga dipasang di sana.

### Alur AI (inti aplikasi)
Kode fitur tidak pernah memanggil provider secara langsung. Jalurnya:

```
fitur → src/services/ai/index.ts (facade: processRewrite / processChat / expandCodexEntry / checkConsistency / enrichEntities)
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
Berbasis fitur di bawah `src/features/{assistant,chapters,codex,consistency,editor,lore,timeline}` (masing-masing punya `components/` + `hooks/`); UI lintas-fitur di `src/components/{layout,panels,modals,common}`; logika murni dan algoritma di `src/lib/`; integrasi/service di `src/services/`.

Fitur konsistensi yang ditambahkan belakangan (lihat `viewMode`): **Cek Konsistensi** (`checkConsistency` — audit satu bab vs Codex+Bible+relasi+timeline), **Timeline Cerita** (mengaktifkan tabel `timeline`/`TimelineEvent` untuk kronologi anti-plot-hole), dan **Saran Entitas** (`src/lib/orphanEntities.ts` — deteksi nama-diri yang sering muncul tapi belum di Codex, kebalikan Aho-Corasick; enrichment opsional via `enrichEntities`).

## Konvensi & jebakan
- **Extension TipTap dipin tepat ke `3.22.5`** di semua paket `@tiptap/*` — jaga tetap seragam saat upgrade, kalau tidak editor rusak.
- **Story Bible: `src/lib/storyBible.ts` adalah sumber tunggal** opsi (genre/tone/POV/pacing) sekaligus pemformatannya untuk AI. Nilai disimpan sebagai slug/JSON di Dexie, tapi jangan pernah kirim slug mentah ke AI — pakai `formatBibleBlock`/`formatBibleRuleLine` (slug→label, buang baris kosong, cap per-key via `BIBLE_AI_MAX_CHARS`). Jangan duplikasi tabel label di komponen.
- `experimentalDecorators` aktif dan `noEmit` diset (Vite/esbuild yang melakukan transpilasi sebenarnya); `tsc` hanya untuk type-check.
- Catatan `HMR`/`DISABLE_HMR` di `vite.config.ts` untuk lingkungan host Google AI Studio (proyek ini di-scaffold sebagai applet AI Studio); biarkan apa adanya.
- `firebase-applet-config.json` berisi nilai placeholder — sinkronisasi Firebase bersifat opt-in dan config asli berasal dari pengguna, bukan file ini.
- Ini **aplikasi pribadi, satu pengguna**; sesuai keputusan pemilik, pengerasan keamanan proxy (auth, rate limiting, base URL Ollama yang dikontrol klien / permukaan SSRF di `server.ts`) sengaja di luar cakupan kecuali diangkat secara eksplisit.
- **Dua jenis sesi asisten berbagi tabel `chatSessions`.** Studio Asisten (`AIAssistantPanel`, workspace penuh) dan Scribble (`ScribbleAssistantPanel`, panel inline samping editor/codex) sama-sama menulis ke `chatSessions`, dibedakan oleh field `kind: 'studio' | 'scribble'`. Saat membuat sesi baru **wajib set `kind`**, dan daftar riwayat Studio harus memfilter `kind !== 'scribble'` (lihat query di `AIAssistantPanel`) agar sesi Scribble tak mencemari. Sesi lama tanpa `kind` di-backfill di migrasi v18.
- **Cap lore di cache kini tunable & terpusat.** `getMaxCachedLoreChars()` di `src/lib/aiTuning.ts` (baca `ai_max_cached_lore_chars` localStorage, default 50k, clamp 10k–100k) adalah sumber tunggal, dipakai `buildCachedContextBlock` di `src/services/ai/index.ts`. Worker (`contextWorker.ts`) **tak punya localStorage** → nilai diteruskan lewat payload `PREVIEW_CONTEXT_TOKENS` dari `previewContextTokens` (`contextEngine.ts`, main thread), bukan dibaca ulang. Bila menambah pemakaian cap di worker lain, teruskan via payload — jangan hardcode lagi.

## Audit kualitas kode
`RENCANA-AUDIT-KODE.md` (root) adalah tracker audit bertahap: 12 area dengan prioritas, status per-item (✅/🔄/⬜), dan temuan. Item berdampak-tinggi sudah diperbaiki (P0 jantung AI, data-loss autosave, body-limit server, backup chatSessions, ketahanan DB/worker, dll). Sisa item bersifat cosmetic/opt-in/refactor besar. Cek file itu sebelum mengerjakan ulang area yang sudah diaudit, dan perbarui statusnya bila menyentuh temuan terkait.

## Optimasi penggunaan AI
`RENCANA-OPTIMASI-AI.md` (root) adalah tracker optimasi token/biaya AI (status per-item ✅/🔄/⬜): **semua item actionable selesai** — prompt caching trio, plafon `max_tokens` per-aksi, routing model per-tugas, bersih payload Story Bible, cache riwayat chat Claude (#4) & OpenRouter (#P2), debounce/dedup auto-summarizer & rewrite (#6), KB dibagi lintas-aksi (#9), tier cache Bible/Codex (#P3), akurasi estimasi token (#P4), plus tiga tunable di Settings → "Optimasi AI Lanjutan": cap lore cache (#5), override model ringan (#7), dan TTL cache Claude 5m/1j (#P5, `getClaudeCacheTtl` di `aiTuning.ts`, dipakai 3 titik cache_control Claude di `proxy.ts`). Cek file itu sebelum menyentuh jalur AI terkait token/caching/model.

- **Knowledge base statis diteruskan TERPISAH lewat `cachedContext: string[]` (AIRenderParams), bukan digabung ke `systemInstruction`** (#9/#P3). Cache provider prefix-based, jadi KB (output `buildCachedContextSegments`, segmen `[Story Bible, Codex+graph]` identik lintas-aksi) ditaruh sebagai blok system PERTAMA di depan instruksi, **tiap segmen dengan `cache_control` sendiri** → rewrite/chat/consistency berbagi cache KB, dan edit satu entri Codex tak membatalkan prefix Bible (tier stabil→volatil). **Jangan gabungkan KB kembali ke `systemInstruction` di caching mode**, dan jaga tiap segmen byte-identik antar-aksi (mis. timeline consistency sengaja di blok instruksi, bukan di `cachedContext`). Perakitan per-provider ada di `proxy.ts` (Claude blok array multi-breakpoint, OpenRouter multipart + cache riwayat #P2, Google string KB-first).
