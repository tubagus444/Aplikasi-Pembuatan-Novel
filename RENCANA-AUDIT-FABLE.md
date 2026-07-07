# Rencana Audit Lanjutan (Fable 5) — AetherScribe

> **Backlog AKTIF.** Hasil audit read-only oleh model Fable 5 (2 batch), diverifikasi
> langsung ke kode. Berbeda dari `RENCANA-AUDIT-KODE.md` yang berisi keputusan **sudah selesai** —
> dokumen ini adalah temuan **baru yang belum dikerjakan**. Semua item BELUM diverifikasi ulang
> oleh pemilik; validasi tiap temuan sebelum eksekusi (bisa saja ada false-positive).
>
> Legenda: Dampak **T**inggi/**S**edang/**R**endah · Effort **S**/**M**/**L**.
> Kategori: `debt` / `risiko` / `perdalam` (fitur ada tapi setengah matang) / `fitur` (baru).

## Batasan (di luar cakupan — jangan disarankan)
Menambah DB backend, multi-user/kolaborasi, pengerasan keamanan proxy — **out of scope by design**
(aplikasi pribadi satu-pengguna, per `CLAUDE.md`).

---

## BATCH 1 — Alur AI, context engine, continuity, arsitektur umum

### 1a. Arsitektur & Tech Debt
| Area | Temuan | Kat | Dampak | Effort | File |
|---|---|---|---|---|---|
| ✅ Jantung AI tanpa test | **SELESAI** — logika inti diekstrak ke `circuitBreaker.ts` (kelas, jam disuntik) + `resilience.ts` (`computeBackoffDelay`/`shouldAttemptFallback`/`selectFallbackProviders`/`rewriteDedupKey`/`parseJsonArray`); **24 tes** (open/half-open/reset deterministik, backoff, fallback, dedup, parsing). `index.ts` memakainya (behavior-preserving) & menyusut | debt | T | M | `circuitBreaker.ts`, `resilience.ts`, `index.ts` |
| ✅ Duplikasi formatter KB → meter token bohong | **SELESAI** — formatter dipusatkan ke `src/lib/loreFormat.ts` (`formatCodexLoreLine`/`buildCodexLoreString`/`buildRelationshipGraph`, +13 tes); `buildCachedContextSegments` & worker `PREVIEW_CONTEXT_TOKENS` sama-sama memanggilnya. Meter kini hitung fields+secret+graf (relasi dimuat di `previewContextTokens`) | debt | T | S | `loreFormat.ts`, `index.ts`, `contextWorker.ts`, `contextEngine.ts` |
| ✅ Boilerplate facade 5x | **SELESAI** — 7 fungsi (`processRewrite`, `processChat`, `checkConsistency`, dll) disatukan menggunakan helper `executeAIAction` dan `resolveContextBuilder`. Menghapus duplikasi logika setup `AbortController`, `getSettings`, `isCacheSupported`, penangkapan `Error`, dan penyusunan KB. | debt | S | M | `src/services/ai/index.ts:417-930` |
| ✅ Doc drift | **SELESAI** — Rule `ai.md` diperbarui agar menyertakan `OPENAI_API_KEY` di variabel `.env`; `PROVIDER_CONTEXT_WINDOW` di `index.ts` diperbarui ke nilai baru (google: 2M, groq/hf: 128k) menyesuaikan kapabilitas model saat ini | debt | S | S | `.claude/rules/ai.md`, `src/services/ai/index.ts:75` |
| ✅ Dua jalur pencocokan entitas | **SELESAI** — `extractCodexAcKeywords<T>()` (`src/lib/codexKeywords.ts`, +7 tes) menerapkan filter konsisten (`trim` + `length >= 2` + skip tanpa id); diterapkan di `continuity.ts`, `loreGraph.ts`, dan `contextWorker.ts`. Worker dulu TIDAK punya filter panjang → hitungan bisa berbeda dari panel analitik; kini identik. `plotPromises.ts` tetap terpisah (keyword dari janji, bukan codex) | debt | S | M | `codexKeywords.ts`, `continuity.ts`, `loreGraph.ts`, `contextWorker.ts` |

### 1b. Kelemahan / Risiko
| Area | Temuan | Kat | Dampak | Effort | File |
|---|---|---|---|---|---|
| ✅ Lore terpotong senyap (caching) | **SELESAI** — `buildCodexLoreString` memotong pada BATAS ENTRI (blok `[RAHASIA…]` tak pernah separuh, entri huruf-akhir di-drop utuh) + `console.warn` "N/M entri termuat" saat cap tercapai (arahkan naikkan cap di Pengaturan) | risiko | T | S–M | `loreFormat.ts`, `index.ts` |
| ✅ Presence scan di main thread | **SELESAI** — scan dipindah ke worker (`buildPresenceIndexAsync` → pesan `BUILD_PRESENCE_INDEX`, fungsi murni yang SAMA). 4 panel diperbarui: Kontinuitas & Lensa `await` di handler scan; Janji Plot & Atlas via hook `usePresenceIndex`. Derivasi terima `options.index` (fallback sinkron utk tes) | risiko | T | M | `contextWorker.ts`, `contextEngine.ts`, `usePresenceIndex.ts`, `continuity.ts`, `plotPromises.ts` |
| ✅ Timeout worker 30 dtk flat | **SELESAI** — timeout jadi IDLE-based (30 dtk tanpa aktivitas), di-reset tiap pesan `PROGRESS` (unduh model/embedding mengabari kemajuan) → query yang antre di belakang indexing perdana tak gagal spurious; worker benar-benar hang tetap timeout | risiko | S | S | `contextEngine.ts` |
| ✅ Cache konsistensi membengkak localStorage | **SELESAI** — pagar kuota GLOBAL: cap LRU `MAX_CACHED_CHAPTERS=40` (`touchLru`, murni + 6 tes) + degradasi kuota (buang bab tertua lalu retry `setItem`) di `persistChapter` → tak lagi menjatuhkan `setItem` fitur lain | risiko | S | S | `useEditorAIConsistency.ts`, `lruList.ts` |
| ✅ postMessage payload penuh berulang | **SELESAI** — `previewContextTokens` tidak lagi melempar array (kloning) `allCodex` via message. Cukup mengirim `projectId`, lalu worker mengambil data langsung dari IndexedDB. *Hash string* `getAcInstance` juga dioptimasi tanpa `JSON.stringify` untuk menghindari *GC pause* | risiko | R | M | `contextEngine.ts:98`, `contextWorker.ts` |

### 1c. Fitur yang Perlu Diperdalam
| Area | Ide | Dampak | Effort |
|---|---|---|---|
| Peta Kontinuitas: triase temuan | Dismiss/acknowledge persist agar daftar tak bising di 100+ bab | T | S–M |
| Pencarian Semantik: index otomatis inkremental | Picu re-index (debounced) saat bab disimpan — `contentHash` sudah ada | S | S |
| Timeline × Kalender Dunia | Pakai `worldCalendar.ts` deteksi konflik kronologi tanggal = plot-hole detector nol-token | S | M |
| Glosarium: cakupan typo | Mode `strictMatch` opt-in per-entri untuk istilah multi-kata/huruf-kecil | R | M |
| Janji Plot: saran kata kunci | Tawarkan kandidat keyword dari token kapital/glosarium di seleksi | R | S |

### 1d. Fitur Baru
| Area | Ide | Dampak | Effort |
|---|---|---|---|
| Diff revisi antar-snapshot | Panel diff kata-level snapshot↔draf — jaring pengaman revisi, nol token. Tabel `snapshots` sudah ada | T | M |
| Lensa Suara Dialog | Metrik ujaran per-karakter deterministik → deteksi "semua terdengar sama" | S | L |
| Audit konsistensi batch | Antrian N bab beruntun memanfaatkan cache KB lintas-bab | S | M |
| Papan status dunia per bab | Ledger keadaan (hidup/di mana/pegang apa) divalidasi deterministik — lanjutan Janji Plot | S | L |
| Ekspor laporan lore | Codex+relasi+glosarium+timeline → satu markdown "seri bible" | R | S |

---

## BATCH 2 — Integritas data, editor & daemon, UX/UI

> Verifikasi positif: sinkron 3-tempat untuk **semua** tabel v32 KONSISTEN
> (`maps`/`mapMarkers`/`plotPromises`/`glossary`/`codexCategories` lengkap di
> `importRemap.ts`, `deleteProject`, `backupService`). Tidak ada FK terlewat.

### #1 — Integritas data & daya-tahan penyimpanan
| Area | Temuan | Kat | Dampak | Effort | File |
|---|---|---|---|---|---|
| 🔄 Backup besar di main thread | **SEBAGIAN** — jalur rolling internal (hot path 30-mnt) dulu men-stringify data besar **2×/siklus** (checksum + payload); kini **1×** via `assembleBackupJson` (sisip `dataString`, murni + 5 tes) → puncak string & jank per-siklus turun. Berlaku juga pra-restore. **DITUNDA (sadar, risiko tinggi ke jalur safety-critical):** offload serialize/gzip ke worker & checksum lazy di `collectAllData` (masih 1× stringify full-data+base64/siklus utk folder/Drive). Streaming serializer = rewrite besar, di luar cakupan utk app 1-pengguna | risiko | T | M–L | `backupService.ts`, `backupEnvelope.ts` |
| ✅ Kegagalan kuota `backups` | **SELESAI** — `addBackupResilient` (degradasi): saat `add` lempar error kuota → buang cadangan 'auto' tertua lalu retry, berulang; SELALU sisakan semua 'pre-restore' (undo) + 1 'auto' terbaru. Pilihan korban murni & teruji (`selectBackupToEvict`, +5 tes). Berlaku juga jalur `pre-restore`. Sisa (out): tabel `snapshots` (beda tabel) tak dirotasi — perlu kebijakan retensi sendiri | risiko | T | S–M | `backupService.ts`, `backupRetention.ts` |
| ✅ 22 blok versi duplikat | **SELESAI** — konstanta berjenjang (`CORE_STORES` → `STORES_V14` → `STORES_V16` → … → `STORES_V32`) + spread; v11–v13 tetap inline (unik); v14–v32 merujuk konstanta. 22 blok × 12 baris → ~280 baris lebih ringkas; rantai versi lengkap dipertahankan, semua komentar historis diringkas. 426 tes lolos, `tsc --noEmit` bersih | debt | S | S | `src/db.ts:58-280` |
| Upgrade v10/v18 muat-semua | `.upgrade()` pakai `toArray()` seluruh tabel dalam transaksi — jebakan bila migrasi berikutnya sentuh tabel besar. Perlu konvensi "migrasi streaming" di rule | perdalam | S | S | `src/db.ts:37-56,179-191` |
| Restore lintas-versi tanpa validasi | `restoreData` terima backup lama tanpa cek bentuk per-field selain `data.projects` → file terpotong tetap `bulkAdd` mentah. Validator ringan per-tabel | fitur | S | M | `backupService.ts:310-390` |

### #2 — Editor & daemon latar belakang
| Area | Temuan | Kat | Dampak | Effort | File |
|---|---|---|---|---|---|
| ✅ Tak ada flush saat tab ditutup | **SELESAI** — listener `pagehide` + `visibilitychange`→hidden di `useGlobalEvents` (level App, selalu mount) memanggil `flushActiveEditor()` via bridge; no-op bila editor tak ter-mount | risiko | T | S | `useGlobalEvents.ts`, `editorBridge.ts` |
| ✅ Reload paksa `versionchange` | **SELESAI** — `db.on('versionchange')` kini `flushActiveEditor()` (koneksi masih terbuka) → `.finally(closeAndReload)` sebelum `close()`+`reload()` | risiko | T | S | `db.ts:539-551` |
| 🔶 tokenWorker langgar aturan C11 | **re-dispatch DICABUT** — `onerror` kini `console.error` + reset status (tak lagi `ErrorEvent('error')` ke window → tak crash / tulis-ganda). Sisa: worker per-mount tanpa singleton (perdalam, dibiarkan) | risiko | S | S | `useTokenCounter.ts` |
| ✅ Timer auto-backup reset tiap siklus | **SELESAI** — interval di `useAutoBackup.tsx` sudah dibungkus ref, tak lagi bongkar-pasang tiap siklus; perubahan hanya dipicu oleh `storage` event `backup_interval` | debt | S | S | `useAutoBackup.tsx:251-283` |
| ✅ Celah siklus hidup worker | **SELESAI** — menambahkan `onmessageerror` dan logika *backoff* (jeda 2 detik `lastCrashTime`) saat *crash* inisialisasi di `contextEngine.ts` dan `oramaSync.ts` agar pemanggil mendapat pesan *error* dan *worker* tidak masuk ke dalam *crash-loop* | perdalam | S | S | `contextEngine.ts`, `rag/oramaSync.ts` |

### #4 — Kualitas UX/UI & error-handling
| Area | Temuan | Kat | Dampak | Effort | File |
|---|---|---|---|---|---|
| ✅ ErrorBoundary global terlalu agresif | **SELESAI** — listener `window error`/`unhandledrejection` dicabut dari root boundary (kini hanya tangkap error RENDER React). Tambah `PanelErrorBoundary` (fallback ringkas, pulih saat `viewMode` ganti) membungkus konten `MainView` → crash satu panel tak lagi membongkar Sidebar/Header | risiko | T | M | `ErrorBoundary.tsx`, `PanelErrorBoundary.tsx`, `MainView.tsx` |
| ✅ Peringatan DB tak sampai ke pengguna | **SELESAI** — `useDbIssueListener` (di App) dengarkan `aetherscribe-db-issue` → toast (`error`=persisten + "Muat Ulang", `warning`=biasa). Isu pra-mount di-buffer di `db.ts` (`drainPendingDbIssues`) & dikuras saat mount; `ToastContainer` dipindah ke `main.tsx` agar tampil walau di layar loading | risiko | T | S | `useDbIssueListener.ts`, `db.ts`, `main.tsx` |
| ✅ ErrorService di jalur error global | **SELESAI** — `ErrorService.log` kini **console dulu** (tak bergantung DB) lalu tulis `db.errors` dgn **timeout 3 dtk** (`withTimeout`) → IndexedDB yang MENGGANTUNG (terblokir) tak lagi membocorkan promise di handler global fire-and-forget; kegagalan diabaikan (sudah di console) | perdalam | S | S | `errorService.ts` |
| ✅ Bahasa Inggris bocor di kesan pertama | **SELESAI** — string `"Initialising AetherScribe…"` (App.tsx) → `"Memulai AetherScribe…"`; seed data `"Untitled Novel"`/`"Start your masterpiece here."`/`"Chapter 1"`/`"Once upon a time…"`/`"Tone"`/`"Dark and atmospheric"` (db.ts) → `"Novel Tanpa Judul"`/`"Mulailah mahakarya Anda di sini."`/`"Bab 1"`/`"Pada suatu hari…"`/`"Nada"`/`"Gelap dan atmosferik"`. Komentar helper juga diindonesiakan | debt | R | S | `App.tsx:75`, `db.ts:584-607` |
| ✅ Cache konsistensi tanpa pagar kuota global | **SELESAI** (sama dgn B1 1b di atas) — cap jumlah kunci lintas-bab via LRU + eviction saat `QuotaExceededError`; try/catch sudah ada, kini + strategi degradasi | perdalam | S | S | `useEditorAIConsistency.ts`, `lruList.ts` |

---

## BATCH 3 — Ekspor, worldbuilding runtime, RAG & asisten

> Verifikasi positif (SEHAT, jangan dianalisa ulang): `epub.ts`/`zip.ts`
> (mimetype STORED, escapeXml, XHTML via DOMParser, CRC32/offset benar);
> `mapGeometry.ts`/`blobCodec.ts` (murni, 16 tes, ray-casting benar);
> `pacingHeatmap.ts`/`proseAnalysis.ts` (deterministik, reuse `dialogueRatio`);
> ketahanan worker Orama (timeout 15dtk, reject pending+rebuild, retry+warn drift);
> boundary kata Aho-Corasick.

### A — Ekspor manuskrip
| Area | Temuan | Kat | Dampak | Effort | File |
|---|---|---|---|---|---|
| ✅ Ekspor besar beku UI | **SELESAI** — `handleExport` `await yieldToUI()` sebelum kerja berat (spinner sempat tampil); `exportPDF`/`exportDocx` async + yield tiap 8 bab (jsPDF/DOMParser tak lagi beku multi-detik) | risiko | T | S | `ExportManager.tsx` |
| ✅ DOCX ratakan struktur | **SELESAI** — `blockToParagraphs` rekursif: `<ul>` → bullet per-`<li>`, `<ol>` → nomor manual + indent per kedalaman (sub-list nested), `<blockquote>` → paragraf indent+miring. Tak lagi menggabung `<li>` jadi 1 paragraf | risiko | S | M | `ExportManager.tsx` |
| PDF Unicode | jsPDF font "times" = cp1252: kutip lengkung/em-dash/é aman, glyph di luar cp1252 garble. Aman untuk Indonesia (keputusan sadar), perdalam bila pakai glyph khusus dunia fiksi | perdalam | S | M | `ExportManager.tsx:121-192` |
| ✅ EPUB + gambar | **SELESAI** — memasang pelindung `doc.querySelectorAll('img').forEach(img => img.remove())` pada `htmlToXhtmlBody` sebelum membuat EPUB, sehingga gambar dinamis (yang tak ada di manifest) dibersihkan dan tak lagi membuat dokumen EPUB menjadi tidak valid (invalid EPUB) | risiko | R | S | `ExportManager.tsx`, `epub.ts` |

### B — Worldbuilding runtime
| Area | Temuan | Kat | Dampak | Effort | File |
|---|---|---|---|---|---|
| ✅ Duplikasi scan graf | **SELESAI** — diekstrak ke `scanMentions(entries)` (sumber tunggal, +4 tes); `buildLoreGraph` & `buildLoreGraphView` memakainya, tak ada lagi blok scan Aho-Corasick kembar. Behavior identik (21 tes graf lolos) | debt | S | S | `src/lib/loreGraph.ts` |
| Graf besar di main thread | `buildLoreGraphView` di main thread; codex ratusan entri → scan AC + d3-force janky. Verifikasi perlu debounce/worker bila codex >500 entri | perdalam | S | M | `loreGraph.ts`, `LoreGraphPanel.tsx` |
| Analitik "adegan per wilayah" | `pointInPolygon` sudah ada tapi belum dipakai — silangkan `PresenceIndex` × area faksi via centroid/pointInPolygon (layer `atlasAnalytics.ts` per arahan rules) | fitur | S | M | `mapGeometry.ts:79-96`, `.claude/rules/atlas.md` |
| Bias elipsis heatmap | Split kalimat `[.!?]+` hitung "..." sebagai pemecah → skor kalimat-pendek sedikit bias naik pada prosa ber-elipsis. Heuristik saran, dampak rendah | perdalam | R | S | `pacingHeatmap.ts:68` |

### C — Pencarian, RAG & sesi asisten
| Area | Temuan | Kat | Dampak | Effort | File |
|---|---|---|---|---|---|
| ✅ Polusi indeks Orama lintas-proyek | **SELESAI** — guard `entry.projectId === currentProjectId` di `oramaStore.indexEntry` → bulk-write codex proyek lain (impor/restore) tak lagi mencemari indeks proyek aktif | risiko | S | S | `oramaStore.ts` |
| ✅ Race init vs hook | **SELESAI** — init BUILD-then-SWAP: bangun indeks+`idMap` baru di variabel lokal lalu pasang atomik; token `initGen` membatalkan init lama saat di-supersede (ganti proyek). Hook selama init tak menyisip ke indeks setengah-jadi → tak ada dokumen duplikat/hantu | risiko | S | M | `oramaStore.ts` |
| Persist sesi asisten O(n²) | `onMessageAdded` tulis seluruh array messages tiap pesan → membengkak kumulatif pada sesi maraton. Race sempit saat ganti sesi (guard `isSubscribed` hanya tahan unmount) | perdalam | R | M | `useAssistantSession.ts:61-82` |
| Pencarian federated | `SemanticSearchPanel` (scene) & Orama BM25 (codex) terpisah; satu kotak → hasil bab + codex (skor dinormalkan), murah karena kedua mesin sudah ada | fitur | S | M | `SemanticSearchPanel.tsx`, `src/services/rag/*` |

---

## Prioritas Gabungan (rekomendasi urutan eksekusi)

1. ✅ **Flush autosave saat `pagehide` + sebelum reload `versionchange`** (B2 #2) — **SELESAI** (listener lifecycle di `useGlobalEvents` + flush di handler `versionchange`, keduanya via `flushActiveEditor()`).
2. ✅ **Perbaiki pemotongan lore senyap + satukan formatter KB** (B1 1b#1 + 1a#2) — **SELESAI** (sumber tunggal `src/lib/loreFormat.ts`, potong batas-entri + warn, meter hitung fields/secret/graf).
3. ✅ **Jinakkan ErrorBoundary global + cabut re-dispatch tokenWorker + listener `aetherscribe-db-issue`** (B2 #4 + #2) — **SELESAI** (root boundary hanya error render + `PanelErrorBoundary`; tokenWorker tak re-dispatch; `useDbIssueListener` → toast persisten).
4. ✅ **Amankan `buildPresenceIndex` untuk naskah raksasa** (B1 1b#2) — **SELESAI** (scan di worker via `buildPresenceIndexAsync`/`usePresenceIndex`; derivasi terima `options.index`).
5. ✅ **Yield/chunking ekspor + perbaiki DOCX ratakan list** (B3 A) — **SELESAI** (yield spinner + per-8-bab; DOCX `blockToParagraphs` rekursif ul/ol/blockquote).
6. ✅ **Guard filter projectId + race init Orama** (B3 C) — **SELESAI** (guard projectId di `indexEntry` + init build-then-swap dgn token generasi).
7. ✅ **Uji jantung AI** (B1 1a#1) — **SELESAI** (ekstrak `circuitBreaker.ts`/`resilience.ts` + 24 tes; `index.ts` behavior-preserving).
8. **Diet memori jalur backup penuh** (B2 #1) — sebelum ukuran naskah bikin siklus 30-menit jadi sumber jank/gagal.
