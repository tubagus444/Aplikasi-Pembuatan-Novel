# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Struktur dokumentasi.** File ini = **inti + aturan lintas-fitur + indeks**. Detail per-fitur & jebakan spesifik dipecah ke `.claude/rules/*.md`, yang **dimuat otomatis saat kamu menyentuh file yang cocok `paths`-nya** (hemat token per sesi, pemicu andal). Lihat tabel **Peta Rules & Jebakan** di bawah. Tracker berumur-panjang tetap di root: `RENCANA-AUDIT-KODE.md`, `RENCANA-OPTIMASI-AI.md`, `RENCANA-FITUR-WORLDBUILDING.md`.

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
- Test diletakkan berdampingan sebagai `*.test.ts` di sebelah unit yang diuji — mayoritas di `src/lib/` (logika murni). Jalankan `ls src/lib/*.test.ts` untuk daftar terbaru daripada mengandalkan enumerasi.
- **`npm run dev` TIDAK menjalankan `vite` langsung** — ia menjalankan `server.ts`, yang memasang Vite sebagai middleware sehingga proxy API dan SPA berbagi port 3000. Mengubah frontend saja? Tetap lewat `npm run dev`.

## Alias import (gampang keliru)

`@` dipetakan ke **root repository** (`vite.config.ts` dan `paths` di `tsconfig.json`), jadi import sumber ditulis `@/src/db`, `@/src/services/ai`, `@/src/lib/utils` — **bukan** `@/db`. Pertahankan prefix ini saat menambah import.

## Arsitektur

### Data & state
- **Penyimpanan:** Dexie (`src/db.ts`), nama DB `AetherScribeDB`, saat ini **skema versi 32**. Skema bersifat append-only — untuk mengubah tabel, tambahkan blok `this.version(N).stores({...})` baru dengan migrasi `.upgrade()`; **jangan** mengedit versi yang sudah ada. Tabel: projects, chapters, codex, bible, aiActions, snapshots, timeline, relationships, errors, backups, chatSessions, embeddings, aiUsageLogs, codexCategories, sceneEmbeddings, plotPromises, glossary, maps, mapMarkers.
- **State:** React Context (`src/contexts/`: Project, Navigation, UI, EditorPanel) + **Dexie live query** (`dexie-react-hooks` `useLiveQuery`, dibungkus di `src/hooks/useOptimizedLiveQuery.ts` / `useProjectData.ts`). Tidak ada Redux/Zustand.
- **Routing tampilan** berupa string `viewMode` di `NavigationContext`. `src/components/layout/MainView.tsx` berpindah panel berdasarkan nilai itu; semua panel di-`React.lazy` kecuali editor. Editor di-mount **hanya** saat `viewMode === 'write'` (disengaja, untuk menghemat RAM) dan di-key dengan `activeChapterId`.
- Susunan provider tetap di `src/main.tsx` (Project → Navigation → UI → Toast → Backup → ErrorBoundary). `oramaSync.setupHooks()` serta handler global `error`/`unhandledrejection` juga dipasang di sana.

### Alur AI (inti aplikasi) — detail di `.claude/rules/ai.md`
Kode fitur tidak pernah memanggil provider secara langsung: `fitur → src/services/ai/index.ts` (facade) `→ callAI()` (circuit breaker + backoff + fallback) `→ callProxy()` (`proxy.ts`) `→ POST /api/ai/proxy` (`server.ts`) `→ provider` (Gemini/Claude/Groq/OpenRouter/Hugging Face/Ollama). **Kunci BYOK ada di sisi klien.** Dua mode injeksi konteks (caching vs RAG legacy), knowledge base statis lewat `cachedContext` terpisah, cap lore tunable, dan sesi asisten (`chatSessions.kind`) — semuanya dirinci di rule `ai.md`.

### Komputasi berat berjalan di Web Worker (jangan di main thread)
- `src/services/contextWorker.ts` (dikendalikan `src/services/contextEngine.ts`): mesin konteks hibrida — pencocokan nama/alias eksak **Aho-Corasick** (`src/lib/ahoCorasick.ts`), **embedding semantik lokal** via `@xenova/transformers` (`Xenova/all-MiniLM-L6-v2`, di-cache di tabel `embeddings`), dan **penghitungan token** via `js-tiktoken`. Komunikasi request/id dengan timeout 30 detik; progres indexing disiarkan sebagai window event `semantic-indexing-progress`.
- `src/services/rag/oramaWorker.ts` + `oramaStore.ts` + `oramaSync.ts`: pencarian leksikal **BM25 Orama** sebagai fallback RAG, dijaga sinkron dengan Dexie via hooks.
- `src/workers/tokenWorker.ts`: penghitungan token untuk meter konteks live.

### Editor & daemon latar belakang
- Editor: TipTap 3 (`src/features/editor/`) — detail extension & konsistensi inline di `.claude/rules/consistency.md`.
- Daemon dari `src/App.tsx`: `useAutoBackup` (backup gzip → `.claude/rules/backup.md`), `useAutoSummarizer` (ringkasan AI per-bab), `cleanupAILogs()` + pengecekan kuota penyimpanan saat mount.

