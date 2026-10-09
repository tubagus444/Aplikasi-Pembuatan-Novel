/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Audit Kronologi Waktu (#4 Fase 2) — pemeriksaan kontinuitas linimasa & bab
 * secara murni deterministik (0 token AI).
 *
 * Mendeteksi:
 * 1. Urutan tanggal mundur antar-bab (Chapter.order bertambah tapi tanggal mundur)
 * 2. Urutan tanggal terbalik dalam satu bab yang sama
 * 3. Rentang tanggal tidak valid (endDate < startDate)
 *
 * Mampu mengenali penanda kilas balik (flashback / analepsis) secara otomatis
 * agar tidak menimbulkan alarm palsu yang mengganggu penulis.
 */

import { TimelineEvent, WorldCalendar } from '@/src/types';
import { compareDate, daysBetween, formatDate } from '@/src/lib/worldCalendar';

export type ChronologyAnomalyType =
  | 'retrograde-chapter'
  | 'retrograde-same-chapter'
  | 'invalid-range';

export interface ChapterRef {
  id?: number;
  title: string;
  order: number;
}

export interface ChronologyAnomaly {
  id: string;
  type: ChronologyAnomalyType;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  chapterA?: ChapterRef;
  chapterB?: ChapterRef;
  eventA?: TimelineEvent;
  eventB: TimelineEvent;
  daysDiff: number | null;
  isFlashback: boolean;
}

export const FLASHBACK_REGEX = /\b(flashback|kilas\s*balik|analepsis|ingatan|masa\s*lalu|nostalgia|kenangan|memori)\b/i;

/**
 * Pindai seluruh peristiwa linimasa terhadap struktur bab manuskrip untuk
 * mendeteksi konflik kronologis.
 */
export function auditChronology(
  chapters: ChapterRef[],
  events: TimelineEvent[],
  calendar: WorldCalendar
): ChronologyAnomaly[] {
  const anomalies: ChronologyAnomaly[] = [];

  const chapterMap = new Map<number, ChapterRef>();
  chapters.forEach(c => {
    if (c.id != null) chapterMap.set(c.id, c);
  });

  const sortedChapters = [...chapters]
    .filter((c): c is ChapterRef & { id: number } => c.id != null)
    .sort((a, b) => a.order - b.order);

  // 1. Cek rentang tidak valid (endDate < startDate)
  for (const ev of events) {
    if (!ev.startDate || !ev.endDate) continue;
    if (compareDate(ev.endDate, ev.startDate) < 0) {
      anomalies.push({
        id: `invalid-range-${ev.id ?? ev.order}`,
        type: 'invalid-range',
        severity: 'high',
        title: `Rentang peristiwa "${ev.title}" terbalik`,
        detail: `Tanggal akhir (${formatDate(calendar, ev.endDate)}) mendahului tanggal mulai (${formatDate(calendar, ev.startDate)}).`,
        eventB: ev,
        daysDiff: daysBetween(calendar, ev.startDate, ev.endDate),
        isFlashback: false,
      });
    }
  }

  // Petakan peristiwa bertanggal ke bab
  const eventsByChapter = new Map<number, TimelineEvent[]>();
  for (const ev of events) {
    if (!ev.startDate || ev.chapterId == null) continue;
    if (!chapterMap.has(ev.chapterId)) continue;
    if (!eventsByChapter.has(ev.chapterId)) {
      eventsByChapter.set(ev.chapterId, []);
    }
    eventsByChapter.get(ev.chapterId)!.push(ev);
  }

  // 2. Cek urutan tanggal terbalik di bab yang sama (berdasarkan event.order)
  for (const [chId, chEvents] of eventsByChapter.entries()) {
    if (chEvents.length < 2) continue;
    const sortedByOrder = [...chEvents].sort((a, b) => a.order - b.order);
    const ch = chapterMap.get(chId)!;

    for (let i = 0; i < sortedByOrder.length - 1; i++) {
      const evA = sortedByOrder[i];
      const evB = sortedByOrder[i + 1];
      if (compareDate(evB.startDate!, evA.startDate!) < 0) {
        const isFb =
          FLASHBACK_REGEX.test(evB.title) ||
          FLASHBACK_REGEX.test(evB.description || '') ||
          FLASHBACK_REGEX.test(ch.title);

        anomalies.push({
          id: `same-chapter-${evA.id ?? evA.order}-${evB.id ?? evB.order}`,
          type: 'retrograde-same-chapter',
          severity: isFb ? 'low' : 'medium',
          title: isFb
            ? `[Kilas Balik] Urutan waktu terbalik di bab "${ch.title}"`
            : `Urutan waktu terbalik di bab "${ch.title}"`,
          detail: `Peristiwa "${evB.title}" (${formatDate(calendar, evB.startDate!)}) berada setelah "${evA.title}" (${formatDate(calendar, evA.startDate!)}) pada linimasa bab, namun tanggal mulainya lebih awal.`,
          chapterA: ch,
          chapterB: ch,
          eventA: evA,
          eventB: evB,
          daysDiff: daysBetween(calendar, evA.startDate!, evB.startDate!),
          isFlashback: isFb,
        });
      }
    }
  }

  // 3. Cek urutan tanggal mundur antar-bab
  // Lacak titik waktu terjauh yang dicapai oleh bab-bab terdahulu
  interface Frontier {
    chapter: ChapterRef & { id: number };
    event: TimelineEvent;
  }

  let latestFrontier: Frontier | null = null;

  for (const ch of sortedChapters) {
    const chEvents = eventsByChapter.get(ch.id);
    if (!chEvents || chEvents.length === 0) continue;

    // Cari tanggal paling awal dan paling akhir di bab ini
    let earliestInChapter = chEvents[0];
    let latestInChapter = chEvents[0];

    for (const ev of chEvents) {
      if (compareDate(ev.startDate!, earliestInChapter.startDate!) < 0) {
        earliestInChapter = ev;
      }
      const refDate = ev.endDate ?? ev.startDate!;
      const curLatestRef = latestInChapter.endDate ?? latestInChapter.startDate!;
      if (compareDate(refDate, curLatestRef) > 0) {
        latestInChapter = ev;
      }
    }

    if (latestFrontier) {
      const prevDate = latestFrontier.event.endDate ?? latestFrontier.event.startDate!;
      if (compareDate(earliestInChapter.startDate!, prevDate) < 0) {
        const isFb =
          FLASHBACK_REGEX.test(earliestInChapter.title) ||
          FLASHBACK_REGEX.test(earliestInChapter.description || '') ||
          FLASHBACK_REGEX.test(ch.title);

        const days = daysBetween(calendar, prevDate, earliestInChapter.startDate!);

        anomalies.push({
          id: `retro-chap-${latestFrontier.event.id ?? latestFrontier.event.order}-${earliestInChapter.id ?? earliestInChapter.order}`,
          type: 'retrograde-chapter',
          severity: isFb ? 'low' : 'high',
          title: isFb
            ? `[Kilas Balik] Tanggal Bab "${ch.title}" mendahului Bab "${latestFrontier.chapter.title}"`
            : `Tanggal Bab "${ch.title}" mundur dari Bab "${latestFrontier.chapter.title}"`,
          detail: `Peristiwa "${earliestInChapter.title}" di Bab "${ch.title}" bertanggal ${formatDate(calendar, earliestInChapter.startDate!)}, lebih awal daripada peristiwa "${latestFrontier.event.title}" di Bab "${latestFrontier.chapter.title}" (${formatDate(calendar, prevDate)}).` +
            (isFb ? ' Terdeteksi sebagai kilas balik (analepsis).' : ' Periksa apakah ini lonjakan kilas balik yang disengaja atau anomali kontinuitas.'),
          chapterA: latestFrontier.chapter,
          chapterB: ch,
          eventA: latestFrontier.event,
          eventB: earliestInChapter,
          daysDiff: days,
          isFlashback: isFb,
        });
      }
    }

    // Perbarui batas terdepan jika bab ini memperluas horizon waktu
    if (!latestFrontier) {
      latestFrontier = { chapter: ch, event: latestInChapter };
    } else {
      const curRef = latestInChapter.endDate ?? latestInChapter.startDate!;
      const frontRef = latestFrontier.event.endDate ?? latestFrontier.event.startDate!;
      if (compareDate(curRef, frontRef) > 0) {
        latestFrontier = { chapter: ch, event: latestInChapter };
      }
    }
  }

  return anomalies;
}
