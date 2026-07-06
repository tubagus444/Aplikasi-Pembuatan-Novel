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
| Jantung AI tanpa test | Circuit breaker, backoff, fallback, dedup, `parseJsonArray` inline di service 950-baris, nol test (34 test semua di `src/lib/`) | debt | T | M | `src/services/ai/index.ts` |
| Duplikasi formatter KB → meter token bohong | `buildCachedContextSegments` sertakan fields/secret/graph; preview worker hanya `[name] (cat): desc`. Dua "sumber tunggal" drift → meter konteks underestimate di mode caching | debt | T | S | `index.ts:114`, `contextWorker.ts:678` |
| Boilerplate facade 5× | `getSettings()` baca 14+ kunci localStorage tiap panggilan; pola useCaching→controller→register diulang ~30 baris × 5 | debt | S | M | `index.ts:417-930` |
| Doc drift | Rule sebut fallback tanpa `'openai'` (kode sudah tambah); `PROVIDER_CONTEXT_WINDOW` hardcode nilai lama | debt | S | S | `.claude/rules/ai.md`, `index.ts:72` |
| Dua jalur pencocokan entitas | `buildPresenceIndex` (main) & Aho-Corasick (worker) bangun automaton terpisah, filter beda → hitungan bisa beda antara Peta Kontinuitas vs highlight editor | debt | S | M | `continuity.ts:88`, `contextWorker.ts:72` |

### 1b. Kelemahan / Risiko
| Area | Temuan | Kat | Dampak | Effort | File |
|---|---|---|---|---|---|
| Lore terpotong senyap (caching) | `.substring(0, maxChars)` potong lore gabungan alfabetis → entri huruf akhir hilang total tanpa peringatan UI; bisa potong blok `[RAHASIA…]` di tengah. Cap 50k pasti tersentuh di codex besar | risiko | T | S–M | `index.ts:122` |
| Presence scan di main thread | `buildPresenceIndex` scan seluruh isi semua bab sinkron di main thread → jank multi-detik pada 100+ bab. Langgar aturan "berat = worker" | risiko | T | M | `continuity.ts:88` |
| Timeout worker 30 dtk flat | Query sah bisa gagal timeout saat antre di belakang embedding indexing perdana | risiko | S | S | `contextEngine.ts:54` |
| Cache konsistensi membengkak localStorage | Mirror per-bab × 100+ bab → risiko `QuotaExceededError` yang bisa matikan persist settings lain | risiko | S | S | `src/lib/inlineConsistency.ts` |
| postMessage payload penuh berulang | Seluruh array codex di-clone + `JSON.stringify` hash tiap pesan → O(n) per ketikan | risiko | R | M | `contextEngine.ts:98` |

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
| Backup besar di main thread | `collectAllData()` serialisasi SELURUH DB (semua proyek + snapshots + peta base64) jadi 1 string JSON di main thread; `restoreData` ulangi untuk snapshot pra-restore → puncak memori ±3× + jank tiap 30 mnt. Titik OOM/freeze pertama | risiko | T | M–L | `backupService.ts:77-100,330-334`, `useAutoBackup.tsx:86` |
| Kegagalan kuota `backups` | `saveToInternalDB` menambah backup SEBELUM rotasi → `add` gagal justru saat kuota hampir penuh; `snapshots` tak dirotasi di jalur ini. Tak ada degradasi (hapus tertua lalu retry) | risiko | T | S–M | `backupService.ts:169-208` |
| 22 blok versi duplikat | `db.ts` salin definisi stores identik v11–v31 (12+ blok no-op); satu typo indeks = rebuild indeks senyap. Ekstrak `BASE_STORES` + spread | debt | S | S | `src/db.ts:58-516` |
| Upgrade v10/v18 muat-semua | `.upgrade()` pakai `toArray()` seluruh tabel dalam transaksi — jebakan bila migrasi berikutnya sentuh tabel besar. Perlu konvensi "migrasi streaming" di rule | perdalam | S | S | `src/db.ts:37-56,179-191` |
| Restore lintas-versi tanpa validasi | `restoreData` terima backup lama tanpa cek bentuk per-field selain `data.projects` → file terpotong tetap `bulkAdd` mentah. Validator ringan per-tabel | fitur | S | M | `backupService.ts:310-390` |

