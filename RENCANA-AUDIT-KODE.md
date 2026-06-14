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
| 4 | Mesin konteks (worker) | `src/services/contextWorker.ts` | P1 | ⬜ | 🔴 scan awal |
| 5 | Skema & migrasi Dexie | `src/db.ts` | P1 | ⬜ | 🔴 scan awal |
| 6 | Server proxy | `server.ts` | P1 | ⬜ | ⚪ |
| 7 | Backup & sync Drive | `src/services/backupService.ts`, `driveBackupService.ts`, `src/hooks/useAutoBackup.tsx` | P1 | ⬜ | ⚪ |
| 8 | RAG Orama (sinkronisasi) | `src/services/rag/*` | P1 | ⬜ | ⚪ |
| 9 | Algoritma murni | `src/lib/{ahoCorasick,chunkEngine,loreUtils}.ts` | P2 | ⬜ | ⚪ (ada test) |
| 10 | State & live query | `src/contexts/*`, `src/hooks/useOptimizedLiveQuery.ts` | P2 | ⬜ | ⚪ |
| 11 | Editor TipTap (save/highlight) | `src/features/editor/hooks/*`, `extensions/*` | P2 | ⬜ | ⚪ |
| 12 | Panel UI raksasa (refactor) | `SettingsPanel.tsx` (56KB), `BiblePanel.tsx` (51KB), `OutlinePanel.tsx` (38KB) | P2 | ⬜ | ⚪ |

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
**Status:** ⬜ · **Prioritas:** P1

**Temuan awal (🔴 dari scan):**
- 🟡 **`version(15)` identik dengan `version(14)`** (104–116) — versi tanpa perubahan skema, mungkin bekas migrasi yang dibatalkan; perlu dipastikan tidak ada `.upgrade()` yang hilang.
- 🟡 **Tidak ada penanganan gagal buka DB** (blocked/quota/versi lebih baru di tab lain) — `db` dibuat langsung (151) tanpa handler `on('blocked')`/error global.
- ⚪ Verifikasi integritas indeks (`*aliases`, `&[projectId+key]`) dan apakah seluruh tabel di `types.ts` punya indeks yang dipakai query.

**Tindakan:** _(diisi setelah analisa)_

---

### [#4] Mesin konteks (worker) — `src/services/contextWorker.ts`
**Status:** ⬜ · **Prioritas:** P1

**Temuan awal (🔴 dari scan):**
- 🟡 **Pekerjaan yatim (orphaned) saat timeout**: `contextEngine` punya timeout 30s, tapi worker tetap melanjutkan embedding setelah pemanggil menyerah → CPU terbuang.
- 🟡 **Kegagalan model embedding senyap**: bila download/inisialisasi model gagal hanya `console.error`; fitur semantik mati tanpa pemberitahuan & tanpa retry (85–96, 285–287).
- 🟡 **Angka ajaib skoring**: `ALPHA=60`, `filter > 20`, threshold lain hard-coded (134–139, 290–305) — perlu didokumentasikan/diuji.
- 🟡 **Duplikasi build relationship-graph** (juga ada di #1) — kandidat dipusatkan.

**Tindakan:** _(diisi setelah analisa)_

---

### [#6] Server proxy — `server.ts`
**Status:** ⬜ · **Prioritas:** P1 · **Belum di-scan**
> Catatan CLAUDE.md: hardening keamanan (auth, rate-limit, SSRF Ollama) **sengaja out-of-scope**. Fokus audit di sini: kebenaran penerusan request/error, penanganan timeout, parsing per-provider.

**Tindakan:** _(diisi setelah analisa)_

---

### [#7] Backup & sync Drive
**Status:** ⬜ · **Prioritas:** P1 · **Belum di-scan**
**Cek:** round-trip gzip (backup→restore), perilaku saat kuota penuh, refresh token OAuth, kegagalan backup yang senyap.

**Tindakan:** _(diisi setelah analisa)_

---

### [#8] RAG Orama (sinkronisasi) — `src/services/rag/*`
**Status:** ⬜ · **Prioritas:** P1 · **Belum di-scan**
**Cek:** konsistensi index dengan Dexie (stale?), kebenaran hook add/update/delete, penanganan kegagalan worker.

**Tindakan:** _(diisi setelah analisa)_

---

## FASE 3 — P2: Maintainability & kebersihan

### [#9] Algoritma murni — `src/lib/{ahoCorasick,chunkEngine,loreUtils}.ts`
**Status:** ⬜ · **Prioritas:** P2 · **Belum di-scan** (sudah ada unit test)
**Cek:** edge case (overlap match, unicode, boundary chunk), cakupan test.

### [#10] State & live query — `src/contexts/*`, `src/hooks/useOptimizedLiveQuery.ts`
**Status:** ⬜ · **Prioritas:** P2 · **Belum di-scan**
**Cek:** re-render berlebih, dependency array `useLiveQuery`, stale closure.

### [#11] Editor TipTap — `src/features/editor/hooks/*`, `extensions/*`
**Status:** ⬜ · **Prioritas:** P2 · **Belum di-scan**
**Cek:** race auto-save, performa highlight pada teks panjang.

### [#12] Panel UI raksasa — `SettingsPanel.tsx`, `BiblePanel.tsx`, `OutlinePanel.tsx`
**Status:** ⬜ · **Prioritas:** P2 · **Belum di-scan**
**Cek:** pemecahan komponen (file 38–56KB), pemisahan logika dari presentasi.

---

## Catatan

- Temuan bertanda 🟡 adalah **indikasi awal**, belum diverifikasi mendalam — jangan langsung dianggap bug sampai dikonfirmasi.
- Belum ada perubahan kode yang dilakukan; dokumen ini murni perencanaan.
- Verifikasi build/test setelah setiap perbaikan: `npm run lint` (type-check) + `npx vitest run`.
