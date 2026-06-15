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
- **Pantau** via kartu hit rate Dashboard; revert ke `{ type: 'ephemeral' }`
  bila pola pemakaian tak cocok.

### ✅ #3 — Routing model per-tugas
**Commit `f2e5c46`.** Tugas mekanis (`extract`, `summarize`) dirutekan ke model
tier-murah pada provider yang SAMA (key tetap satu): google→`gemini-2.5-flash-lite`,
claude→`haiku-3.5`, groq→`llama-8b`, openrouter→llama-free. rewrite/chat/expand
tetap model pilihan pengguna. Helper `getLightModelForProvider()` di `proxy.ts`.

---

## Belum dikerjakan

### ⬜ #4 — Cache riwayat percakapan chat (multi-breakpoint, Claude)
**Dampak: tinggi untuk pengguna chat-berat.**
Saat ini di chat, system prompt (lore) tercache tapi **riwayat percakapan
dikirim ulang penuh tiap giliran tanpa cache**. Claude mengizinkan **hingga 4
cache breakpoint** — tambahkan satu `cache_control` pada pesan riwayat terakhir
agar prefix percakapan ikut tercache.
- Lokasi: blok `claude` di `src/services/ai/proxy.ts` (susun `body.messages`).
- Hati-hati: taruh breakpoint pada batas yang stabil (jangan pada pesan yang
  masih bisa berubah). Riwayat sudah di-trim (10 di facade, 8 di proxy) —
  pastikan breakpoint konsisten antar-giliran agar prefix benar-benar match.
- Berlaku untuk Claude (dan mungkin OpenRouter→Anthropic). Google/Groq lewati.
- Prasyarat keputusan: idealnya setelah #4-data menunjukkan chat sering & panjang.

### ⬜ #5 — Tune `MAX_CACHED_LORE_CHARS` berbasis data
**Tunggu data Dashboard dulu (jangan tebak).**
50.000 char (~12.5k token) ditulis ke cache itu besar. Sekarang sudah ada alat
ukur (cache hit rate di Dashboard).
- Hit rate **tinggi** → biarkan.
- Hit rate **rendah** (sering edit lore di tengah sesi) → pertimbangkan turunkan,
  karena cache yang sering di-bust = sering bayar penuh menulis 12.5k token.
- Konstanta: `MAX_CACHED_LORE_CHARS` di `src/services/ai/index.ts`.
- **Keterbatasan inheren:** satu edit lore apa pun membatalkan cache (karena
  `buildCachedContextBlock` memuat seluruh codex+bible). Saran UX: kelompokkan
  editing lore dulu, baru menulis — jangan selang-seling.

### ⬜ #6 — Debounce / dedup panggilan kembar (opsional, dampak kecil-menengah)
- Hindari rewrite identik beruntun atau auto-summarizer menyalak untuk edit kecil.
- Auto-summarizer sudah cek `summaryUpdatedAt >= lastModified`; bisa ditambah
  debounce waktu agar tidak memicu pada tiap perpindahan bab cepat.

### ⬜ #7 — (Pertimbangan) UI override model tugas-ringan
Versi lengkap dari #3: tambah pilihan di Settings "model untuk tugas ringan"
agar pengguna bisa override default hardcoded. Hanya bila #3 default terasa
kurang pas. Nambah permukaan UI.

---

## Catatan verifikasi
- **Bukti caching bekerja:** `aiUsageLogs.cachedTokens > 0` → cache hit. Lihat
  kartu "Token dari Cache" di Dashboard.
- **Bukti routing bekerja:** kartu "Top Model" Dashboard menampilkan model murah
  (mis. flash-lite) terpisah dari model utama.
- Yang **tidak** perlu disentuh: RAG hibrida (Aho-Corasick + semantic + Orama),
  embedding ter-persist di IndexedDB, komputasi berat di worker, terseness prompt
  template — semua sudah solid.
