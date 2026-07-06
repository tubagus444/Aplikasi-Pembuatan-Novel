# Rencana Audit & Perbaikan Kualitas Kode — AetherScribe

> **Arsip memori-proyek.** Audit kualitas kode bertahap atas 12 area inti.
> Semua pekerjaan berdampak SUDAH SELESAI (per 2026-06-21) — dokumen ini
> dipertahankan sebagai rekam **keputusan** (termasuk yang sengaja ditolak),
> bukan backlog aktif. Dirujuk oleh `CLAUDE.md`.

## Status: seluruh pekerjaan berdampak SELESAI

Semua temuan yang menyangkut **correctness, kehilangan data, keandalan, dan
keamanan-data telah diperbaiki** (area #1–#12). Aplikasi aman dipakai apa adanya.
Detail per-temuan (kode B/E/P/C/D/SV/BK/RG/L/LQ/ED/UI…) tak lagi direproduksi di
sini — sudah tertanam di kode + pesan commit; cukup ringkasan per-area di bawah.

## Ringkasan per-area

| # | Area | File utama | Hasil |
|---|------|-----------|-------|
| 1 | Orkestrasi AI & ketahanan | `src/services/ai/index.ts` | ✅ B1–B5, M1–M3 (sanitasi metadata error, race AbortController, circuit breaker, ekstrak `buildCachedContextBlock`) |
| 2 | Klasifikasi error & tipe | `src/services/ai/errors.ts` | ✅ union `AIErrorCode` dirapikan, deteksi 400/network, pesan Indonesia |
| 3 | Proxy AI (parsing response) | `src/services/ai/proxy.ts` | ✅ guard respons kosong, unwrap error server, idle-timeout stream, usage Claude native |
| 4 | Mesin konteks (worker) | `src/services/contextWorker.ts` | ✅ AC-first + embed background, cancel per-request, boundary imbuhan ID, konstanta skoring (C7/C10 diterima) |
| 5 | Skema & migrasi Dexie | `src/db.ts` | ✅ handler `versionchange`/`blocked`/`open().catch()`; D6 (konten default Inggris) dibiarkan — kosmetik |
| 6 | Server proxy | `server.ts` | ✅ limit body 25mb, validasi input, abort upstream, guard `headersSent`, helper `sendError` (SV-SEC out-of-scope) |
| 7 | Backup & sync Drive | `backupService.ts` dll | ✅ chatSessions ikut backup, deteksi gzip via magic bytes, refresh token GIS, persist folder handle; BK12 (`alert`/`confirm`) dibiarkan |
| 8 | RAG Orama (sinkronisasi) | `src/services/rag/*` | ✅ timeout search, reject pending, MUTATION_ERROR + retry; RG2/RG-ARCH catatan saja |
| 9 | Algoritma murni | `src/lib/{ahoCorasick,chunkEngine,loreUtils}.ts` | ✅ boundary imbuhan ID + `splitTrailingPunct` (+test); sehat |
| 10 | State & live query | `src/contexts/*`, `useOptimizedLiveQuery.ts` | ✅ short-circuit `JSON.stringify`, memo context value, urutan `deleteProject` |
| 11 | Editor TipTap | `src/features/editor/*` | ✅ ED1 data-loss flush (snapshot terkini), setContent tanpa emit, wiring ref stabil, generasi highlight |
| 12 | Panel UI raksasa | `SettingsPanel.tsx` dll | ✅ `SettingsPanel` dipecah (shell + tabs + sections + `useAISettings`); BiblePanel/Outline ditunda (besar karena JSX, risiko rendah) |

## Item sengaja TIDAK dikerjakan (keputusan, jangan dianalisis ulang)

| Item | Area | Sifat | Alasan |
|------|------|-------|--------|
| D6 | #5 | Kosmetik | Teks default proyek pertama berbahasa Inggris; pengguna langsung menimpa. |
| BK12 | #7 | Kosmetik/UX | `alert()`/`confirm()` masih dipakai (berfungsi normal) alih-alih toast app. |
| RG2 | #8 | Minor | Race init Orama sangat sempit; path utama tetap menemukan entri. |
| RG-ARCH | #8 | Dokumentasi | Pembagian peran 3 sistem relevansi; nol dampak runtime. |
| UI2 | #12 | Refactor | Pecah `BiblePanel`/`OutlinePanel`; besar karena JSX, risiko rendah. |
| A1 | lanjutan | Nuansa kualitas | Regen chat tak dijamin pakai konteks bab identik dgn kiriman asli; simpan `chapterContext` per-pesan bila kelak mengganggu (commit `6c9bfbe`). |
| C7, C10, SV-SEC, L3 | #4/#9/#6 | Diterima | Risiko rendah / out-of-scope per `CLAUDE.md`. |

## Catatan
- Verifikasi standar tiap perubahan kode: `npm run lint` (type-check) + `npx vitest run`.
- Hardening keamanan proxy (auth, rate-limit, SSRF Ollama) **sengaja out-of-scope** per `CLAUDE.md` (aplikasi pribadi satu-pengguna).
