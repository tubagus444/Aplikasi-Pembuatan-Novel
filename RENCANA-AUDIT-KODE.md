# Rencana Audit & Perbaikan Kualitas Kode — AetherScribe

> Dokumen pelacak (tracker) untuk audit kualitas kode bertahap.
> Tujuan: memetakan bagian-bagian penting, memprioritaskan, dan mencatat **mana yang sudah selesai**.

## Cara pakai

- **Status:** ⬜ Belum · 🔄 Sedang dikerjakan · ✅ Selesai · ⏭️ Dilewati (dengan alasan)
- **Prioritas:** `P0` correctness/data-loss (kerjakan dulu) · `P1` penting/keandalan · `P2` maintainability/kebersihan
- **Confidence temuan:** 🔴 terkonfirmasi saat scan · 🟡 indikasi, perlu verifikasi mendalam · ⚪ belum di-scan
- Saat sebuah item dianalisa mendalam, isi sub-bagian **Temuan** dan **Tindakan**, lalu ubah status.
- Update tabel ringkasan di bawah setiap kali status berubah.

---

## Ringkasan prioritas

| # | Area | File utama | Prioritas | Status | Sudah di-scan? |
|---|------|-----------|-----------|--------|----------------|
| 1 | Orkestrasi AI & ketahanan | `src/services/ai/index.ts` | P0 | ✅ perbaikan diterapkan | ✅ mendalam |
| 2 | Klasifikasi error & tipe | `src/services/ai/errors.ts` | P0 | ✅ perbaikan diterapkan | ✅ mendalam |
| 3 | Proxy AI (parsing response) | `src/services/ai/proxy.ts` | P0 | ✅ perbaikan diterapkan | ✅ mendalam |
| 4 | Mesin konteks (worker) | `src/services/contextWorker.ts` | P1 | 🔄 C1/C2/C4/C5/C6/C8/C9 ✅; C3/C11 belum | ✅ mendalam |
| 5 | Skema & migrasi Dexie | `src/db.ts` | P1 | 🔄 D1 ✅ + D2/D4 dikomentari; D6 belum | ✅ mendalam |
| 6 | Server proxy | `server.ts` | P1 | 🔄 SV1/SV2/SV3/SV15 ✅; SV5/SV6/SV10 belum | ✅ mendalam |
| 7 | Backup & sync Drive | `src/services/backupService.ts`, `driveBackupService.ts`, `src/hooks/useAutoBackup.tsx`, `googleAuth.ts` | P1 | 🔄 BK1/BK2/BK-DUP/BK4/BK6/BK7/BK8/BK9/BK10/BK11 ✅; BK3/BK12 belum | ✅ mendalam |
| 8 | RAG Orama (sinkronisasi) | `src/services/rag/*` | P1 | 🔄 RG1/RG7/RG5 ✅ (RG4 via #5); RG2/RG3/RG-ARCH belum | ✅ mendalam |
| 9 | Algoritma murni | `src/lib/{ahoCorasick,chunkEngine,loreUtils}.ts` | P2 | 🔄 L1 ✅ (+test); L2 belum | ✅ mendalam |
| 10 | State & live query | `src/contexts/*`, `src/hooks/useOptimizedLiveQuery.ts` | P2 | ✅ LQ1/LQ2/LQ3 diperbaiki | ✅ mendalam |
| 11 | Editor TipTap (save/highlight) | `src/features/editor/hooks/*`, `extensions/*` | P2 | 🔄 ED1/ED2/ED3 ✅; ED4 belum | ✅ mendalam |
| 12 | Panel UI raksasa (refactor) | `SettingsPanel.tsx`, `BiblePanel.tsx`, `OutlinePanel.tsx` | P2 | 🔄 analisa selesai | ✅ struktural |

---

## Urutan pengerjaan yang disarankan

1. **Gelombang 1 (P0 — jantung AI):** #1 → #2 → #3. Ketiganya saling terkait (index memanggil proxy, keduanya pakai errors). Sebaiknya dibedah bersamaan.
2. **Gelombang 2 (P1 — keandalan & data):** #5 (data) → #4 (worker) → #7 (backup) → #6 (server) → #8 (RAG).
3. **Gelombang 3 (P2 — kebersihan):** #9 → #10 → #11 → #12.

---

## FASE 1 — P0: Jantung AI

### [#1] Orkestrasi AI & ketahanan — `src/services/ai/index.ts`
**Status:** ✅ Perbaikan diterapkan (B1–B5, M1–M3). · **Prioritas:** P0

> **✅ Perbaikan diterapkan:**
> - **B1** — `ErrorService.log` kini hanya menerima metadata serializable (provider, code, actionType, model, `rawMessage` ≤1000, `promptPreview` ≤500). Tidak ada lagi fungsi/AbortSignal → error AI tersimpan benar.
> - **B2** — `abortControllers` jadi `Map<string, Set<AbortController>>` + `registerAbort`/`unregisterAbort`; rewrite & chat pakai `try/finally`. Panggilan paralel tidak lagi saling timpa.
> - **B3** — half-open kini benar-benar satu percobaan (`halfOpenInFlight`); celah `attempt>1` ditutup (circuit terbuka → langsung fallback); `clearHalfOpen` saat abort.
> - **B4** — cek `UNAUTHORIZED` dihapus (dicakup `INVALID_KEY`); kode diselaraskan dengan union #2.
> - **B5** — `parseJsonArray()` (strip code-fence + validasi `Array.isArray`) menggantikan parsing rapuh di `extractToCodex`.
> - **M1** — diekstrak `buildCachedContextBlock()` + `buildRelationshipGraph()`; duplikasi rewrite/chat/buildContextBlock hilang.
> - **M2** — tak ada lagi mutasi `params.model` (resolusi model lokal + `{ ...params, model }`).
> - **M3** — konstanta `CACHE_SUPPORTED_PROVIDERS`, `MAX_CACHED_LORE_CHARS`, helper `isCacheSupported()`.
> - _Ditunda:_ M4 (regex kalimat Inggris-sentris) & M5 (kebersihan minor) — risiko ubah perilaku ekstraksi, dibiarkan.

#### Temuan — Correctness / bug (prioritas perbaikan)

- 🔴 **B1. Error AI tidak pernah tersimpan ke Error Log (silent).** Di `callAI` (272–282), `ErrorService.log` menerima `metadata.params = { ...params, signal: undefined }` yang **masih memuat fungsi** `onChunk` & `onRetry`. `db.errors.add` memakai structured-clone IndexedDB yang **melempar `DataCloneError` untuk fungsi**, sehingga `add` gagal dan ditangkap diam-diam oleh `try/catch` di `errorService.ts` → error hanya muncul di console, **tidak masuk tabel `errors`**. Akibat: panel Error Log tidak pernah menampilkan kegagalan AI. (Bonus masalah: bila pun berhasil, ia menyimpan `systemInstruction`+`userPrompt` yang bisa puluhan ribu karakter → membengkakkan IndexedDB.)
- 🔴 **B2. Race `AbortController`** (20, 353–369, 446–463): controller disimpan di `Map` dengan key statis (`'rewrite'`/`'chat'`). Bila dua aksi sejenis jalan bersamaan: (a) yang kedua menimpa controller yang pertama → yang pertama tak bisa dibatalkan; (b) `cancelAI('rewrite')` hanya membatalkan yang terakhir; (c) `delete('rewrite')` di blok sukses/catch bisa menghapus controller milik panggilan lain dari map.
- 🟡 **B3. Lubang logika circuit breaker** (151–193):
  - Komentar bilang "half-open: allow one trial", tapi nyatanya saat `Date.now() > resetTime` **semua** request lolos (bukan satu), dan tiap kegagalan mendorong `resetTime` maju terus.
  - Di `callAIWithBackoff`, cek `if (attempt===1 && !isFallback) break; else if (isFallback) throw;` **tidak menangani kasus** `attempt>1 && !isFallback` → bila circuit terbuka di tengah retry, kode tetap menembak provider (circuit diabaikan).
  - `recordFailure` dipanggil pada **setiap** retry; satu panggilan buruk (3 retry) bisa langsung membuka circuit untuk panggilan berikutnya.
- 🟡 **B4. Kode error mati / tak sinkron tipe** (191, 212, 233, 247): cek `error.code === 'UNAUTHORIZED'` padahal `classifyError` (#2) tidak pernah menghasilkannya; sebaliknya `CIRCUIT_OPEN` & `TIMEOUT` dibuat di sini tapi tidak ada di union `AIErrorCode`. Cabang mati + tipe longgar.
- 🟡 **B5. `extractToCodex` parsing JSON rapuh** (480–486): hanya strip ```` ```json ```` di awal baris lalu ambil `[`…`]`. Gagal bila model membungkus beda atau menyertakan `]` di dalam string. Tidak ada validasi bentuk hasil parse.

#### Temuan — Maintainability / kebersihan

- 🔴 **M1. Duplikasi besar pembentukan context block.** Blok "CACHING MODE" (bible+lore+relationship graph) **hampir identik** di `processRewrite` (319–336) & `processChat` (409–427); varian ketiga ada di `buildContextBlock` (68–141). Pembentuk relationship-graph diduplikasi **3×**, dan `.substring(0, 50000)` diulang. → ekstrak satu helper (mis. `buildCachedContextBlock`).
- 🟡 **M2. Mutasi parameter input** (196–198): `params.model = settings.models[...]` mengubah objek milik pemanggil (efek samping). Sebaiknya pakai variabel lokal.
- 🟡 **M3. Konstanta tersebar**: daftar provider pendukung cache `['google','claude','openrouter']` diduplikasi (298, 378); ambang panjang teks (500/1000/3000) & temperature (0.85/0.7/0.3/0.9) bertaburan tanpa nama.
- 🟡 **M4. `extractCandidateSentences`** (287–291): regex `\b[A-Z][a-z]{2,}` & pemenggalan kalimat naif — berorientasi Inggris, bisa under-capture untuk teks Indonesia.
- 🟡 **M5. Duplikasi minor**: `testConnection` (520–537) mengembalikan `result.includes('OK') || result.length > 0` (klausa pertama redundan); `fetchGoogleModels` (539–569) menggandakan logika parsing error yang sudah ada di proxy.

#### Catatan positif
Desain ketahanan (circuit breaker + exponential backoff + fallback berurutan) dan mode caching prompt (system prompt statis untuk maksimalkan cache provider) secara konsep sudah bagus; masalah utamanya pada detail implementasi & duplikasi.

#### Tindakan yang disarankan (urut prioritas, belum dikerjakan)
1. **B1** — sanitasi metadata sebelum `ErrorService.log` (buang fungsi & potong prompt). Quick win, dampak tinggi.
2. **B2** — beri key unik per-panggilan pada `abortControllers` (mis. `rewrite:<id>`), atau simpan controller terkini + cek identitas saat delete.
3. **B4** — selaraskan dengan #2: tambah kode ke union atau hapus cek mati (dikerjakan bareng #2).
4. **M1** — ekstrak `buildCachedContextBlock()` dipakai bersama rewrite & chat.
5. **B3, B5, M2–M5** — perbaikan sekunder.

> Verifikasi setelah perbaikan: `npm run lint` + `npx vitest run`.

---

### [#2] Klasifikasi error & tipe — `src/services/ai/errors.ts`
**Status:** ✅ Perbaikan diterapkan (E1, E2, E5). · **Prioritas:** P0

> **✅ Perbaikan diterapkan:**
> - **E1** — union `AIErrorCode` dirapikan: `UNAUTHORIZED` dihapus; ditambah `EMPTY_RESPONSE`, `CIRCUIT_OPEN`, `TIMEOUT`. Sinkron dengan pemakaian di #1 & #3.
> - **E2** — `classifyError` kini juga mengenali status **400 + "model"** sebagai `MODEL_NOT_FOUND`, dan `failed to fetch` sebagai `NETWORK_ERROR`.
> - **E5** — semua pesan `getErrorMessage` dialihbahasakan ke **Indonesia** + ada fallback default.
> - _Catatan:_ E3/E4 (input klasifikasi "kotor") teratasi tidak langsung oleh perbaikan P2 di #3 (ekstraksi pesan asli).

#### Temuan — Correctness

- 🔴 **E1. Union `AIErrorCode` tak sinkron dengan pemakaian.** `errors.ts` mendefinisikan 6 kode (`INVALID_KEY`, `RATE_LIMIT`, `QUOTA_EXCEEDED`, `MODEL_NOT_FOUND`, `NETWORK_ERROR`, `API_ERROR`). Tapi `index.ts` memakai `UNAUTHORIZED` (tak pernah dihasilkan `classifyError` → cek mati) serta membuat `CIRCUIT_OPEN` & `TIMEOUT` (tak ada di union → tipe longgar). Perlu satu sumber kebenaran: hapus `UNAUTHORIZED` (sudah dicakup `INVALID_KEY` untuk 401/403) dan tambahkan `CIRCUIT_OPEN`/`TIMEOUT` ke union (atau pisahkan kode internal vs kode provider). **Terkait B4 di #1.**
- 🟡 **E2. `MODEL_NOT_FOUND` hanya dari 404** (15), padahal beberapa provider (Groq/OpenRouter) mengembalikan **400** untuk model salah; terselamatkan hanya bila pesan memuat "model not found". Bisa lolos jadi `API_ERROR`.
- 🟡 **E3. Input klasifikasi sudah "kotor".** Karena `server.ts` membungkus error provider sebagai `{ error: "<string mentah>" }` dan `proxy.ts` gagal mengekstrak pesan asli (lihat P2 di #3), `classifyError` menerima string JSON ter-bungkus ganda. Pencocokan berbasis `status` tetap jalan, tapi pencocokan berbasis substring jadi rapuh/kebetulan.

#### Temuan — Maintainability

- 🟡 **E4. Heuristik rapuh & aneh**: `msg.includes('aiza')` (deteksi prefix key Google "AIza…" yang bocor di pesan) dan `msg.includes('api key')` terlalu longgar → potensi salah klasifikasi bila format pesan provider berubah.
- 🟡 **E5. Inkonsistensi bahasa**: `getErrorMessage` mengembalikan pesan **Inggris**, sedangkan `index.ts` membuat pesan AIError **Indonesia**. Aplikasi berbahasa Indonesia → UI campur dua bahasa.

#### Tindakan yang disarankan (belum dikerjakan)
1. **E1** — rapikan union & selaraskan dengan #1 (hapus cek `UNAUTHORIZED`, tambah `CIRCUIT_OPEN`/`TIMEOUT`). Dikerjakan satu paket dengan B4.
2. **E2** — perluas deteksi `MODEL_NOT_FOUND` ke status 400 + pola pesan.
3. **E5** — samakan bahasa pesan (Indonesia).
4. **E3/E4** — bergantung pada perbaikan ekstraksi pesan di #3.

---

### [#3] Proxy AI (parsing response) — `src/services/ai/proxy.ts`
**Status:** ✅ Perbaikan diterapkan (P1–P3, P5, P6). · **Prioritas:** P0

> **✅ Perbaikan diterapkan:**
> - **P1** — `extractCompleteText()` mengakses respons dengan optional chaining seragam (claude/google/openai); respons kosong → error `EMPTY_RESPONSE` terklasifikasi, bukan crash mentah.
> - **P2** — `extractErrorMessage()` mengupas pembungkus `{ error: "<string>" }` dari `server.ts` (termasuk JSON provider bersarang) → pesan asli kembali terbaca.
> - **P3** — timeout internal 60s via `AbortController` gabungan; untuk streaming jadi **idle-timeout** (di-reset tiap chunk) agar generasi panjang tak terputus; timeout dilempar sebagai kode `TIMEOUT` (bukan AbortError, agar fallback tetap jalan).
> - **P5** — `logUsageToDB` kini memetakan `input_tokens`/`output_tokens` (Claude native); SSE Claude membaca usage dari `message_start`/`message_delta`.
> - **P6** — pemetaan history pakai `historyText()` yang guard `parts?.[0]?.text`.
> - _Ditunda:_ P4 (deteksi stream terpotong — sulit andal tanpa finish-reason), P7–P10 (kebersihan).

#### Temuan — Correctness / bug

- 🔴 **P1. Akses respons tanpa guard (non-stream).** `data.content[0].text` (Claude, 180) & `data.choices[0].message.content` (OpenAI-compatible, 188) langsung diakses. Bila `choices`/`content` kosong (content-filter, `finish_reason` non-stop, body tak terduga, Claude balas hanya tool/`content: []`) → `TypeError` mentah yang **tidak terklasifikasi** (jadi `API_ERROR` generik). Hanya cabang Google (181–186) yang dijaga. Perlu guard seragam untuk ketiga cabang.
- 🔴 **P2. Kontrak error klien↔server tak cocok → pesan asli hilang.** `server.ts` mengirim error sebagai `{ error: "<teks mentah provider>" }` (string). Di `proxy.ts` (92–93): `parsed.error?.message || parsed.message` — karena `parsed.error` **string**, `?.message` selalu `undefined`, jadi `rawMessage` = seluruh JSON terbungkus, bukan pesan asli. Klasifikasi tetap jalan lewat **status**, tapi pesan untuk log/diagnosis jadi noise (lihat E3 di #2).
- 🟡 **P3. Banyak panggilan tanpa timeout/abort.** `extractToCodex`, `expandCodexEntry`, `testConnection`, auto-summarizer memanggil tanpa `signal`, dan `proxy.ts` tak punya timeout internal (hanya andalkan `AbortController` pemanggil). Provider yang menggantung → request bisa **hang tak terbatas**.
- 🟡 **P4. Stream terputus dianggap sukses.** Loop baca stream (118–169) berhenti saat `done`; bila koneksi putus di tengah, hasil parsial dikembalikan sebagai sukses tanpa error → output terpotong terlihat normal.
- 🟡 **P5. Usage token Claude native tak tertangkap.** `logUsageToDB` (200–209) mengecek `inputTokenCount`/`outputTokenCount` (gaya Bedrock) & `prompt_tokens`, tapi API Anthropic asli mengembalikan `input_tokens`/`output_tokens` → jatuh ke estimasi `length/4`. Pencatatan token Claude jadi tidak akurat.
- 🟡 **P6. Asumsi `h.parts[0].text`** (25, 33, 49): jika `parts` kosong → crash saat memetakan history.

#### Temuan — Maintainability

- 🟡 **P7. Estimasi token `length/4`** (197–198) kasar; bisa diselaraskan dengan tiktoken di worker (#4) bila akurasi penting.
- 🟡 **P8. Percabangan provider berulang** untuk build-request, parse non-stream, dan parse-stream (claude/google/else) — kandidat disatukan jadi tabel adapter per-provider.
- 🟡 **P9. `getModelForProvider`** menaruh model default hard-coded (222–231); berpotensi tumpang tindih dengan `modelService.ts` — perlu cek duplikasi & kemutakhiran nama model.
- 🟡 **P10. `body: any`** (11) — kehilangan keamanan tipe pada bentuk request tiap provider.

#### Tindakan yang disarankan (urut prioritas, belum dikerjakan)
1. **P1** — guard seragam + lempar error terklasifikasi bila konten kosong (mis. `EMPTY_RESPONSE`/`MODEL_NOT_FOUND`/content-filter).
2. **P2** — samakan kontrak error dengan `server.ts` (kirim `{ error: { message } }` atau ekstrak benar di klien). Selaraskan dengan #2 & #6.
3. **P3** — tambah timeout internal (mis. `AbortSignal.timeout`) + teruskan signal ke semua jalur.
4. **P5/P6/P4** — perbaikan keandalan sekunder.
5. **P7–P10** — kebersihan.

---

## FASE 2 — P1: Keandalan & data

### [#5] Skema & migrasi Dexie — `src/db.ts`
**Status:** 🔄 Analisa mendalam selesai — belum ada perubahan kode. · **Prioritas:** P1

#### Temuan — Keandalan (prioritas)

- ✅ **D1 (DIPERBAIKI). Penanganan gagal buka/upgrade DB.** Ditambahkan `db.on('versionchange')` (tutup koneksi + reload di main thread), `db.on('blocked')` (peringatkan tutup tab lain), dan `db.open().catch()` (tangkap VersionError/kuota/korup lebih awal). Notifikasi lewat `console` + `CustomEvent('aetherscribe-db-issue')` — **sengaja tidak** memakai `ErrorService` (yang menulis ke `db.errors`) agar tidak ikut menggantung saat DB bermasalah. Ini juga menutup **RG4** (#8): koneksi Dexie ganda (main + 2 worker) kini menutup dengan benar saat upgrade.

#### Temuan — Maintainability / kebersihan

- ✅ **D2 (DIKOMENTARI). `version(15)` identik 100% dengan `version(14)`**: no-op version bump historis. Sudah diberi komentar penjelas di kode (jangan dihapus — menghapus versi tengah memicu jalur upgrade ulang).
- 🟡 **D3. Repetisi skema** v11–17 menyalin seluruh definisi store tiap versi walau hanya 1 tabel berubah. Sah secara Dexie tapi verbose & rawan salah salin. Catatan saja (tak bisa diringkas tanpa risiko).
- ✅ **D4 (DIKOMENTARI). Baseline v10** (versi <10 sengaja dihapus) — sudah diberi komentar penjelas di kode agar tidak terlihat seperti tabel hilang.
- 🟢 **D5. Migrasi dedup bible v10 benar** (keep-first, delete dups) sebelum unique index `&[projectId+key]` di v11. Minor: `idsToDelete: any[]` longgar tipe; pemenang duplikat bersifat arbitrer (yang pertama ditemui) — dapat diterima.
- ⚪ **D6. Konten default Inggris** di `ensureDefaultProject` ("Untitled Novel", "Once upon a time...", "Dark and atmospheric") pada app berbahasa Indonesia — kosmetik.

#### Verifikasi yang sudah dilakukan
- ✅ Seluruh indeks cocok dengan field di `types.ts` (`*aliases`, `&[projectId+key]`, `activeChapterId`, dst.).
- ✅ `backups` tanpa `projectId` itu **benar** — `BackupRecord` memang global (bukan per-proyek), jadi bukan indeks hilang.
- ✅ `aiUsageLogs.timestamp` terindeks → `cleanupAILogs()` (where timestamp.below) efisien.

#### Catatan
db.ts relatif sehat: **tidak ada risiko kehilangan data** pada migrasi. Peningkatan paling berdampak murni soal **ketahanan saat open/upgrade/multi-tab (D1)**.

#### Tindakan yang disarankan (belum dikerjakan)
1. **D1** — tambah handler `versionchange`/`blocked` + `db.open().catch()` dengan log & notifikasi.
2. **D2/D4** — beri komentar penjelas (v15 no-op; baseline v10).
3. **D6** — (opsional) lokalkan konten default ke Indonesia.

---

### [#4] Mesin konteks (worker) — `src/services/contextWorker.ts` (+ `contextEngine.ts`)
**Status:** 🔄 Analisa mendalam selesai — belum ada perubahan kode. · **Prioritas:** P1

#### Temuan — Keandalan (prioritas)

- ✅ **C1 (DIPERBAIKI — Opsi "AC-first + embed background"). Head-of-line blocking + timeout 30s saat embedding pertama.** `getRelevantContext` kini: (1) selalu kembalikan hasil Aho-Corasick dengan cepat; (2) hitung skor semantik **hanya jika sudah siap** (`semanticReady`: model termuat + semua embedding tercache); (3) bila belum siap, picu `ensureEmbeddings()` sebagai **tugas latar tanpa di-await** (loop tetap `yield` tiap 10) lalu balas AC-only kali ini. Hasil: query tak pernah timeout/memblokir; semantik aktif otomatis di query berikutnya. **Bonus:** filter relevansi diubah jadi `acScore>0 || finalScore>20` agar kecocokan eksak tunggal tetap muncul di mode AC-only (sebelumnya `finalScore>20` membuang exact-match tunggal). Verifikasi: `tsc` 0 error, vitest 21/21.
- ✅ **C2 (DIPERBAIKI). Kegagalan semantik senyap.** `getEmbedder` kini **reset `modelInitPromise=null` saat gagal** → model bisa dicoba ulang (sebelumnya promise gagal ter-cache selamanya). `ensureEmbeddings` catch mem-post `PROGRESS { type: 'embedding_error', message }` agar kegagalan tidak senyap (bisa ditangkap UI lewat event `semantic-indexing-progress`).
- 🟡 **C3. Timeout tidak membatalkan kerja worker.** `sendToWorker` reject di 30s tapi tak mengirim sinyal batal; worker lanjut. Tidak ada protokol cancel per-request.
- 🟡 **C11. `worker.onerror` me-redispatch `ErrorEvent('error')` ke `window`** (`contextEngine` 44) → berpotensi memicu handler error global/menggandakan log. Perlu dipastikan tak menimbulkan loop.

#### Temuan — Correctness / konsistensi

- ✅ **C4 (DIPERBAIKI). Inkonsistensi pencocokan nama berimbuhan Indonesia.** `AhoCorasick.search` kini menoleransi akhiran/partikel Indonesia (`nya/ku/mu/lah/kah/pun/toh`) — selaras dengan `getCodexRegex`. "Kaelnya/Kaelpun" kini terdeteksi di konteks & highlight, dan akhiran disertakan ke rentang sorot. Aditif (tak menghapus match lama). Ditambah unit test (lihat #9 L1).
- ✅ **C5 (DIPERBAIKI). `GET_CODEX_MATCHES` → `codexId` undefined.** Ditambah guard `m.data.entry.id !== undefined` → entri tanpa id dilewati (tak merusak highlight).
- ✅ **C6 (DIPERBAIKI). `SCAN_APPEARANCES` pada HTML mentah.** Konten kini di-strip tag (`replace(/<[^>]*>/g, ' ')`) sebelum diuji regex → tak ada false-match di dalam tag/atribut.
- 🟢 **C7. `cosineSimilarity` mengasumsikan embedding ternormalisasi** (`normalize:true`). Embedding lama yang tak ternormalisasi → skor meleset. Risiko rendah.

#### Temuan — Maintainability

- ✅ **C8 (DIPERBAIKI). Angka ajaib skoring.** Diekstrak jadi konstanta bernama berkomentar: `AC_NAME_SCORE`, `AC_ALIAS_SCORE`, `SEMANTIC_WEIGHT`, `AC_WEIGHT`, `EXACT_MATCH_BOOST`, `RELEVANCE_THRESHOLD` (perilaku identik, lebih mudah di-tune).
- ✅ **C9 (DIPERBAIKI). Variabel mati** `embedderInitializing` dihapus (diganti `backgroundIndexing` yang dipakai untuk guard indexing latar).
- 🟢 **C10. `embeddingCache` tak terbatas** (~1.5KB/entri) — wajar; dibersihkan saat `INVALIDATE_CACHE { deep }`.

#### Catatan
Algoritma inti (Aho-Corasick, hybrid scoring, caching embedding ke IndexedDB) sudah solid. Risiko terbesar bersifat **operasional**: embedding pertama memblokir worker (C1) & kegagalan senyap (C2). Plus satu **inkonsistensi nyata** (C4) yang memengaruhi kualitas highlight/konteks bahasa Indonesia.
_(Koreksi: catatan awal soal "duplikasi relationship-graph" keliru — graph dibangun di `index.ts`, bukan worker; sudah ditangani di #1/M1.)_

#### Tindakan yang disarankan (belum dikerjakan)
1. **C1** — strategi anti-blocking untuk embedding pertama (idle pre-embed / timeout khusus / hasil bertahap). Paling berdampak.
2. **C4** — satukan logika boundary nama (AC mengenali sufiks Indonesia, atau pakai jalur regex yang sama) agar highlight/konteks konsisten.
3. **C2** — log kegagalan model ke `ErrorService` + notifikasi.
4. **C5/C6/C9** — guard `entry.id`, strip HTML di SCAN_APPEARANCES, hapus variabel mati.
5. **C3/C8/C11** — sekunder (protokol cancel, dokumentasi konstanta, cek redispatch error).

---

### [#6] Server proxy — `server.ts` (Express 4.22.1)
**Status:** 🔄 Analisa mendalam selesai — belum ada perubahan kode. · **Prioritas:** P1
> Catatan CLAUDE.md: hardening keamanan (auth, rate-limit, SSRF Ollama) **sengaja out-of-scope**. Fokus audit: kebenaran penerusan request/error, timeout, parsing per-provider.

#### Temuan — Correctness (memengaruhi fitur inti)

- ✅ **SV1 (DIPERBAIKI). `express.json()` tanpa `limit` → default 100kb.** Body proxy pada **mode caching** (full codex ≤50KB + bible + relationship graph + `userPrompt`+scene+history) mudah melebihi 100kb → Express balas **413** → panggilan AI gagal untuk novel sedang/besar. **Perbaikan diterapkan:** `app.use(express.json({ limit: '25mb' }))`. Verifikasi: `tsc` 0 error (runtime 413 tak ada unit-test; perlu uji manual bila ingin pasti).
- ✅ **SV15 (DIPERBAIKI). Validasi input + error async.** Ditambah guard di awal handler: `req.body || {}` + cek `provider`/`body` valid → balas 400 bila malformed. Tidak ada lagi `TypeError` tak tertangkap yang membuat request menggantung.

#### Temuan — Keandalan

- ✅ **SV2/SV4 (DIPERBAIKI). Propagasi abort ke provider.** `AbortController` + `res.on('close', () => upstream.abort())`; `signal` diteruskan ke `fetch`. Saat klien memutus / timeout 60s (dari #3), fetch server→provider ikut dibatalkan → tak lagi orphaned. (Catatan: belum ada timeout server independen; mengandalkan timeout klien.)
- ✅ **SV3 (DIPERBAIKI). Streaming: error setelah header terkirim.** `catch` kini: abort klien → `return`; selain itu guard `if (!res.headersSent)` sebelum `res.status().json()`, jika header sudah terkirim cukup `res.end()` → tak ada lagi `ERR_HTTP_HEADERS_SENT`.

#### Temuan — Maintainability / minor

- 🟡 **SV6. Default model Google tak konsisten antar lapis:** server `gemini-1.5-flash` (47) vs proxy `gemini-2.0-flash`.
- 🟡 **SV5. (cross-ref #3 P2)** Server membungkus error provider sebagai `{ error: "<text>" }`; sudah ditangani di klien, tapi bisa dibuat konsisten (teruskan JSON asli).
- 🟡 **SV10.** Pola penanganan error mirip diulang di tiga endpoint (`proxy`, `google-models`, `ollama-models`).
- 🟢 **SV-SEC.** SSRF via `ollamaBaseUrl` (dikontrol klien) + tanpa auth/rate-limit → **sengaja out-of-scope** per CLAUDE.md. Dicatat saja.

#### Catatan positif
Urutan route benar (API sebelum middleware Vite), prioritas kunci klien→`.env` benar, passthrough streaming byte-per-byte, dan forwarding status non-stream sudah tepat.

#### Tindakan yang disarankan (belum dikerjakan)
1. **SV1** — naikkan `express.json` limit. Quick win, dampak tinggi (memperbaiki fitur inti caching).
2. **SV15** — validasi body + pindahkan pembacaan ke dalam `try` (cegah request menggantung).
3. **SV2/SV4/SV3** — abort upstream saat klien putus + guard `headersSent` pada stream.
4. **SV6/SV5/SV10** — kebersihan.

---

### [#7] Backup & sync Drive — `backupService.ts`, `driveBackupService.ts`, `useAutoBackup.tsx`, `googleAuth.ts`
**Status:** 🔄 Analisa mendalam selesai — belum ada perubahan kode. · **Prioritas:** P1

#### Temuan — Integritas data (prioritas)

- ✅ **BK1 (DIPERBAIKI). `chatSessions` tidak ikut dicadangkan.** `collectAllData` (version→2) kini menyertakan `chatSessions`; semua jalur backup (internal/file/Drive) & restore ikut membawanya. Backup lama tanpa chatSessions tetap aman dipulihkan (guard `?.length`).
- ✅ **BK2 (DIPERBAIKI). Restore tidak membersihkan `embeddings`.** `restoreData` kini `db.embeddings.clear()` di dalam transaksi → embeddings di-regenerasi dari codex (tak ada lagi embedding basi pasca-restore).
- ✅ **BK4 (DIPERBAIKI). Fallback kompresi tetap bernama `.json.gz`.** `compressData` kini mengembalikan `{ blob, compressed }` (sumber tunggal di `backupService`, dipakai juga `driveBackupService` → sekalian menutup sisa BK-DUP). `saveToDirectory` & `syncProjectToDrive` menamai file `.json.gz` **hanya** saat benar-benar ter-gzip; selain itu `.json` mentah (mime `application/json`). Restore di `SettingsPanel` kini mendeteksi gzip lewat **magic bytes** (`0x1f 0x8b`), bukan ekstensi → robust untuk cadangan lama yang salah dinamai maupun yang baru. Verifikasi: `tsc` 0 error, vitest 33/33.

#### Temuan — Maintainability

- ✅ **BK-DUP (DIPERBAIKI penuh). Logika restore, "kumpul data" & kompresi terduplikasi.** `SettingsPanel.handleBackup` → `collectAllData()`, `handleFileChange` → `restoreData()` (sudah sebelumnya), dan kini `compressData` **disatukan** di `backupService` (dipakai `driveBackupService` lewat import) → satu sumber kebenaran untuk collect, restore, & kompresi.
- ✅ **BK8 (DIPERBAIKI). Import `firebase/app` tak terpakai** di `googleAuth.ts` dihapus saat restrukturisasi BK7 → tak lagi menyeret firebase ke bundle.

#### Temuan — Keandalan Drive/Auth

- ✅ **BK7 (DIPERBAIKI). Tidak ada refresh token senyap.** `googleAuth` kini menyimpan `tokenClient` GIS + clientId; `getAccessToken` mencoba **refresh diam-diam** (`requestAccessToken({ prompt: '' })`) saat token kedaluwarsa sebelum melempar `TOKEN_EXPIRED`. Auto-sync Drive tak lagi mati ~tiap jam selama app terbuka (consent sudah diingat GIS). _Catatan:_ setelah full reload, token in-memory hilang → tetap perlu login ulang (di luar lingkup BK7).
- ✅ **BK6 (DIPERBAIKI). Handle folder tidak dipersist.** Handle direktori kini disimpan di IndexedDB mini (`src/lib/folderHandleStore.ts`, DB terpisah `AetherScribeHandles` agar tak menaikkan skema Dexie) dan dipulihkan saat mount → folder tetap terkonfigurasi setelah reload. Izin (yang jadi `'prompt'` pasca-reload) di-`requestPermission` ulang **hanya saat backup manual** (gesture); saat auto, dilewati diam-diam agar tak error tiap siklus.
- ✅ **BK10 (DIPERBAIKI). Spam konflik di perangkat baru.** `useAutoBackup` membedakan auto vs manual; notifikasi `CONFLICT_DETECTED`/`TOKEN_EXPIRED` saat **auto** ditampilkan **sekali** (ref `driveNoticeShownRef`) dan di-reset setelah sync berhasil → tak ada lagi toast berulang tiap siklus.
- ✅ **BK9 (DIPERBAIKI). Kegagalan DELETE rotasi Drive tak dicek.** `syncProjectToDrive` kini mengecek `delRes.ok` (404 diabaikan—sudah terhapus) dan `console.warn` bila gagal → kegagalan rotasi tak lagi senyap.

#### Temuan — Minor / kosmetik

- 🟡 **BK3.** Backup **internal** (IndexedDB) tidak dikompresi (hanya file/Drive yang gzip) → 5× JSON penuh bisa membengkak.
- ✅ **BK11 (DIPERBAIKI). `googleSignIn` tanpa `return` setelah `reject`.** Restrukturisasi BK7 memindah callback ke `requestToken()` dengan `if (response.error) { reject; return; }` → tak ada lagi eksekusi callback yang lanjut setelah reject.
- ⚪ **BK12.** Pakai `alert()`/`window.confirm()` (bukan sistem toast/modal app); pesan toast campur Inggris/Indonesia. _(Sebagian pesan toast di `useAutoBackup` sudah dialihbahasakan ke Indonesia saat BK10.)_

#### Catatan positif
Arsitektur 3-lapis (internal → folder → Drive) dengan rotasi 5 & gzip cukup matang. Atomicitas restore aman: transaksi `'rw'` rollback bila throw, dan `JSON.parse` dilakukan **sebelum** clear → data tidak hilang bila file korup. Error per-lapis di auto-backup ditangani terpisah dengan baik.

#### Tindakan yang disarankan
1. ✅ **BK1 + BK-DUP + BK2** — selesai (satu sumber kebenaran collect/restore/kompresi + chatSessions + clear embeddings).
2. ✅ **BK4** — selesai (penamaan file ikut status kompresi + restore deteksi gzip via magic bytes).
3. ✅ **BK7 / BK6** — selesai (refresh token senyap GIS `prompt:''` + persist folder handle ke IndexedDB).
4. ✅ **BK8 / BK9 / BK10 / BK11** — selesai. _Tersisa:_ **BK3** (kompres backup internal) & **BK12** (ganti `alert`/`confirm` ke toast/modal) — kosmetik/opt-in.

---

### [#8] RAG Orama (sinkronisasi) — `oramaStore.ts`, `oramaSync.ts`, `oramaWorker.ts`
**Status:** 🔄 Analisa mendalam selesai — belum ada perubahan kode. · **Prioritas:** P1

#### Temuan — Keandalan (prioritas)

- ✅ **RG1+RG7 (DIPERBAIKI). Search bisa menggantung selamanya.** Sekarang: (1) `oramaSync.search` punya **timeout 15s** (reject + bersihkan pending); (2) `worker.onerror` mem-**reject SEMUA pending** lalu reset worker (dibuat ulang saat dipakai lagi); (3) worker `SEARCH catch` kini mem-post `SEARCH_RESULT { error }` sehingga promise pasti settle. `contextEngine.getRelevantContext` sudah membungkus `search` dalam try/catch → rejection ditangani anggun (fallback ke hasil contextWorker). Verifikasi: `tsc` 0 error, vitest 21/21.
- 🟡 **RG3. Index/update/remove fire-and-forget** (tanpa ack/penanganan error) → drift indeks senyap; entri yang gagal diindeks tak diketahui.
- ✅ **RG4 (TERTANGANI via #5 D1). Koneksi Dexie ganda** (main + context worker + orama worker — semua buka `@/src/db`). Karena `db.ts` kini punya handler `versionchange`/`blocked`/`open().catch()`, **setiap** koneksi worker juga menutup dengan benar saat upgrade → tak lagi memblokir/menggantung.
- ✅ **RG5 (DIPERBAIKI). `worker.onerror` redispatch `ErrorEvent('error')` ke `window`** — dihapus; diganti `console.error` + reject-pending. (Padanannya C11 di #4 masih terbuka untuk contextEngine.)

#### Temuan — Correctness (minor)

- 🟡 **RG2. Race init vs hook (kecil).** Entri yang dibuat tepat sebelum `INIT_ORAMA` selesai bisa terlewat (`indexEntry` keluar awal saat `db` masih null). Umumnya tertutup oleh loop init yang membaca Dexie setelah commit; risiko sempit. Catatan saja.
- 🟢 **RG6. `oramaStore` singleton hanya dipakai di dalam worker** (main-thread mengimpor `oramaSync`, tak menyentuh `oramaStore`) — bukan bug, sekadar catatan agar tak membingungkan.

#### Temuan — Arsitektur / maintainability

- 🟡 **RG-ARCH. Tiga sistem relevansi codex tumpang tindih:** Aho-Corasick exact + MiniLM semantic (**contextWorker**, #4) + Orama BM25 (**orama worker**), lewat **dua worker terpisah** yang sama-sama memindai codex. CLAUDE.md memosisikan Orama sebagai "fallback RAG leksikal", tapi pembagian peran/biaya rangkap perlu didokumentasikan/ditegaskan agar tidak redundan.

#### Catatan positif
Skema Orama jelas; `search` mengambil record lengkap dari Dexie (data mutakhir) sambil menjaga urutan relevansi; hooks menjaga sinkron inkremental (create/update/delete); `init` idempoten dengan guard `currentProjectId`. `oramaSync.init` dikonfirmasi dipanggil di `ProjectContext` saat load/switch proyek.

#### Tindakan yang disarankan (belum dikerjakan)
1. **RG1+RG7** — tambah timeout pada `oramaSync.search` + reject semua pending saat `worker.onerror` (pola `terminateWorker` ala `contextEngine`); worker `SEARCH catch` harus mem-post `SEARCH_RESULT { error }`.
2. **RG4** — selesaikan bersama **#5 D1** (handler `versionchange`/`blocked` di `db.ts` berlaku untuk semua koneksi worker).
3. **RG3 / RG2** — (opsional) ack indexing / re-sync setelah init.
4. **RG-ARCH / RG5 / RG6** — dokumentasi pembagian peran & kebersihan.

---

## FASE 3 — P2: Maintainability & kebersihan

### [#9] Algoritma murni — `src/lib/{ahoCorasick,chunkEngine,loreUtils}.ts`
**Status:** 🔄 Analisa mendalam selesai — **sehat**, belum ada perubahan kode. · **Prioritas:** P2

**Temuan (semua minor):**
- ✅ **L1 (DIPERBAIKI). Konsistensi boundary nama Indonesia.** `AhoCorasick.search` (C4) & `chunkEngine.countMatches` kini menoleransi akhiran Indonesia, selaras dengan `getCodexRegex`. Ditambah unit test `ahoCorasick.test.ts` ("…Indonesian suffix particles…") → total test 21→22.
- 🟡 **L2. Regex mention greedy.** `loreUtils` `@rule:(\S+)`/`@codex:(\S+)` menyertakan tanda baca akhir (mis. `@codex:Kael.` → "Kael."). Edge parsing.
- 🟢 **L3. Angka ajaib** (threshold `0.5`, top-2 scene, `len>3`) — wajar, terdokumentasi via test.

**Catatan positif:** fungsi murni & deterministik, **sudah ada unit test** (ahoCorasick, chunkEngine, loreUtils, utils). Risiko rendah; cocok jadi tempat menambah test edge-case bila boundary (L1) disatukan.

**Tindakan disarankan:** (opsional) satukan logika boundary (L1) lalu tambah test; perketat regex mention (L2).

### [#10] State & live query — `src/contexts/*`, `src/hooks/useOptimizedLiveQuery.ts`
**Status:** 🔄 Analisa mendalam selesai — belum ada perubahan kode. · **Prioritas:** P2

**Temuan:**
- ✅ **LQ1 (DIPERBAIKI). `useOptimizedLiveQuery` mem-`JSON.stringify` tiap render.** Ditambah short-circuit referensi: `JSON.stringify` kini hanya dijalankan saat referensi hasil `useLiveQuery` berubah (mis. tabel berubah), bukan tiap render. Untuk koleksi besar (chapters/codex), biaya per-render hilang.
- ✅ **LQ2 (DIPERBAIKI). Context value tak di-memo.** `ProjectContext` (switch/create/delete → `useCallback`, value → `useMemo`), `UIContext` (`toggleTheme` → `useCallback`, value → `useMemo`), `EditorPanelContext` (value → `useMemo`). Konsumen/anak ber-`memo` tak lagi re-render karena identitas value/fungsi berubah sia-sia.
- ✅ **LQ3 (DIPERBAIKI). Urutan `deleteProject`.** Sekarang: hitung target pindah → **HAPUS dulu** (transaksi) → baru pindah proyek. Bila penghapusan gagal, tidak terlanjur berpindah.
- 🟢 **LQ4.** `NavigationContext` sinkron `activeChapter` saat bab terhapus pakai `isMounted` guard — benar (tak diubah).

**Catatan positif:** pemisahan context per-domain rapi; `useProjectData` mengelompokkan live query; guard `useContext===undefined` konsisten.

Verifikasi: `tsc` 0 error, vitest 21/21.

### [#11] Editor TipTap — `src/features/editor/hooks/*`, `extensions/*`
**Status:** 🔄 Analisa mendalam selesai — belum ada perubahan kode. · **Prioritas:** P2 (⚠️ memuat 1 data-loss)

**Temuan — Data-loss (prioritas):**
- ✅ **ED1 (DIPERBAIKI). Edit terbaru bisa hilang saat ganti bab cepat / keluar mode write < 1.5s.** Di `useEditorSave`, `htmlRef.current` dulu hanya diisi **di dalam** timeout debounce. Saat ganti chapter/unmount, flush memakai snapshot **lama** → edit terakhir hilang bila pindah < 1.5s. **Perbaikan diterapkan:** `htmlRef.current = currentEditor.getHTML()` kini dipanggil **segera** di awal `onEditorUpdate` (di luar timeout), sehingga flush selalu memakai teks terkini. Trade-off: `getHTML()` per-keystroke (biaya sepele untuk ukuran bab normal). Verifikasi: `tsc` 0 error, vitest 21/21.

**Temuan — Maintainability / churn:**
- ✅ **ED2 (DIPERBAIKI). `skipNextUpdateRef` mati.** `useEditorSetup` kini `setContent(initialContent, { emitUpdate: false })` → load konten awal tak memicu autosave (tak ada write sia-sia / kedip status). Ref mati `skipNextUpdateRef` dihapus.
- ✅ **ED3 (DIPERBAIKI). Wiring `onEditorUpdateRef` rapuh.** Diganti `useRef` + `useCallback` stabil di `useNovelEditor`; `onUpdate` editor membaca versi terbaru lewat ref (tak lagi variabel lokal di-reassign).
- 🟡 **ED4. `PassiveCodexHighlight` walk seluruh text node tiap `docChanged`** (debounce 500ms) → biaya naik dengan ukuran bab (dimitigasi debounce + worker). `data-codex-id` bisa `'undefined'` (cross-ref **C5** #4).

**Catatan positif:** highlight pakai meta-transaction + `map` decorations (benar) dengan cek bounds & debounce; pemisahan hook editor (setup/save/AI/search/codex) rapi; flush-on-unmount & flush-on-chapter-switch sudah ada (tinggal perbaiki sumber datanya, ED1).

**Tindakan disarankan:** **ED1 dulu** (cegah kehilangan data), lalu ED2/ED3 kebersihan.

### [#12] Panel UI raksasa — `SettingsPanel.tsx`, `BiblePanel.tsx`, `OutlinePanel.tsx`
**Status:** 🔄 Analisa struktural selesai — belum ada perubahan kode. · **Prioritas:** P2

**Metrik (mengubah gambaran awal):**

| File | Baris | useState | `db.` langsung | Sifat |
|------|-------|----------|----------------|-------|
| `SettingsPanel.tsx` | 1030 | 18 | **26** | God-component: UI + akses data + logika bisnis |
| `BiblePanel.tsx` | 939 | 2 | 0 | Besar karena **JSX/presentasi** |
| `OutlinePanel.tsx` | 725 | 7 | 0 | Besar karena **JSX/presentasi** |

**Temuan:**
- 🟡 **UI1. `SettingsPanel` adalah target refactor sesungguhnya.** 26 akses `db.` langsung + 18 state mencampur presentasi dengan logika backup/restore, pengaturan AI, dan fetch model. Logika restore-nya juga **duplikat** dengan `backupService` (cross-ref **#7 BK-DUP**). Saran: ekstrak ke hook/service (`useSettings*`, satukan backup/restore), sisakan presentasi.
- 🟢 **UI2. `BiblePanel`/`OutlinePanel` besar karena JSX**, logika sudah didelegasikan (≤7 state, 0 db) → **risiko rendah**. Refactor (pecah sub-komponen) opsional untuk keterbacaan, bukan prioritas.

**Tindakan disarankan:** prioritaskan pemecahan `SettingsPanel` (sekaligus menuntaskan BK-DUP #7); BiblePanel/OutlinePanel ditunda.

---

## Temuan lanjutan (di luar 12 area awal)

### [A1] Regenerasi chat memakai konteks bab yang bisa berbeda dari kiriman aslinya — `useAssistantSession.ts`, `useAssistantChunkEngine.ts`
**Status:** ⬜ Ditunda (sengaja). · **Prioritas:** P2 · **Confidence:** 🔴 terkonfirmasi

- **Temuan.** Di Studio, `chapterContext` (Smart Auto) dihitung dari `input` saat ini lewat chunk engine. Saat **Regenerasi/Coba Lagi**, `input` sudah kosong → chunk engine jatuh ke fallback "scene terakhir", jadi konteks bab yang dipakai regen bisa **berbeda** dari yang dikirim saat pesan asli dibuat. Hasil regen tetap koheren, hanya tak dijamin setara konteksnya. (Tag lore di history kini sudah di-`stripLoreTags`, jadi bukan bagian masalah ini.)
- **Tindakan (bila dikerjakan).** Simpan `chapterContext` yang dipakai **per pesan** saat dikirim (mis. field pada `ChatMessage`/sesi), lalu putar ulang nilai itu persis saat regenerasi — alih-alih menghitung ulang dari `input` kosong. Perubahan struktural kecil pada penyimpanan pesan.
- **Alasan ditunda.** Nilai kecil vs biaya perubahan struktur penyimpanan; ditunda sampai benar-benar terasa mengganggu. Konteks: bagian dari rangkaian perbaikan panel asisten (Stop/Regenerate, error inline, meter token akurat) — lihat commit `6c9bfbe`.

---

## Catatan

- Temuan bertanda 🟡 adalah **indikasi awal**, belum diverifikasi mendalam — jangan langsung dianggap bug sampai dikonfirmasi.
- Belum ada perubahan kode yang dilakukan; dokumen ini murni perencanaan.
- Verifikasi build/test setelah setiap perbaikan: `npm run lint` (type-check) + `npx vitest run`.