### #2 — Editor & daemon latar belakang
| Area | Temuan | Kat | Dampak | Effort | File |
|---|---|---|---|---|---|
| Tak ada flush saat tab ditutup | NOL handler `beforeunload`/`pagehide`/`visibilitychange` di seluruh `src/`. Debounce 1,5 dtk → tutup tab ≤1,5 dtk setelah ketik = edit terakhir hilang. `htmlRef` sudah sinkron; tinggal 1 listener `pagehide` → `performSave` | risiko | T | S | `useEditorSave.ts:116-133` |
| Reload paksa `versionchange` | `db.on('versionchange')` langsung `location.reload()` tanpa flush editor → buang edit ter-debounce. Gabung dgn flush di atas (via `editorBridge`) | risiko | T | S | `db.ts:538-544` |
| tokenWorker langgar aturan C11 | `useTokenCounter` `onerror` re-dispatch `ErrorEvent('error')` ke window (anti-pola dilarang C11) → ErrorBoundary tampilkan crash penuh hanya karena worker token gagal + tulis ganda `db.errors`. Worker baru per mount tanpa singleton | risiko | S | S | `useTokenCounter.ts:11-15`, `contextEngine.ts:43-49` |
| Timer auto-backup reset tiap siklus | `runBackup` dependency `isBackingUp` (state) → efek `[runBackup]` bongkar-pasang `setInterval` tiap siklus; guard baca closure basi. Ganti ke ref | debt | S | S | `useAutoBackup.tsx:78-79,240-270` |
| Celah siklus hidup worker | Sudah benar (reject pending→terminate→lazy-recreate), tapi tanpa `onmessageerror` (pending menggantung sampai timeout) & tanpa backoff saat crash-init | perdalam | S | S | `contextEngine.ts:17-52`, `rag/oramaSync.ts:25-40` |

### #4 — Kualitas UX/UI & error-handling
| Area | Temuan | Kat | Dampak | Effort | File |
|---|---|---|---|---|---|
| ErrorBoundary global terlalu agresif | Boundary root subscribe `window error`/`unhandledrejection` → SETIAP rejection (fetch AI gagal, worker, ekstensi browser) jadi layar crash seluruh app. Saran: boundary per-panel di `MainView` lazy routes; rejection global cukup toast + `ErrorService` | risiko | T | M | `ErrorBoundary.tsx:24-41`, `main.tsx:36-52` |
| Peringatan DB tak sampai ke pengguna | `db.ts` dispatch `aetherscribe-db-issue` (DB terblokir/gagal buka) tapi NOL listener → kegagalan paling fatal hanya di console. Perlu listener → toast/banner persisten | risiko | T | S | `db.ts:528-554` |
| ErrorService di jalur error global | Handler global tulis `db.errors` via ErrorService — saat penyebab error IndexedDB sendiri, logging ikut gagal/menggantung. `main.tsx` belum terapkan guard yang `db.ts` sudah sadari | perdalam | S | S | `main.tsx:17-34`, `errorService.ts` |
| Bahasa Inggris bocor di kesan pertama | "Initialising AetherScribe…", "Untitled Novel", "Start your masterpiece here", "Chapter 1", "Once upon a time…" — langgar aturan string UI Indonesia | debt | R | S | `App.tsx:71-74`, `db.ts:557-582` |
| Cache konsistensi tanpa pagar kuota global | `ai_inline_consistency_cache_<id>` cap 300/bab tapi tanpa cap jumlah kunci lintas-bab & tanpa strategi saat `setItem` lempar `QuotaExceededError`. Verifikasi try/catch + eviction LRU per-proyek | perdalam | S | S | `useEditorAIConsistency.ts:45-67,193-195` |

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
| Ekspor besar beku UI | Seluruh ekspor sinkron di 1 tick main thread → React tak repaint, spinner tak tampil, UI beku pada 100+ bab (jsPDF `getTextWidth` per token mahal). Fix: `await setTimeout(0)` sebelum kerja berat / chunking per-bab | risiko | T | S | `ExportManager.tsx:266-285` |
| DOCX ratakan struktur | `htmlToDocxElements` hanya tangani `P`/`H*` top-level; `<ul>/<ol>/<blockquote>` di-flatten → semua `<li>` gabung jadi 1 paragraf tanpa pemisah | risiko | S | M | `ExportManager.tsx:194-236` |
| PDF Unicode | jsPDF font "times" = cp1252: kutip lengkung/em-dash/é aman, glyph di luar cp1252 garble. Aman untuk Indonesia (keputusan sadar), perdalam bila pakai glyph khusus dunia fiksi | perdalam | S | M | `ExportManager.tsx:121-192` |
| EPUB + gambar | Bila konten bab kelak memuat `<img>`, XHTML lolos tapi file gambar tak masuk manifest → EPUB invalid. Guard: strip `<img>` di `htmlToXhtmlBody` | risiko | R | S | `ExportManager.tsx:51-57`, `epub.ts` |

