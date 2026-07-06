---
paths:
  - "src/features/consistency/**"
  - "src/features/editor/**"
  - "src/lib/continuity.ts"
  - "src/lib/characterArc.ts"
  - "src/lib/inlineConsistency.ts"
  - "src/lib/nameSpelling.ts"
  - "src/lib/glossary.ts"
  - "src/lib/plotPromises.ts"
  - "src/lib/proseAnalysis.ts"
  - "src/lib/pacingHeatmap.ts"
---

# Konsistensi, analitik nol-token & editor

Fitur di file ini deterministik/lokal (nol token) kecuali disebut AI. Banyak menumpang **`buildPresenceIndex`** — jangan scan Aho-Corasick ganda.

## Editor
TipTap 3 (`src/features/editor/`). Extension kustom di `extensions/`: `PassiveCodexHighlight` dan `SemanticHighlight` (menyorot entitas codex), `ConsistencyUnderline` (garis bawah konsistensi inline — lihat di bawah), `RevisionComment`, `SearchAndReplace`. Perilaku editor disusun dari `hooks/` (`useNovelEditor`, `useEditorAI`, `useEditorCodex`, `useEditorConsistency`, `useEditorAIConsistency`, `useEditorSave`, `useTypewriterMode`, …). **Extension TipTap dipin tepat ke `3.22.5`** di semua paket `@tiptap/*` — jaga seragam saat upgrade, kalau tidak editor rusak.

## `buildPresenceIndex` (`src/lib/continuity.ts`) = mesin pencocokan bersama
Untuk Peta Kontinuitas, Lensa Karakter, Janji Plot, Atlas — sekali scan Aho-Corasick atas nama+alias Codex menghasilkan `PresenceIndex` (per-bab `Map<entityId,count>` + per-entitas indeks bab & total). **Jangan scan ganda**; turunkan analitik baru dari sini. `buildPresenceIndex` tetap fungsi MURNI (dipakai langsung di tes), TAPI scan berat dijalankan **di worker** lewat `buildPresenceIndexAsync` (`contextEngine.ts` → pesan `BUILD_PRESENCE_INDEX` di `contextWorker.ts`, memanggil fungsi murni yang sama → tak ada divergensi). **Panel jangan panggil `buildPresenceIndex` sinkron di main thread** (jank multi-detik pada 100+ bab): panel on-demand (Kontinuitas, Lensa) `await buildPresenceIndexAsync` di handler scan; panel auto-recompute (Janji Plot, Atlas) pakai hook `usePresenceIndex(chapters, codex)`. Fungsi derivasi (`analyzeContinuity`/`analyzePromises`) menerima `options.index` pre-komputasi (fallback build sinkron bila kosong — jalur tes).

## Peta Kontinuitas (`viewMode 'continuity'`)
`src/lib/continuity.ts`, `ContinuityDashboard.tsx` — scan lintas-bab: `analyzeContinuity` membangun peta kemunculan via `buildPresenceIndex` lalu menurunkan 4 cek (karakter menghilang, entitas tak terpakai, relasi tanpa pertemuan, timeline tak cocok).

## Lensa Karakter (`viewMode 'arc'`)
`src/lib/characterArc.ts`, `CharacterArcPanel.tsx` — analitik per-karakter (porsi layar per bab, absensi terlama, bab ber-POV via `Chapter.pov`, ko-kemunculan). Memakai `PresenceIndex` yang **sama**.

## Analitik Prosa (`viewMode 'prose'`)
`src/lib/proseAnalysis.ts` + tes — metrik gaya deterministik atas teks polos (HTML sudah di-strip pemanggil): keterbacaan, kalimat panjang, verba pasif (heuristik "di-" khusus Indonesia dgn daftar pengecualian, bukan kamus), kata keterangan, plus lintas-bab `detectEchoWords`/`buildProseReport` (kata muleti + rasio dialog sbg sinyal pacing). Dipakai bersama oleh `ProseInsights.tsx` (per-bab, di editor) dan `ProseReportPanel.tsx` (laporan seluruh naskah). Tidak menumpang `PresenceIndex` — berbasis kata/kalimat.

