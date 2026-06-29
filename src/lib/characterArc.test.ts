import { describe, it, expect } from 'vitest';
import { computeCharacterArc, ArcChapter } from '@/src/lib/characterArc';
import { CodexEntry } from '@/src/types';

const entry = (id: number, name: string, category = 'character', aliases: string[] = []): CodexEntry => ({
  id, projectId: 1, name, aliases, category, description: '', tags: [],
});

const chap = (id: number, title: string, content: string, pov?: string): ArcChapter => ({ id, title, content, pov });

describe('computeCharacterArc', () => {
  const codex = [entry(1, 'Kael'), entry(2, 'Mira'), entry(3, 'Lyra')];
  const chapters = [
    chap(1, 'B1', 'Kael dan Mira berjalan.', 'Kael'),
    chap(2, 'B2', 'Mira sendiri.'),
    chap(3, 'B3', 'kosong'),
    chap(4, 'B4', 'Kael kembali bersama Mira. Kael lelah.'),
  ];

  it('computes mentions, presence and first/last appearance', () => {
    const arc = computeCharacterArc(1, chapters, codex)!;
    expect(arc.totalMentions).toBe(3); // B1 ×1, B4 ×2
    expect(arc.chaptersPresent).toBe(2);
    expect(arc.firstIndex).toBe(0);
    expect(arc.lastIndex).toBe(3);
  });

  it('reports the longest absence between appearances', () => {
    const arc = computeCharacterArc(1, chapters, codex)!;
    expect(arc.longestAbsence).toBe(2); // absen B2, B3
  });

  it('produces a per-chapter screen-time series for all chapters', () => {
    const arc = computeCharacterArc(1, chapters, codex)!;
    expect(arc.perChapter.map(c => c.count)).toEqual([1, 0, 0, 2]);
  });

  it('detects POV chapters via the pov field', () => {
    const arc = computeCharacterArc(1, chapters, codex)!;
    expect(arc.povCount).toBe(1);
    expect(arc.perChapter[0].isPov).toBe(true);
    expect(arc.perChapter[1].isPov).toBe(false);
  });

  it('ranks co-appearing characters by shared chapters', () => {
    const arc = computeCharacterArc(1, chapters, codex)!;
    const mira = arc.coAppearances.find(c => c.entityId === 2)!;
    expect(mira.sharedChapters).toBe(2); // B1 & B4
    expect(arc.coAppearances.find(c => c.entityId === 3)).toBeFalsy(); // Lyra tak pernah muncul
  });

  it('returns null for an unknown character id', () => {
    expect(computeCharacterArc(999, chapters, codex)).toBeNull();
  });
});
