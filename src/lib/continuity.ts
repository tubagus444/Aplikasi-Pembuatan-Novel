/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Continuity Dashboard — analisis kontinuitas LINTAS-BAB, murni lokal & TANPA AI.
 *
 * Memanfaatkan Aho-Corasick (nama + alias Codex) untuk membangun "peta kemunculan":
 * di bab mana saja tiap entitas muncul, dan berapa kali. Dari peta itu diturunkan
 * empat pemeriksaan deterministik yang menandai potensi plot-hole / lore usang:
 *   1. presence-gap     — karakter menghilang ≥N bab lalu muncul lagi.
 *   2. unused-entity    — entri Codex tak pernah disebut di teks bab mana pun.
 *   3. relationship-gap — dua karakter berelasi yang tak pernah satu bab bersama.
 *   4. timeline-mismatch— peristiwa timeline menandai karakter terlibat, tapi
 *                         namanya tak ada di teks bab yang ditautkan.
 *
 * Fungsi ini bekerja atas TEKS POLOS (HTML sudah di-strip oleh pemanggil).
 */

import { AhoCorasick } from '@/src/lib/ahoCorasick';
import { CodexEntry, Relationship, TimelineEvent } from '@/src/types';

export type ContinuityCheck =
  | 'presence-gap'
  | 'unused-entity'
  | 'relationship-gap'
  | 'timeline-mismatch';

export type ContinuitySeverity = 'high' | 'medium' | 'low';

export interface ContinuityFinding {
  /** Kunci stabil untuk React & dedup. */
  id: string;
  check: ContinuityCheck;
  severity: ContinuitySeverity;
  /** Judul singkat, mis. "Kael menghilang 6 bab". */
  title: string;
  /** Penjelasan + saran verifikasi. */
  detail: string;
  /** ID entri Codex yang terlibat. */
  entityIds: number[];
  /** ID bab yang relevan untuk "Buka bab" (kosong = tak ada lompatan). */
  chapterIds: number[];
}

export interface EntityPresence {
  entityId: number;
  name: string;
  category: string;
  /** Indeks bab (0-based, urutan manuskrip) tempat entitas muncul. */
  chapterIndices: number[];
  /** Total kemunculan di seluruh manuskrip. */
  mentions: number;
}

export interface ContinuityChapter {
  id: number;
  title: string;
  /** Teks polos (tanpa HTML). */
  content: string;
}

export interface ContinuityReport {
  /** Peta kemunculan per entitas, terurut dari yang paling sering disebut. */
  presence: EntityPresence[];
  findings: ContinuityFinding[];
  chapterCount: number;
  entityCount: number;
}

export interface ContinuityOptions {
  /** Jumlah bab berturut-turut tanpa kemunculan agar dianggap "menghilang". Default 4. */
  gapThreshold?: number;
}

/** Indeks kemunculan entitas Codex di seluruh bab — dasar bersama analitik lokal. */
export interface PresenceIndex {
  /** Per bab (selaras urutan `chapters`): Map entityId → jumlah kemunculan di bab itu. */
  perChapterCounts: Map<number, number>[];
  /** Per entitas: indeks bab (unik, urut) tempat ia muncul + total kemunculan. */
  byEntity: Map<number, { indices: number[]; mentions: number }>;
}

/**
 * Pindai bab (teks polos) dengan Aho-Corasick atas nama+alias Codex, sekali jalan.
 * Dipakai bersama oleh analisis kontinuitas dan lensa karakter agar tak ada
 * divergensi pencocokan / scan ganda.
 */
