---
paths:
  - "src/services/backupService.ts"
  - "src/services/driveBackupService.ts"
  - "src/lib/importRemap.ts"
  - "src/lib/backupRetention.ts"
  - "src/contexts/ProjectContext.tsx"
---

# Pencadangan, impor/ekspor & remap FK

**`src/services/backupService.ts` adalah sumber tunggal.** `collectAllData`/`restoreData` dipakai SEMUA jalur (internal tabel `backups`, folder lokal via File System Access API, Google Drive).

Jebakan & konvensi:
1. Deteksi gzip lewat **magic bytes `0x1f 0x8b`, bukan ekstensi** (BK4) — jangan pakai nama file untuk memutuskan dekompresi.
2. `restoreData` = clear+refill **semua tabel dalam satu transaksi atomik**; `embeddings`/`sceneEmbeddings` di-clear (bukan dipulihkan) untuk regenerasi; sebelum menimpa, snapshot **pra-pemulihan** otomatis ditulis ke `backups` (`kind:'pre-restore'`, tak ikut di-clear = jaring undo).
3. Integritas via **checksum SHA-256** (`computeChecksum`, `BackupData.version` 5) diverifikasi SEBELUM sentuh DB.
4. Retensi **berjenjang** (grandfather-father-son) di `src/lib/backupRetention.ts` (murni, teruji), dipakai ketiga lapisan.
5. **Degradasi kuota (BK#1):** `saveToInternalDB` menambah via `addBackupResilient` — bila `db.backups.add` melempar error kuota (`isQuotaError`), buang cadangan 'auto' TERTUA (`selectBackupToEvict`, murni+teruji) lalu retry, berulang. **Jangan kembalikan ke `add` lugas sebelum rotasi** (gagal justru saat penyimpanan penuh). Selalu pertahankan semua `pre-restore` (undo) + 1 `auto` terbaru; menyerah dengan pesan jelas bila tak ada lagi yang aman dibuang. Rotasi berjenjang normal tetap jalan SETELAH add berhasil.
6. **Serialisasi sekali (BK#8):** `saveToInternalDB` men-stringify data besar **sekali** (`dataString`) lalu merakit envelope lewat `assembleBackupJson` (`src/lib/backupEnvelope.ts`, murni+teruji) — **jangan** kembali men-stringify `payload` penuh setelah menghitung checksum (dulu 2×/siklus → jank). Checksum tetap dihitung atas `dataString` (data ramping); kontrak restore = `computeChecksum(JSON.stringify(parsedData.data))`, mengandalkan idempotensi `stringify(parse(x))===x`. Catatan: `collectAllData` masih stringify data penuh sekali untuk checksum folder/Drive (offload worker/lazy = ditunda, lihat tracker #8).

**Ekspor/impor per-novel (#4):** `collectProjectData(projectId)` menyaring satu proyek & menandai file `scope:'project'`; **impor = proyek BARU, non-destruktif** (`importProjectData` HANYA `add`/`bulkAdd`, tak pernah clear/update/delete) karena PK numerik `++id` tak unik lintas-ekspor → **seluruh foreign-key di-remap** oleh `src/lib/importRemap.ts` (murni, teruji: `remapProjectDependents` + peta FK eksplisit + `importedProjectName`).

## ⚠️ Aturan sinkron wajib saat menambah tabel/FK project-scoped
**Perbarui peta FK di `importRemap.ts` DAN daftar hapus di `ProjectContext.deleteProject` — kalau tidak, impor salah-tunjuk atau penghapusan proyek meninggalkan yatim.** Juga daftarkan tabel baru di `backupService` (collect/restore/project). Guard dua arah: jalur restore-penuh MENOLAK file `scope:'project'` (akan menghapus proyek lain), tombol "Impor Novel" MENOLAK cadangan penuh. UI di `settings/sections/ManualBackupSection.tsx`.

## Backup Google Drive
`useAutoBackup` — backup berkala terkompresi gzip ke tabel `backups`; sinkronisasi + restore Google Drive opsional (`driveBackupService.ts`, `googleAuth.ts`, BYOK). `firebase-applet-config.json` berisi nilai placeholder — sinkronisasi Firebase bersifat opt-in dan config asli berasal dari pengguna, bukan file ini.