## Konsistensi inline = satu extension `ConsistencyUnderline`, TIGA sumber temuan
Extension menggambar garis bawah dari (a) `getFlags()` → `Map<codexId, flag>` DETERMINISTIK (menggarisbawahi nama via `getCodexMatches`, amber), (b) `getQuoteFindings()` → kutipan verbatim AI (pencarian literal, ungu), dan (c) `getSpellingFindings()` → **Buku Gaya** (`src/lib/nameSpelling.ts` + tes): kata berhuruf kapital yang MIRIP tapi tak persis nama/alias Codex = kandidat typo (garis bawah merah putus-putus + saran), deterministik & nol token, diisi hook `useEditorSpelling` (toggle `spellcheck_names`, default ON). Dua hook mengisinya lewat ref di `useNovelEditor`: `useEditorConsistency` (deterministik, `flagCharactersForChapter`) dan `useEditorAIConsistency` (AI). Picu render lewat meta `forceUpdateConsistency`.

**Lapisan deterministik gratis** (`src/lib/inlineConsistency.ts` `flagCharactersForChapter`): aturan timeline "muncul sebelum diperkenalkan", garis bawah amber.

**Lapisan AI hemat-token & on-demand:** pemicu UTAMA = tombol "Cek Konsistensi" di `SelectionFloatingMenu` (`checkAtSelection`), mode otomatis-saat-idle hanya OPSIONAL (toggle `ai_inline_consistency`, default mati, tersimpan seketika + event `storage`). Hasil di-cache di **`Map` level-modul** (`chapterId → teks paragraf → temuan`, termasuk hasil kosong) → bertahan saat editor unmount (pindah panel) dan tak pernah diperiksa ulang bila teks tak berubah; garis bawah **selalu** disusun dari cache (`refresh()` membuang temuan paragraf yang sudah hilang/diedit). **Persisten lintas reload halaman:** cache memori di-mirror ke `localStorage` (kunci `ai_inline_consistency_cache_<chapterId>`) — hanya temuan **non-kosong yang masih ada di dokumen** yang ditulis (`persistChapter`, pruning otomatis, cap 300/bab); saat editor mount, `getChapterMap` **menghidrasi** dari localStorage sekali per tab tanpa menimpa hasil sesi. `checkConsistency` inline memakai `actionType: 'consistency-inline'` (abort key terpisah dari panel).

**Saat menambah aturan deterministik baru (jenis flag nama), perluas `flagCharactersForChapter` — jangan sentuh extension; sumber temuan yang menggarisbawahi kata NON-nama (spt Buku Gaya/Glosarium) tetap butuh sumber sendiri di extension.**

## Cek Konsistensi (panel, `checkConsistency`)
Audit satu bab vs Codex+Bible+relasi+timeline. **Timeline Cerita** mengaktifkan tabel `timeline`/`TimelineEvent` untuk kronologi anti-plot-hole.

