/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lensa Karakter — analitik per-karakter LINTAS-BAB, murni lokal & TANPA AI.
 * Memakai PresenceIndex bersama (src/lib/continuity.ts) sehingga pencocokan
 * nama identik dengan Peta Kontinuitas dan scan tidak diduplikasi.
 *
 * Yang dihitung: "screen time" per bab, kemunculan pertama/terakhir, absensi
 * terpanjang, jumlah bab ber-POV karakter ini, dan ko-kemunculan (karakter lain
 * yang paling sering berbagi bab).
 */

import { buildPresenceIndex, PresenceIndex, ContinuityChapter } from '@/src/lib/continuity';
import { CodexEntry } from '@/src/types';

export interface ArcChapter extends ContinuityChapter {
  /** Label POV bab (mis. nama karakter sudut pandang). */
  pov?: string;
}

export interface ChapterMention {
  chapterId: number;
  title: string;
  /** Indeks bab (0-based, urutan manuskrip). */
  index: number;
  /** Jumlah kemunculan karakter ini di bab tsb. */
  count: number;
  /** true bila bab ini ber-POV karakter ini. */
  isPov: boolean;
}

export interface CoAppearance {
  entityId: number;
  name: string;
  /** Jumlah bab yang ditempati bersama karakter target. */
  sharedChapters: number;
}

export interface CharacterArc {
  entityId: number;
  name: string;
  totalMentions: number;
  chaptersPresent: number;
  /** Indeks bab kemunculan pertama / terakhir (-1 bila tak pernah muncul). */
  firstIndex: number;
  lastIndex: number;
  /** Jeda absen terpanjang (bab berturut-turut) di antara dua kemunculan. */
  longestAbsence: number;
  /** Jumlah bab yang ber-POV karakter ini. */
  povCount: number;
  /** Satu entri per bab (count 0 bila absen) — untuk grafik screen-time. */
  perChapter: ChapterMention[];
  /** Karakter lain yang paling sering berbagi bab, terurut menurun. */
  coAppearances: CoAppearance[];
}

export interface ArcOptions {
  /** Indeks presence yang sudah dibangun (agar tak rescan saat ganti karakter). */
  index?: PresenceIndex;
  /** Batas jumlah ko-kemunculan teratas. Default 8. */
  maxCoAppearances?: number;
}

/** Apakah `pov` merujuk ke karakter ini (cocok dengan nama atau salah satu alias). */
function povMatches(pov: string | undefined, entry: CodexEntry): boolean {
  if (!pov) return false;
  const p = pov.toLowerCase();
  for (const term of [entry.name, ...(entry.aliases || [])]) {
    const t = (term || '').trim().toLowerCase();
    if (t && p.includes(t)) return true;
  }
  return false;
}

/**
 * Hitung arc untuk satu karakter. Mengembalikan null bila id tak ada di Codex.
 * Lewatkan `options.index` (hasil buildPresenceIndex) agar ganti karakter instan.
 */
export function computeCharacterArc(
  targetId: number,
  chapters: ArcChapter[],
  codexEntries: CodexEntry[],
  options?: ArcOptions
): CharacterArc | null {
  const byId = new Map<number, CodexEntry>();
  for (const e of codexEntries) {
    if (e.id != null) byId.set(e.id, e);
  }
  const target = byId.get(targetId);
  if (!target) return null;

  const index = options?.index ?? buildPresenceIndex(chapters, codexEntries);
  const maxCo = options?.maxCoAppearances ?? 8;

  const perChapter: ChapterMention[] = chapters.map((ch, idx) => ({
    chapterId: ch.id,
    title: ch.title,
    index: idx,
    count: index.perChapterCounts[idx]?.get(targetId) ?? 0,
    isPov: povMatches(ch.pov, target),
  }));

  const presentIndices = index.byEntity.get(targetId)?.indices ?? [];
  const mentions = index.byEntity.get(targetId)?.mentions ?? 0;

  let longestAbsence = 0;
  for (let i = 1; i < presentIndices.length; i++) {
    longestAbsence = Math.max(longestAbsence, presentIndices[i] - presentIndices[i - 1] - 1);
  }

  // Ko-kemunculan: untuk tiap bab yang ditempati target, hitung karakter lain
  // yang juga hadir → jumlah bab berbagi.
  const sharedCount = new Map<number, number>();
  for (const idx of presentIndices) {
    for (const otherId of index.perChapterCounts[idx].keys()) {
      if (otherId === targetId) continue;
      const other = byId.get(otherId);
      if (!other || other.category !== 'character') continue;
      sharedCount.set(otherId, (sharedCount.get(otherId) ?? 0) + 1);
    }
  }
  const coAppearances: CoAppearance[] = [...sharedCount.entries()]
    .map(([entityId, sharedChapters]) => ({ entityId, name: byId.get(entityId)!.name, sharedChapters }))
    .sort((a, b) => b.sharedChapters - a.sharedChapters || a.name.localeCompare(b.name))
    .slice(0, maxCo);

  return {
    entityId: targetId,
    name: target.name,
    totalMentions: mentions,
    chaptersPresent: presentIndices.length,
    firstIndex: presentIndices.length ? presentIndices[0] : -1,
    lastIndex: presentIndices.length ? presentIndices[presentIndices.length - 1] : -1,
    longestAbsence,
    povCount: perChapter.filter(c => c.isPov).length,
    perChapter,
    coAppearances,
  };
}
