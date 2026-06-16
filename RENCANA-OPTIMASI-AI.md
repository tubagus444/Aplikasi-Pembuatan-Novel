# RENCANA-OPTIMASI-AI.md

Tracker optimasi penggunaan AI: **hemat token, kualitas tetap maksimal.**
Status: ✅ selesai · 🔄 berjalan · ⬜ belum.

Konteks produk: aplikasi pribadi satu-pengguna, BYOK (kunci di sisi klien),
local-first. Jalur AI: `src/services/ai/index.ts` (facade) → `proxy.ts` →
`server.ts` → provider. Lihat `CLAUDE.md` untuk arsitektur lengkap.

---

## Sudah dikerjakan

### ✅ #0 — Aktifkan prompt caching trio (Claude / Google / OpenRouter)
**Commit `57ef648`.** Masalah: "caching mode" membangun system prompt statis
(full Story Bible + Codex) tapi directive cache provider tak pernah dipasang →
tak ada diskon, malah mengirim ~12.5k token lore tiap panggilan.
- Claude: `cache_control` ephemeral pada blok `system` + header `anthropic-beta`.
- OpenRouter: system message multipart dengan `cache_control` (diteruskan ke hulu).
- Google: default model dinaikkan ke `gemini-2.5-flash` (implicit caching seri 2.5).
- `logUsageToDB` mencatat `cachedTokens` lintas-provider + perbaiki prompt token Google.
- Dashboard: kartu "Token dari Cache" + cache hit rate (7 hari).

### ✅ #1 — Plafon `max_tokens` per-aksi
**Commit `57ef648`.** rewrite adaptif (512–4000, ~2.5× token seleksi), chat 2048,
extract 1500, expand 1000, summarize 700. Plafon (jaring pengaman terhadap output
liar), bukan target.

### ✅ #2 — Extended TTL cache Claude (1 jam)
**Commit `7e8aec9`.** `cache_control: { type: 'ephemeral', ttl: '1h' }` +
beta `extended-cache-ttl-2025-04-11`. Menjaga cache hangat melewati jeda
berpikir/mengetik dalam satu sesi. Hanya Claude langsung (OpenRouter tetap 5
menit; Google pakai TTL implicit sendiri).
- **Trade-off:** write 1h = 2× input vs 1.25× untuk 5-menit. Net-win bila ≥3
  panggilan per sesi; sedikit rugi bila "colek sekali lalu tutup".