### B — Worldbuilding runtime
| Area | Temuan | Kat | Dampak | Effort | File |
|---|---|---|---|---|---|
| Duplikasi scan graf | Blok keyword + scan Aho-Corasick diduplikasi verbatim antara `buildLoreGraph` (124-147) & `buildLoreGraphView` (233-252) → panel bayar 2× scan. Ekstrak `scanMentions(entries)` | debt | S | S | `src/lib/loreGraph.ts` |
| Graf besar di main thread | `buildLoreGraphView` di main thread; codex ratusan entri → scan AC + d3-force janky. Verifikasi perlu debounce/worker bila codex >500 entri | perdalam | S | M | `loreGraph.ts`, `LoreGraphPanel.tsx` |
| Analitik "adegan per wilayah" | `pointInPolygon` sudah ada tapi belum dipakai — silangkan `PresenceIndex` × area faksi via centroid/pointInPolygon (layer `atlasAnalytics.ts` per arahan rules) | fitur | S | M | `mapGeometry.ts:79-96`, `.claude/rules/atlas.md` |
| Bias elipsis heatmap | Split kalimat `[.!?]+` hitung "..." sebagai pemecah → skor kalimat-pendek sedikit bias naik pada prosa ber-elipsis. Heuristik saran, dampak rendah | perdalam | R | S | `pacingHeatmap.ts:68` |

### C — Pencarian, RAG & sesi asisten
| Area | Temuan | Kat | Dampak | Effort | File |
|---|---|---|---|---|---|
| Polusi indeks Orama lintas-proyek | Hook `creating/updating/deleting` global tanpa filter `projectId` → bulk-write codex proyek lain (impor/restore) ikut ter-index ke indeks proyek aktif → hasil tercemar sampai re-init. Guard `entry.projectId === currentProjectId` | risiko | S | S | `oramaSync.ts:62-84`, `oramaStore.ts:39-54` |
| Race init vs hook | `init` async `toArray()` lalu index; hook selama init bisa di-drop diam-diam atau index dobel → dokumen duplikat / hantu `idMap` sampai re-init | risiko | S | M | `oramaStore.ts:10-60`, `oramaWorker.ts` |
| Persist sesi asisten O(n²) | `onMessageAdded` tulis seluruh array messages tiap pesan → membengkak kumulatif pada sesi maraton. Race sempit saat ganti sesi (guard `isSubscribed` hanya tahan unmount) | perdalam | R | M | `useAssistantSession.ts:61-82` |
| Pencarian federated | `SemanticSearchPanel` (scene) & Orama BM25 (codex) terpisah; satu kotak → hasil bab + codex (skor dinormalkan), murah karena kedua mesin sudah ada | fitur | S | M | `SemanticSearchPanel.tsx`, `src/services/rag/*` |

---

## Prioritas Gabungan (rekomendasi urutan eksekusi)

1. **Flush autosave saat `pagehide` + sebelum reload `versionchange`** (B2 #2) — data-loss naskah tersisa, effort S. Paling murah, dampak tertinggi.
2. **Perbaiki pemotongan lore senyap + satukan formatter KB** (B1 1b#1 + 1a#2) — bug data-ke-AI + drift meter token, sekali kerja.
3. **Jinakkan ErrorBoundary global + cabut re-dispatch tokenWorker + listener `aetherscribe-db-issue`** (B2 #4 + #2) — non-fatal menjatuhkan UI sementara fatal senyap; tiga perbaikan kecil saling menguatkan.
4. **Amankan `buildPresenceIndex` untuk naskah raksasa** (B1 1b#2) — fondasi 4 fitur analitik.
5. **Yield/chunking ekspor + perbaiki DOCX ratakan list** (B3 A) — UI beku & korektness naskah serah pada novel besar, effort S–M.
6. **Guard filter projectId + race init Orama** (B3 C) — cegah polusi/drift indeks RAG saat impor/restore.
7. **Uji jantung AI** (B1 1a#1) — kode paling kritis & paling sering disentuh, paling tak terlindungi.
8. **Diet memori jalur backup penuh** (B2 #1) — sebelum ukuran naskah bikin siklus 30-menit jadi sumber jank/gagal.