export function buildPresenceIndex(chapters: ContinuityChapter[], codexEntries: CodexEntry[]): PresenceIndex {
  const keywords: { word: string; data: number }[] = [];
  for (const e of codexEntries) {
    if (e.id == null) continue;
    for (const term of [e.name, ...(e.aliases || [])]) {
      const w = (term || '').trim();
      if (w.length >= 2) keywords.push({ word: w, data: e.id });
    }
  }

  const ac = keywords.length ? new AhoCorasick(keywords) : null;
  const perChapterCounts: Map<number, number>[] = [];
  const byEntity = new Map<number, { indices: number[]; mentions: number }>();

  chapters.forEach((ch, idx) => {
    const counts = new Map<number, number>();
    if (ac && ch.content) {
      for (const m of ac.search(ch.content)) {
        const id = m.data as number;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    for (const [id, c] of counts) {
      let p = byEntity.get(id);
      if (!p) { p = { indices: [], mentions: 0 }; byEntity.set(id, p); }
      p.indices.push(idx);
      p.mentions += c;
    }
    perChapterCounts.push(counts);
  });

  return { perChapterCounts, byEntity };
}

/** Bangun laporan kontinuitas dari bab (terurut) + data Codex/relasi/timeline. */
export function analyzeContinuity(
  chapters: ContinuityChapter[],
  codexEntries: CodexEntry[],
  relationships: Relationship[],
  timeline: TimelineEvent[],
  options?: ContinuityOptions
): ContinuityReport {
  const gapThreshold = options?.gapThreshold ?? 4;

  const byId = new Map<number, CodexEntry>();
  for (const e of codexEntries) {
    if (e.id != null) byId.set(e.id, e);
  }

  const { perChapterCounts, byEntity: presenceMap } = buildPresenceIndex(chapters, codexEntries);

  const presence: EntityPresence[] = [];
  for (const [id, info] of presenceMap) {
    const e = byId.get(id)!;
    presence.push({
      entityId: id,
      name: e.name,
      category: e.category,
      chapterIndices: info.indices,
      mentions: info.mentions,
    });
  }
  presence.sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name));

  const findings: ContinuityFinding[] = [];

  // 1. Karakter menghilang (gap terbesar antar-kemunculan).
  for (const p of presence) {
    if (byId.get(p.entityId)!.category !== 'character') continue;
    if (p.chapterIndices.length < 2) continue;
    let maxGap = 0, gapStart = -1, gapEnd = -1;
    for (let i = 1; i < p.chapterIndices.length; i++) {
      const gap = p.chapterIndices[i] - p.chapterIndices[i - 1] - 1;
      if (gap > maxGap) { maxGap = gap; gapStart = p.chapterIndices[i - 1]; gapEnd = p.chapterIndices[i]; }
    }
    if (maxGap >= gapThreshold) {
      findings.push({
        id: `gap-${p.entityId}`,
        check: 'presence-gap',
        severity: maxGap >= gapThreshold * 2 ? 'medium' : 'low',
        title: `${p.name} menghilang ${maxGap} bab`,
        detail: `Muncul di "${chapters[gapStart].title}", lalu absen ${maxGap} bab sebelum kembali di "${chapters[gapEnd].title}". Pastikan jeda sepanjang ini memang disengaja.`,
        entityIds: [p.entityId],
        chapterIds: [chapters[gapEnd].id],
      });
    }
  }

  // 2. Entitas tak terpakai (tak pernah muncul di teks).
  for (const e of codexEntries) {
    if (e.id == null || presenceMap.has(e.id)) continue;
    findings.push({
      id: `unused-${e.id}`,
      check: 'unused-entity',
      severity: 'low',
      title: `${e.name} tak pernah disebut`,
      detail: `Entri Codex ini tidak ditemukan di teks bab mana pun — mungkin lore yang belum dipakai, alias/ejaan yang berbeda di naskah, atau catatan usang.`,
      entityIds: [e.id],
      chapterIds: [],
    });
  }

  // 3. Relasi tanpa pertemuan (keduanya muncul, tapi tak pernah satu bab).
  for (const rel of relationships) {
    const a = presenceMap.get(rel.sourceId);
    const b = presenceMap.get(rel.targetId);
    if (!a || !b) continue; // salah satu tak pernah muncul → sudah ditangani cek #2
    const setA = new Set(a.indices);
    if (b.indices.some(i => setA.has(i))) continue;
    const ea = byId.get(rel.sourceId), eb = byId.get(rel.targetId);
    if (!ea || !eb) continue;
    findings.push({
      id: `rel-${rel.id ?? `${rel.sourceId}-${rel.targetId}`}`,
      check: 'relationship-gap',
      severity: 'medium',
      title: `${ea.name} & ${eb.name} tak pernah satu bab`,
      detail: `Tercatat berelasi "${rel.type}", tetapi keduanya tidak pernah muncul bersamaan di bab mana pun. Relasi ini mungkin belum benar-benar ditunjukkan ke pembaca.`,
      entityIds: [rel.sourceId, rel.targetId],
      chapterIds: [],
    });
  }

  // 4. Timeline tak cocok (karakter peristiwa absen di teks bab tertaut).
  for (const ev of timeline) {
    if (ev.chapterId == null || !ev.characterIds?.length) continue;
    const chIdx = chapters.findIndex(c => c.id === ev.chapterId);
    if (chIdx < 0) continue;
    const present = perChapterCounts[chIdx];
    const missing = ev.characterIds.filter(cid => !present.has(cid));
    const names = missing.map(cid => byId.get(cid)?.name).filter(Boolean) as string[];
    if (!names.length) continue;
    findings.push({
      id: `tl-${ev.id ?? ev.order}`,
      check: 'timeline-mismatch',
      severity: 'medium',
      title: `Peristiwa "${ev.title}": ${names.join(', ')} tak muncul di bab terkait`,
      detail: `Timeline menandai ${names.join(', ')} terlibat pada peristiwa ini (bab "${chapters[chIdx].title}"), tetapi nama mereka tidak ditemukan di teks bab tersebut.`,
      entityIds: missing,
      chapterIds: [ev.chapterId],
    });
  }

  const SEV_ORDER: Record<ContinuitySeverity, number> = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.check.localeCompare(b.check));

  return { presence, findings, chapterCount: chapters.length, entityCount: byId.size };
}
