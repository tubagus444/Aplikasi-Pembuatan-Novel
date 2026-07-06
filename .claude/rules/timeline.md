---
paths:
  - "src/features/timeline/**"
  - "src/lib/worldCalendar.ts"
---

# Timeline & Kalender Dunia (#4)

**Kalender Dunia (`viewMode 'worldcalendar'`) = TAMPILAN visual atas tabel `timeline` yang SAMA, bukan data tandingan.** Penanggalan in-world = dua bentuk field inert (NOL tabel baru, pola `tension`/`worldStatus`/`namePalette`):
- **`Project.calendar?: WorldCalendar`** (`{eras[], weekdays[], months[{name,days}], seasons[{name,fromMonth,toMonth,color}]}` — urutan array `eras` = urutan kronologis, tiap era mulai ulang Tahun 1)
- **`TimelineEvent.startDate?/endDate?: WorldDate`** (`{era,year,month,day}`; `era`=indeks ke `calendar.eras`, `month`/`day` 1-based; `endDate` = rentang).

Skema Dexie **v31** no-op append-only (semua tak diindeks) → menumpang objek `projects`/`timeline` → **backup/impor/`deleteProject` TAK berubah**. **Tautan event→Codex sengaja PAKAI ULANG `characterIds`** (sudah menautkan ke SEMUA jenis Codex & sudah di-remap di `importRemap`) — BUKAN field `codexIds` baru (akan jadi FK duplikatif); jadi importRemap tak disentuh.

**Sumber tunggal logika = `src/lib/worldCalendar.ts` (murni, +25 tes):** `compareDate` (kunci urut era→year→month→day), `dayOfWeek` (dihitung dari AWAL era secara kumulatif — offset kolom grid pakai `weekdayOfFirst`, bukan asumsi mockup "tiap bulan mulai kolom 1"), `addDays`/`daysBetween` (dalam SATU era; lintas-era → `null` karena tiap era reset Tahun 1), `seasonForMonth` (sadar rentang membungkus akhir tahun), `formatDate`/`formatDateRange`, `calendarPreset` (`gregorian`/`fantasy`/`blank`)/`emptyCalendar`. Grid/pita musim/pita tahun/pengelompokan Era→Tahun = **turunan murni** atas `calendar`+event.

**UI:** `WorldCalendarPanel` (empty-state preset picker → grid + detail hari + daftar Era→Tahun), `CalendarEditorModal` (susun era ↑↓/minggu/bulan/musim + preset → `db.projects.update`), `CalendarEventModal` (tanggal terstruktur + toggle rentang + tautan bab/`characterIds` → `db.timeline`).

**Event tanpa `startDate` TETAP muncul di panel Timeline Cerita lama, tak di grid** (tak ada duplikasi). **Jembatan tampilan:** `TimelinePanel` memuat `project.calendar` dan menampilkan tanggal terstruktur (`formatDateRange`, chip ungu) bila event punya `startDate`, jatuh ke label teks bebas `eventDate` bila tidak. Field `eventDate` di form Timeline diberi label "Catatan waktu (bebas)" + hint peran; keduanya field terpisah (bebas vs terstruktur), tak saling menimpa. Aturan deterministik `flagCharactersForChapter`/`continuity` memakai `chapterId`+`characterIds`+urutan bab (BUKAN tanggal), jadi event dari kedua panel memberinya makan setara; pemakaian tanggal untuk cek = Fase 2.

**Fase 2 (cek kelayakan tanggal — tanggal mundur antar-bab, peristiwa di luar rentang induk, selang tak konsisten) sengaja BELUM dibangun** — "gratis" dari struktur `WorldDate`; suplai temuan ke `continuity.ts`/grid, jangan bikin panel baru. Detail di #4 `RENCANA-FITUR-WORLDBUILDING.md`. **Saat menambah analitik/tampilan kalender baru, turunkan dari `worldCalendar.ts` + tes — jangan tambah tabel/FK.**