- **Pantau** via kartu hit rate Dashboard; kini bisa dialihkan ke 5 menit lewat Settings
  (lihat #P5) bila pola pemakaian tak cocok — tak perlu edit kode lagi.

### ✅ #3 — Routing model per-tugas
**Commit `f2e5c46`.** Tugas mekanis (`extract`, `summarize`) dirutekan ke model
tier-murah pada provider yang SAMA (key tetap satu): google→`gemini-2.5-flash-lite`,
claude→`haiku-3.5`, groq→`llama-8b`, openrouter→llama-free. rewrite/chat/expand
tetap model pilihan pengguna. Helper `getLightModelForProvider()` di `proxy.ts`.

### ✅ #8 — Bersihkan payload Story Bible (slug→label, buang baris kosong, cap notes)
**Masalah:** Story Bible (dikirim ke AI di semua jalur konteks) punya tiga
inefisiensi/cacat. (1) Genre/tone/POV/pacing terkirim sebagai slug/JSON mentah
(`POV: 3rd-limited`, `Genre: ["epic","dark"]`) → sinyal terdegradasi. (2) Field
yang diisi-lalu-dikosongkan menyisakan baris kosong (`Tagline: `, genre `"[]"`)
yang tetap dikirim → buang token + noise. (3) Catatan Penulis (free-text, bisa
membengkak) selalu dikirim PENUH di mode caching → bayar penuh tiap cache bust.
- Sumber kebenaran tunggal `src/lib/storyBible.ts`: tabel label + helper
  `formatBibleInstruction` (slug→label), `hasBibleValue` (filter kosong, sadar
  `"[]"`), `formatBibleBlock` (filter+format+join), cap per-key `capForAI`.
- Diterapkan di 4 jalur: `buildCachedContextBlock`, `buildContextBlock` (RAG +
  minimal) di `index.ts`, dan token-meter `PREVIEW_CONTEXT_TOKENS` di
  `contextWorker.ts` (agar meter cocok dengan yang benar-benar dikirim).
- **Cap Catatan Penulis = 2000 char**, plafon (bukan target) HANYA pada payload
  AI; storage Dexie tetap utuh. Pemangkasan dari awal → taruh directive kritis di
  awal atau di Premis/Tema (tak dibatasi). Konstanta `BIBLE_AI_MAX_CHARS`.
- Bonus konsistensi: `__STORY_TAGLINE__` & `__TARGET_AUDIENCE__` kini masuk
  `ALWAYS_INCLUDE`/fallback RAG (sebelumnya tagline tak pernah sampai ke AI, dan
  `__TARGET_AUDIENCE__` adalah key yang dinanti engine tapi tanpa UI — kini ada).

### ✅ #4 — Cache riwayat percakapan chat (multi-breakpoint, Claude)
**Dampak: tinggi untuk pengguna chat-berat.** Sebelumnya system prompt (lore)
tercache tapi riwayat percakapan dikirim ulang penuh & dibayar penuh tiap giliran.
- Blok `claude` di `src/services/ai/proxy.ts` kini menandai **pesan riwayat
  terakhir** dengan `cache_control: { type: 'ephemeral', ttl: '1h' }` saat
  `cacheable` (chat) & ada riwayat → prefix percakapan (system + riwayat) ikut
  tercache; giliran berikut hanya bayar pesan baru. Breakpoint ke-2 (system = ke-1),
  masih di bawah batas 4 breakpoint Anthropic.
- `userPrompt` (RAG scene dinamis) berada SETELAH breakpoint → tak membatalkan
  prefix yang tercache.
- **Keterbatasan inheren:** begitu riwayat melewati `MAX_PROXY_HISTORY` (8), jendela
  geser mengubah prefix → cache riwayat miss (system tetap hit). Untuk chat
  ≤5 giliran cache penuh; lebih dari itu hanya kehilangan diskon riwayat, bukan
  system. Cukup untuk pola pemakaian tipikal.
- Belum dipasang untuk OpenRouter→Anthropic (string `content` biasa); bisa jadi
  follow-up bila pengguna chat-berat via OpenRouter. Google/Groq lewati (TTL implicit
  / tak mendukung).

### ✅ #9 — Knowledge base dibagi lintas-aksi (KB-first, blok cache terpisah)
**Dampak: tinggi.** Subsumes P0 + P1 dari audit lanjutan.
**Masalah:** cache provider bersifat **prefix-based**, tapi template prompt menaruh
instruksi aksi (berbeda per aksi) di DEPAN dan knowledge base (identik) di BELAKANG
(`CONTEXT:`/`LORE:`/`KNOWLEDGE BASE:`). Akibatnya prefix tiap aksi beda dari karakter
pertama → `rewrite`, `chat`, dan `consistency` masing-masing **menulis cache ~14k token
sendiri-sendiri** untuk KB yang sama. Diperparah TTL 1 jam Claude (biaya tulis 2×), dan
`checkConsistency` (sekali per bab) menulis cache yang tak pernah dibaca ulang.
- **Pisah KB dari instruksi.** Field baru `cachedContext` di `AIRenderParams` membawa
  KB statis (output `buildCachedContextSegments`, identik lintas-aksi; lihat #P3 untuk
  tiering segmen); `systemInstruction` menyisakan instruksi aksi saja. Diisi hanya di
  caching mode (`index.ts`: `processRewrite`/`processChat`/`checkConsistency`).
- **Rakit KB-first di `proxy.ts`.** Claude: blok system PERTAMA = KB (cache_control 1h),
  blok kedua = instruksi (separator `\n\n` di blok kedua agar KB tetap byte-identik).
  OpenRouter: multipart, cache_control pada bagian KB. Google: KB di depan
  `systemInstruction` → prefix identik untuk implicit caching 2.5. Groq/Ollama: gabung
  string biasa (KB→instruksi).
- **Efek:** aksi kedua dst MEMBACA cache KB (~0.1× Claude) alih-alih menulis ulang. Chat
  juga berbagi blok KB **antar-mode** (prose-review/plot-check/brainstorm). **P1 lunas
  otomatis:** consistency kini ikut cache bersama — cek 5 bab beruntun = 1 tulis + 4 baca,
  bukan 5 tulis buangan. Selaras best practice Anthropic (konteks statis di atas).
- **Timeline consistency** sengaja TIDAK masuk `cachedContext` (akan membuat segmen KB beda
  dari rewrite/chat); ia menyusul di blok instruksi (kecil, story-wide → sering sama
  antar-bab).
- **Bonus:** estimasi fallback `logUsageToDB` kini menyertakan `cachedContext` (mencegah
  under-count saat usage absen).

### ✅ #P2 — Cache riwayat percakapan chat (OpenRouter)
**Dampak: tinggi untuk pengguna chat-berat via OpenRouter.** Analog #4 (Claude native).
Sebelumnya riwayat percakapan untuk OpenRouter dikirim ulang penuh & dibayar penuh tiap
giliran (hanya `content` string). Kini di cabang OpenAI-compat `proxy.ts`, saat
`cacheable` (chat) & ada riwayat → **pesan riwayat terakhir ditandai `cache_control`
multipart**, diteruskan OpenRouter ke Anthropic hulu → prefix percakapan ikut tercache,
giliran berikut hanya bayar pesan baru. Gemini hulu mengabaikan penanda (tanpa error).
Keterbatasan inheren sama dengan #4: begitu riwayat melewati jendela geser, cache riwayat
miss (system/KB tetap hit).

### ✅ #P3 — Tier cache Bible (stabil) vs Codex (volatil)
**Menjawab keterbatasan "satu edit lore membatalkan seluruh KB" dari #9/#5.**
`buildCachedContextSegments` kini mengembalikan **segmen ber-tier** `[Story Bible,
Codex+graph]` (bukan satu string). Di `proxy.ts`, tiap segmen jadi blok system + **cache
breakpoint sendiri** (Claude: blok array; OpenRouter: multipart). Karena Bible (jarang
berubah) ada di prefix sebelum Codex (sering diedit), **edit satu entri Codex hanya
membatalkan segmen Codex; prefix Bible tetap hit.** `cachedContext: string[]` di
`AIRenderParams`; jalur non-caching/Google memulihkan blok tunggal via `join('\n\n')`.
- Breakpoint per chat Claude: Bible + Codex + riwayat = 3 (≤4 batas Anthropic).
- **Catatan ambang:** bila Bible < minimum cacheable provider (~1024 token), breakpoint
  Bible diabaikan tanpa error → efektif kembali satu-tier (tak ada regresi).

### ✅ #P4 — Akurasi estimasi token fallback (`logUsageToDB`)
**Bukan penghematan token, tapi memperbaiki data untuk keputusan tuning.** Saat provider
tak mengirim usage metadata, `logUsageToDB` mengestimasi dari panjang teks. Estimasi itu
dulu hanya menjumlah `userPrompt + systemInstruction` → **meremehkan** prompt karena
mengabaikan (a) `cachedContext` (KB, dipisah di #P0) dan (b) **riwayat chat**.
- KB ditambahkan saat #P0; riwayat ditambahkan di sini — dihitung dari `MAX_PROXY_HISTORY`
  pesan terakhir (persis yang dikirim `callProxy`) agar estimasi cocok payload nyata.
- Dampak: kartu token/biaya Dashboard tak lagi bias-rendah untuk chat-berat → keputusan
  cap lore (#5) / TTL dibuat di atas angka yang benar. Provider utama (Claude/Google/
  OpenRouter) tetap mengirim usage asli, jadi ini murni jaring pengaman saat metadata absen.

### ✅ #P5 — TTL cache Claude jadi tunable (versi lengkap #2)
**Opsi tuning, bukan perbaikan pemborosan.** Anthropic menagih **premi tulis** cache:
1.25× untuk 5 menit, 2× untuk 1 jam (baca tetap 0.1×). Sebelumnya TTL hardcoded 1 jam.
- **1 jam (default):** cache bertahan melewati jeda berpikir/mengetik → optimal untuk sesi
  panjang yang banyak baca cache. **Makin terjustifikasi setelah #0/#9:** KB kini dibagi
  semua aksi → satu sesi otomatis menghasilkan banyak baca per tulis.
- **5 menit:** premi tulis lebih murah → lebih hemat untuk pola "colek sesekali lalu tutup"
  di mana cache jarang sempat dibaca ulang.
- Sumber tunggal `getClaudeCacheTtl()` di `src/lib/aiTuning.ts` (baca `ai_claude_cache_ttl`,
  default `'1h'`, nilai tak dikenal → 1 jam). Dipakai `proxy.ts` di **tiga** titik
  cache_control Claude (segmen KB + fallback blok tunggal + breakpoint riwayat). UI:
  Settings → "Optimasi AI Lanjutan" → "Masa Hidup Cache (Claude)".
- **Scope Claude langsung saja.** OpenRouter tetap 5 menit (`{ type: 'ephemeral' }`); Google
  pakai TTL implicit-nya sendiri. Header beta `extended-cache-ttl` di `server.ts` dibiarkan
  (tak berbahaya saat 5 menit). Pantau pengaruhnya via kartu hit rate Dashboard.

---

## Belum dikerjakan

_(kosong — semua item actionable dari audit lanjutan selesai.)_

---

## Selesai (lanjutan)

### ✅ #5 — `MAX_CACHED_LORE_CHARS` jadi tunable (keputusan diserahkan ke data pengguna)
Daripada menebak satu angka, cap kini **bisa diatur pengguna** dari Settings →
"Optimasi AI Lanjutan" → "Maks. Lore di Cache" (preset 25k/50k/75k/100k char),
sehingga keputusan tuning dibuat berdasarkan *cache hit rate* nyata di Dashboard.
- Sumber tunggal: `getMaxCachedLoreChars()` di `src/lib/aiTuning.ts` (baca
  `ai_max_cached_lore_chars` localStorage, default 50k, di-clamp 10k–100k).
- Dipakai di `buildCachedContextBlock` (`src/services/ai/index.ts`). Worker meter
  (`contextWorker.ts`) **tak bisa baca localStorage** → nilai diteruskan lewat
  payload `PREVIEW_CONTEXT_TOKENS` dari `previewContextTokens` (`contextEngine.ts`,
  main thread). Konstanta hardcoded duplikat di kedua tempat dihapus.
- **Keterbatasan inheren tetap:** satu edit lore apa pun membatalkan cache (karena
  `buildCachedContextBlock` memuat seluruh codex+bible). Saran UX: kelompokkan
  editing lore dulu, baru menulis — jangan selang-seling.

### ✅ #7 — UI override model tugas-ringan
Versi lengkap #3. Settings → "Optimasi AI Lanjutan" → "Model Tugas Ringan"
meng-override default hardcoded per **provider terpilih** (kosong = pakai default).
- `getLightModelForProvider()` (`src/services/ai/proxy.ts`) baca
  `ai_light_model_<provider>` dulu, fallback ke `LIGHT_MODELS`. Default tetap
  diekspos via `getDefaultLightModelForProvider()` untuk placeholder UI.
- Ollama dilewati (tak punya tier ringan terpisah).

### ✅ #6 — Debounce / dedup panggilan kembar
- **Auto-summarizer** (`src/hooks/useAutoSummarizer.tsx`): ringkasan bab yang
  ditinggalkan kini **di-debounce 8 dtk per-bab**, jadi perpindahan bab cepat
  (A→B→C) tak memicu satu panggilan AI per bab — hanya bab yang benar-benar
  ditinggalkan ≥8 dtk. Kembali ke sebuah bab membatalkan ringkasan tertundanya
  (masih diedit). Guard `inFlight` (Set chapterId) mencegah panggilan kembar untuk
  bab yang sama bila pemicu bertumpuk. Timer dibersihkan saat unmount.
- **Rewrite** (`processRewrite` di `src/services/ai/index.ts`): dedup **in-flight
  konkuren** — panggilan rewrite identik (`provider|action|prompt|selection`) yang
  masih berjalan berbagi satu promise → cegah double-fire tak sengaja. Sengaja
  **tidak** cache-and-return hasil: tombol "regenerate" menjalankan ulang untuk
  variasi (temp 0.85); panggilan berurutan tetap fresh karena entri terhapus saat
  selesai.

---

## Catatan verifikasi
- **Bukti caching bekerja:** `aiUsageLogs.cachedTokens > 0` → cache hit. Lihat
  kartu "Token dari Cache" di Dashboard.
- **Bukti routing bekerja:** kartu "Top Model" Dashboard menampilkan model murah
  (mis. flash-lite) terpisah dari model utama.
- Yang **tidak** perlu disentuh: RAG hibrida (Aho-Corasick + semantic + Orama),
  embedding ter-persist di IndexedDB, komputasi berat di worker, terseness prompt
  template — semua sudah solid.