### Organisasi kode
Berbasis fitur di bawah `src/features/{assistant,chapters,codex,codex-workshop,consistency,editor,lore,search,timeline}` (masing-masing `components/` + `hooks/`); UI lintas-fitur di `src/components/{layout,panels,modals,common}`; logika murni & algoritma di `src/lib/`; integrasi/service di `src/services/`. Fitur di-route lewat `viewMode` di `MainView.tsx` — lihat **Peta Rules & Jebakan** untuk peta fitur→rule.

Fitur ringan yang tetap dijelaskan di sini (tak punya rule sendiri):
- **Dashboard** (`viewMode 'dashboard'`, `DashboardPanel.tsx`) — statistik novel: jumlah kata/bab, kuota penyimpanan, agregat `aiUsageLogs` per-`actionType`, dan **progres menulis harian** via `src/hooks/useDailyProgress.ts` (`src/lib/dailyProgress.ts` + tes, dipakai juga `WritingStats.tsx`).
- **Pencarian Semantik** (`viewMode 'search'`, `SemanticSearchPanel.tsx`) — cari lintas-bab berdasarkan makna. Indeks scene di tabel `sceneEmbeddings` lewat `contextEngine` (`indexManuscript`/`searchManuscript`/`countIndexedScenes`/`clearManuscriptIndex`); hasil melompat ke bab via `jumpToText`.
- **Ekspor manuskrip** (`ExportManager.tsx`) — format `md`/`pdf`/`docx`/`epub`. EPUB dirakit `buildEpub` (`src/lib/epub.ts`) — perakit EPUB 2 murni-string di atas ZIP writer lokal (`src/lib/zip.ts`); konversi HTML bab→XHTML well-formed dilakukan pemanggil di browser dan dikirim lewat `EpubChapter.xhtmlBody`.

## Konvensi lintas-fitur (berlaku luas — JANGAN sebar ke rule)

- **Meta-pola "field inert menumpang objek yang ada".** Banyak fitur worldbuilding menambah field opsional TAK-diindeks ke `CodexEntry`/`Chapter`/`Project` (bukan tabel/FK baru) via blok `version(N)` no-op append-only → **backup/impor/`deleteProject` tak berubah**. Pola: `hidden`/`secret`/`namePalette`/`customFields`/`worldStatus`/`todo`/`tension`/`act`/`factionTag`/`factionBoard`/`calendar`/`startDate`. Ikuti pola ini sebelum membuat tabel baru.
- **⚠️ Tabel/FK project-scoped BARU wajib sinkron di 3 tempat:** `src/lib/importRemap.ts` (remap FK), `ProjectContext.deleteProject` (hapus), `backupService` (collect/restore/project). Lupa satu = impor salah-tunjuk / hapus proyek meninggalkan yatim. Contoh terbaru = `maps`/`mapMarkers` (Atlas Dunia, v32; lihat `.claude/rules/atlas.md`). Detail di `.claude/rules/backup.md`.
- **KB statis lewat `cachedContext` TERPISAH, jangan gabung ke `systemInstruction`** (caching mode) — memecah cache prompt provider. Detail & alasan di `.claude/rules/ai.md`.
- **Sumber tunggal (jangan duplikasi tabel/daftar di komponen):** Story Bible = `src/lib/storyBible.ts`, kategori Codex = `src/lib/codexCategories.ts`, tipe relasi = `src/features/codex/relationshipTypes.ts`, `buildPresenceIndex` = `src/lib/continuity.ts` (mesin pencocokan bersama, jangan scan Aho-Corasick ganda).
- **Extension TipTap dipin tepat ke `3.22.5`** di semua paket `@tiptap/*` — kalau tidak seragam, editor rusak.
- `experimentalDecorators` aktif dan `noEmit` diset (Vite/esbuild yang mentranspilasi; `tsc` hanya type-check). Catatan `HMR`/`DISABLE_HMR` di `vite.config.ts` untuk host Google AI Studio — biarkan apa adanya.
- **⚠️ Jebakan `.gitignore` tak ter-anchor menyembunyikan kode dari Tailwind v4.** Tailwind v4 auto content detection **menghormati `.gitignore`**. Pola tak ter-anchor (mis. dulu `lore/`) cocok dengan **semua** direktori bernama itu di level mana pun — termasuk `src/features/lore` (kode aplikasi) — sehingga isinya **tak di-scan** → utilitas yang UNIK di komponen sana tak ter-generate → layout runtuh, **hanya di mode dev**. Gejala menyesatkan: kelas yang juga dipakai file lain tetap muncul, yang unik hilang; hard-refresh tak menolong. **Build produksi AMAN.** **Sudah diperbaiki** (folder privat di-rename `lore/`→`bahan-dunia/` + di-anchor `/bahan-dunia/`). **Aturan:** anchor pola direktori privat ke root & beri nama yang tak menabrak folder kode; bila perlu memaksa satu file ter-ignore tetap di-scan, `@source "path/eksak"` (bukan glob).
- Ini **aplikasi pribadi, satu pengguna**; sesuai keputusan pemilik, pengerasan keamanan proxy (auth, rate limiting, base URL Ollama yang dikontrol klien / SSRF di `server.ts`) sengaja **di luar cakupan** kecuali diangkat eksplisit.

