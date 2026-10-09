# Changelog — AetherScribe

Catatan riwayat perubahan arsitektur, fitur, perbaikan bug, dan dokumentasi di repositori AetherScribe. Entri terbaru selalu berada di bagian teratas.

---

## 2026-10-09

### [UI/UX] Redesain Footer Utilitas Sistem pada Sidebar
- Mengubah footer tombol sistem di `Sidebar.tsx` dari 3 tombol teks horizontal yang padat dan berdesakan menjadi **Minimalist Icon Dock Bar** (gaya VS Code/Figma).
- Menambahkan label section ringkas "SISTEM" dengan tipografi harmonis (`tracking-[0.18em]`) serta tombol ikon proporsional (Pengaturan, Panduan, Log Error) dengan tooltip dan dukungan auto-close pada layar mobile (<768px).
- **File yang berubah:**
  - `src/components/layout/Sidebar.tsx`
  - `docs/features.md`
  - `docs/changelog.md`

---

## 2026-10-08

### [Refactor] Arsitektur Dokumentasi Modular
- Memecah dokumentasi monolitik dari `CLAUDE.md` dan `AGENTS.md` ke dalam format modular di direktori `docs/` (`overview.md`, `architecture.md`, `features.md`, `database.md`, `api.md`, `decisions.md`, `changelog.md`).
- Merampingkan `CLAUDE.md` dan `.agents/AGENTS.md` menjadi pengarah ringkas di bawah 80 baris dengan klausul aturan wajib pembaruan dokumentasi.
- **File yang berubah:**
  - `docs/overview.md` (baru)
  - `docs/architecture.md` (baru)
  - `docs/features.md` (baru)
  - `docs/database.md` (baru)
  - `docs/api.md` (baru)
  - `docs/decisions.md` (baru)
  - `docs/changelog.md` (baru)
  - `CLAUDE.md`
  - `.agents/AGENTS.md`

---

## 2026-10-07

### [Refactor] Konsolidasi Tracker Root ke ROADMAP.md
- Merapikan dan memindahkan 5 file rencana/audit historis dari root direktori ke `docs/archive/` (`RENCANA-AUDIT-KODE.md`, `RENCANA-OPTIMASI-AI.md`, `RENCANA-ATLAS-DUNIA.md`, `ARSIP-AUDIT-FABLE.md`, `ARSIP-FITUR-WORLDBUILDING.md`).
- Membuat tracker aktif tunggal `ROADMAP.md` di root untuk memantau sisa tugas riil (Fase 2 Kalender Dunia, optimasi memory worker backup, Unicode PDF).
- **File yang berubah:**
  - `ROADMAP.md` (baru)
  - `docs/archive/*` (baru)
  - `CLAUDE.md`
  - `.agents/AGENTS.md`
  - `.gitignore`

---

## 2026-07-07

### [DB] [Fitur] Triase Temuan Peta Kontinuitas & Kalender AI Bridge
- Menambahkan tabel `continuityTriage` pada skema Dexie versi 33 untuk menyimpan status temuan kontinuitas yang diabaikan/disembunyikan oleh penulis.
- Memperbarui `buildTimelineSummary` agar menyertakan rentang tanggal kalender dunia terstruktur (`formatDateRange`) ke dalam konteks prompt AI.
- **File yang berubah:**
  - `src/db.ts`
  - `src/types.ts`
  - `src/features/consistency/components/ContinuityDashboard.tsx`
  - `src/lib/timelineSummary.ts`
  - `src/lib/importRemap.ts`

---

## 2026-07-06

### [Fitur] [DB] Atlas Dunia v1.0 s/d v2.1
- Implementasi panel peta interaktif Leaflet CRS.Simple (tabel `maps` dan `mapMarkers` skema Dexie v32).
- Penambahan penanda pin, poligon area wilayah, polyline rute, kalibrasi skala dan jarak nyata, deteksi wilayah yatim, dan navigasi sub-peta bertingkat (*hierarchical sub-maps*).
- **File yang berubah:**
  - `src/features/atlas/*`
  - `src/lib/mapGeometry.ts`
  - `src/lib/atlasAnalytics.ts`
  - `src/lib/atlasHierarchy.ts`
  - `src/db.ts`
  - `src/types.ts`

---

## 2026-07-03

### [Fitur] Papan Faksi, Graf Lore Visual & Heatmap Pacing
- Menambahkan kanvas visualisasi relasi faksi berbasis React Flow (`factionBoard`).
- Menambahkan visualisasi graf lore interaktif menggunakan Web Worker (`loreGraphWorker.ts`).
- Mengimplementasikan Heatmap tensi per bab dengan estimasi otomatis berbasis rasio dialog.
- **File yang berubah:**
  - `src/features/lore/components/FactionsPanel.tsx`
  - `src/features/codex/components/LoreGraphPanel.tsx`
  - `src/features/consistency/components/PacingHeatmapPanel.tsx`
  - `src/lib/pacingHeatmap.ts`
  - `src/lib/loreGraph.ts`