## Janji Plot (Chekhov's Gun, `viewMode 'promises'`, `PlotPromisePanel.tsx`)
LEDGER yang dideklarasikan penulis, bukan deteksi otomatis. Alat TIDAK menebak mana yang janji — penulis mencatat janji (tabel Dexie `plotPromises`, v21), alat hanya MEMBUKUKAN kemunculannya. Logika turunan murni & teruji di `src/lib/plotPromises.ts` (`analyzePromises`): janji ber-`codexId` dilacak lewat **`buildPresenceIndex`**, janji ber-`keywords` (ramalan/misteri non-entitas) lewat satu scan Aho-Corasick. Status TURUNAN (dihitung, tak disimpan): `paid`/`abandoned` dari `PlotPromise.status`, `unseen` (tak ditemukan), `dormant` (open & kemunculan terakhir ≥ ambang bab dari akhir manuskrip = alarm), `active`. Tiga titik masuk berbagi `QuickPromiseModal`: seleksi editor → tombol "Catat Janji" di `SelectionFloatingMenu` (janji prosa → kata kunci, `plantedChapterId`=bab aktif), ikon crosshair di `CodexDetailModal` (terpaut `codexId`), dan panel langsung. **Tabel project-scoped dengan FK `codexId`/`plantedChapterId`/`payoffCodexId`** → sudah terdaftar di `importRemap.ts` & `ProjectContext.deleteProject` & `backupService` — jaga sinkron. **Dimensi payoff/reveal (#2):** `payoffCodexId?` (FK codex, TAK diindeks) menautkan janji ke entri Codex yang DIBAYARNYA (idealnya entri `hidden`) — beda dari `codexId` (= apa janji itu sendiri, dilacak di teks); `payoffCodexId` murni tautan agregasi. `analyzePayoffs` (di `plotPromises.ts` + tes) mengelompokkan kait per target & menurunkan `PayoffState` (`unplanted` = tak satu kait pun muncul = alarm, `thin` = di bawah `minSeenSetups` default 2, `planted`); seksi "Pembayaran" di `PlotPromisePanel`.

## Glosarium istilah in-world (#8, `viewMode 'glossary'`, `GlossaryPanel.tsx`)
Tabel Dexie `glossary` (v25, project-scoped, FK `projectId` saja) + sumber temuan BARU di `ConsistencyUnderline`. Generalisasi Buku Gaya ke istilah NON-nama (satuan/kalender/pangkat/idiom). Logika murni `src/lib/glossary.ts` (`findGlossaryIssues` + tes), dua jenis temuan: **variant** (ejaan salah yang DIDEKLARASIKAN penulis di `GlossaryEntry.variants` → dibendera, presisi mutlak) & **typo** (near-miss `term` baku via `editDistance`, DIBATASI ke token Kapital + term satu-kata untuk tekan false-positive). Underline **teal putus-putus** (`buildGlossaryDecorations`, beda dari merah Buku Gaya), diisi hook `useEditorGlossary` (live-query tabel `glossary`, toggle `glossary_check` di menu Tampilan, default ON) lewat ref `glossaryFindingsRef` di `useNovelEditor`. **Tabel project-scoped** → terdaftar di `importRemap.ts` (projectId-only), `backupService` (`BackupData.version` 6), `ProjectContext.deleteProject`. **Saat menambah aturan underline istilah NON-nama, perluas `findGlossaryIssues` — jangan sentuh Buku Gaya/`nameSpelling` (khusus nama Codex).**

## Heatmap tensi/pacing (#16, `viewMode 'heatmap'`, `PacingHeatmapPanel.tsx`)
Satu field inert `Chapter.tension?: TensionLevel` (1–5) + panel turunan, BUKAN tabel baru. Skema Dexie **v28** no-op append-only. **Filosofi "penulis mendeklarasikan, alat membukukan":** bila `tension` kosong ("Otomatis"), `effectiveTension` jatuh ke SARAN turunan `estimateTension` (skor 0–100 dari panjang kalimat + porsi kalimat pendek + rasio dialog + densitas tanda `!?…—`) yang **tak disimpan**. Logika murni `src/lib/pacingHeatmap.ts` (+16 tes): `estimateTension`/`scoreToLevel`/`levelToScore`/`effectiveTension`/`buildPacingReport` (kurva per-bab + deteksi pola **plateau** level≥4 & **valley** level≤2, run ≥3 bab via `collectRuns`). Mengimpor ulang `dialogueRatio` dari `proseAnalysis.ts` (jangan duplikasi). **Deterministik & nol token — `tension` TIDAK masuk KB AI maupun `codexToMarkdown`.** UI: kurva bar (tinggi=skor, warna=ramp biru→merah `LEVEL_STYLES`, bar bergaris = saran otomatis), kartu ringkasan, kartu pola makro (plateau/valley, deep-link editor), daftar bab dgn segmented control Auto/1–5 (persist langsung `db.chapters.update(id,{tension})`, `undefined` untuk Auto). Panel pakai `useLiveQuery` + `useMemo`. **Saat menambah metrik pacing/tensi baru, perluas `pacingHeatmap.ts` — jangan tambah tabel/FK.**