## Peta Rules & Jebakan (indeks)

Rule di `.claude/rules/` dimuat otomatis saat kamu menyentuh file yang cocok. Kolom **⚠️** menandai jebakan mahal "jangan diulang".

| Rule file | Area / `viewMode` | Pemicu `paths` (inti) | ⚠️ |
|---|---|---|---|
| `ai.md` | Alur AI, konteks, caching, sesi asisten | `src/services/ai/**`, `contextWorker/Engine`, `aiPrompts.ts`, `aiTuning.ts`, `features/assistant/**` | Jangan gabung KB ke `systemInstruction` |
| `lore.md` | Story Bible, Relasi (`relationships`), Faksi (`factions`) | `src/features/lore/**`, `storyBible.ts`, `factions.ts`, `relationshipTypes.ts` | **Warna edge React Flow lewat `style` inline, bukan atribut `stroke`** |
| `codex.md` | Codex, kategori, field #17, hidden/secret, Bengkel Nama, Kelengkapan (`completeness`), Graf Lore (`graph`), Lokakarya (`workshop`) | `src/features/codex/**`, `codex-workshop/**`, `codex*.ts`, `nameForge.ts`, `loreGraph.ts`, `worldCompleteness.ts` | **force-graph hit-test: klik/hover manual via koordinat, JANGAN pakai API bawaan** |
| `consistency.md` | Kontinuitas, Lensa Karakter (`arc`), Konsistensi inline, Janji Plot (`promises`), Glosarium (`glossary`), Heatmap (`heatmap`), Prosa (`prose`), editor | `src/features/consistency/**`, `features/editor/**`, `continuity.ts`, `inlineConsistency.ts`, `plotPromises.ts`, `glossary.ts`, `pacingHeatmap.ts` | `buildPresenceIndex` sekali scan; TipTap pin 3.22.5 |
| `timeline.md` | Timeline & Kalender Dunia (`worldcalendar`) | `src/features/timeline/**`, `worldCalendar.ts` | Tautan event pakai ULANG `characterIds`, bukan FK baru |
| `atlas.md` | Atlas Dunia (`atlas`) — peta interaktif Leaflet | `src/features/atlas/**`, `mapGeometry.ts`, `atlasColors.ts`, `blobCodec.ts` | Leaflet MURNI + hit-test bawaan (beda LoreGraph); query penanda kunci ke `selectedMapId`; 2 tabel baru sinkron 3 tempat |
| `backup.md` | Pencadangan, impor/ekspor per-novel, remap FK | `backupService.ts`, `driveBackupService.ts`, `importRemap.ts`, `backupRetention.ts`, `ProjectContext.tsx` | Sinkron 3 tempat saat tambah tabel/FK; gzip via magic bytes |
| `settings.md` | Panel Pengaturan | `src/components/panels/settings/**`, `SettingsPanel.tsx` | Tulis localStorage AI HANYA lewat `useAISettings` |

## Tracker (cek sebelum mengerjakan ulang area terkait)

- **`RENCANA-AUDIT-KODE.md`** — audit kualitas kode bertahap: 12 area, status per-item (✅/🔄/⬜), temuan. Item berdampak-tinggi (P0 jantung AI, data-loss autosave, body-limit server, backup chatSessions, ketahanan DB/worker) sudah diperbaiki; sisa cosmetic/opt-in/refactor. Cek sebelum mengerjakan ulang area yang sudah diaudit; perbarui statusnya bila menyentuh temuan.
- **`RENCANA-OPTIMASI-AI.md`** — tracker optimasi token/biaya AI (semua item actionable selesai). Cek sebelum menyentuh jalur AI terkait token/caching/model. (Ringkasan di `.claude/rules/ai.md`.)
- **`RENCANA-FITUR-WORLDBUILDING.md`** — desain fitur worldbuilding (#1 Kebenaran Tersembunyi, #2 payoff, #3 Bengkel Nama, #4 Kalender, #8 Glosarium, #9 Graf Lore, #11 Kelengkapan, #14 Graf visual, #15 Faksi, #16 Heatmap, #17 field kategori).
- **`RENCANA-AUDIT-FABLE.md`** — backlog AKTIF hasil audit read-only Fable 5 (3 batch: alur AI/context/continuity; integritas data/editor/UX; ekspor/worldbuilding/RAG). Temuan BELUM diverifikasi ulang & belum dikerjakan — validasi tiap item sebelum eksekusi. Beda dari `RENCANA-AUDIT-KODE.md` (sudah selesai). Prioritas teratas: flush autosave `pagehide`, lore terpotong senyap + formatter KB, yield ekspor.
