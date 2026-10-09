import { describe, it, expect } from 'vitest';
import { analyzeContinuity, ContinuityChapter } from '@/src/lib/continuity';
import { CodexEntry, Relationship, TimelineEvent } from '@/src/types';
import { calendarPreset } from './worldCalendar';

const entry = (id: number, name: string, category = 'character', aliases: string[] = []): CodexEntry => ({
  id, projectId: 1, name, aliases, category, description: '', tags: [],
});

const chap = (id: number, title: string, content: string): ContinuityChapter => ({ id, title, content });

describe('analyzeContinuity', () => {
  it('builds a presence map across chapters with mention counts', () => {
    const codex = [entry(1, 'Kael')];
    const chapters = [
      chap(1, 'Bab 1', 'Kael berjalan. Kael lapar.'),
      chap(2, 'Bab 2', 'Tidak ada siapa-siapa.'),
      chap(3, 'Bab 3', 'Akhirnya Kael kembali.'),
    ];
    const { presence } = analyzeContinuity(chapters, codex, [], []);
    const kael = presence.find(p => p.entityId === 1)!;
    expect(kael.mentions).toBe(3);
    expect(kael.chapterIndices).toEqual([0, 2]);
  });

  it('flags a character who disappears for >= gapThreshold chapters', () => {
    const codex = [entry(1, 'Kael')];
    const chapters: ContinuityChapter[] = [
      chap(1, 'B1', 'Kael ada.'),
      chap(2, 'B2', 'kosong'), chap(3, 'B3', 'kosong'),
      chap(4, 'B4', 'kosong'), chap(5, 'B5', 'kosong'),
      chap(6, 'B6', 'Kael kembali.'),
    ];
    const { findings } = analyzeContinuity(chapters, codex, [], [], { gapThreshold: 4 });
    const gap = findings.find(f => f.check === 'presence-gap');
    expect(gap).toBeTruthy();
    expect(gap!.entityIds).toEqual([1]);
    expect(gap!.title).toContain('4 bab');
    expect(gap!.chapterIds).toEqual([6]); // bab kemunculan kembali
  });

  it('does not flag a gap below the threshold', () => {
    const codex = [entry(1, 'Kael')];
    const chapters = [chap(1, 'B1', 'Kael.'), chap(2, 'B2', 'kosong'), chap(3, 'B3', 'Kael.')];
    const { findings } = analyzeContinuity(chapters, codex, [], [], { gapThreshold: 4 });
    expect(findings.find(f => f.check === 'presence-gap')).toBeFalsy();
  });

  it('flags an unused codex entry never mentioned in the manuscript', () => {
    const codex = [entry(1, 'Kael'), entry(2, 'Lyra', 'location')];
    const chapters = [chap(1, 'B1', 'Hanya Kael di sini.')];
    const { findings } = analyzeContinuity(chapters, codex, [], []);
    const unused = findings.find(f => f.check === 'unused-entity');
    expect(unused).toBeTruthy();
    expect(unused!.entityIds).toEqual([2]);
  });

  it('flags a relationship whose members never share a chapter', () => {
    const codex = [entry(1, 'Kael'), entry(2, 'Mira')];
    const chapters = [chap(1, 'B1', 'Kael sendiri.'), chap(2, 'B2', 'Mira sendiri.')];
    const rels: Relationship[] = [{ id: 9, projectId: 1, sourceId: 1, targetId: 2, type: 'Saudara' }];
    const { findings } = analyzeContinuity(chapters, codex, rels, []);
    const relGap = findings.find(f => f.check === 'relationship-gap');
    expect(relGap).toBeTruthy();
    expect(relGap!.entityIds).toEqual([1, 2]);
  });

  it('does not flag a relationship when both appear together at least once', () => {
    const codex = [entry(1, 'Kael'), entry(2, 'Mira')];
    const chapters = [chap(1, 'B1', 'Kael dan Mira bertemu.')];
    const rels: Relationship[] = [{ id: 9, projectId: 1, sourceId: 1, targetId: 2, type: 'Saudara' }];
    const { findings } = analyzeContinuity(chapters, codex, rels, []);
    expect(findings.find(f => f.check === 'relationship-gap')).toBeFalsy();
  });

  it('flags a timeline event whose character is absent from the linked chapter', () => {
    const codex = [entry(1, 'Kael'), entry(2, 'Mira')];
    const chapters = [chap(7, 'Pertempuran', 'Hanya Kael yang bertarung.')];
    const timeline: TimelineEvent[] = [
      { id: 3, projectId: 1, chapterId: 7, title: 'Duel', description: '', type: 'plot', characterIds: [1, 2], order: 0 },
    ];
    const { findings } = analyzeContinuity(chapters, codex, [], timeline);
    const mismatch = findings.find(f => f.check === 'timeline-mismatch');
    expect(mismatch).toBeTruthy();
    expect(mismatch!.entityIds).toEqual([2]); // Mira hilang dari teks
    expect(mismatch!.chapterIds).toEqual([7]);
  });

  it('matches aliases when detecting presence', () => {
    const codex = [entry(1, 'Kael Aldheim', 'character', ['Sang Pengembara'])];
    const chapters = [chap(1, 'B1', 'Sang Pengembara melangkah pergi.')];
    const { presence } = analyzeContinuity(chapters, codex, [], []);
    expect(presence.find(p => p.entityId === 1)?.mentions).toBe(1);
  });

  it('flags chronology retrograde anomalies when calendar is provided', () => {
    const chapters = [
      chap(1, 'Bab 1: Keberangkatan', 'Perjalanan dimulai.'),
      chap(2, 'Bab 2: Tiba', 'Sampai tujuan.'),
    ];
    const timeline: TimelineEvent[] = [
      { id: 1, projectId: 1, chapterId: 1, title: 'Mulai', description: '', type: 'plot', order: 0, startDate: { era: 0, year: 812, month: 5, day: 20 } },
      { id: 2, projectId: 1, chapterId: 2, title: 'Tiba', description: '', type: 'plot', order: 1, startDate: { era: 0, year: 812, month: 5, day: 10 } },
    ];
    const cal = calendarPreset('fantasy');

    const { findings } = analyzeContinuity(chapters, [], [], timeline, { calendar: cal });
    const retro = findings.find(f => f.check === 'chronology-retrograde');
    expect(retro).toBeTruthy();
    expect(retro!.severity).toBe('high');
    expect(retro!.chapterIds).toContain(1);
    expect(retro!.chapterIds).toContain(2);
  });
});

