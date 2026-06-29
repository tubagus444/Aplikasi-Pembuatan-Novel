import { describe, it, expect } from 'vitest';
import { flagCharactersForChapter, InlineChapterRef } from '@/src/lib/inlineConsistency';
import { CodexEntry, TimelineEvent } from '@/src/types';

const entry = (id: number, name: string, category = 'character'): CodexEntry => ({
  id, projectId: 1, name, aliases: [], category, description: '', tags: [],
});

const chapters: InlineChapterRef[] = [
  { id: 1, order: 0, title: 'Bab 1' },
  { id: 2, order: 1, title: 'Bab 2' },
  { id: 3, order: 2, title: 'Bab 3' },
];

const ev = (chapterId: number, characterIds: number[], order = 0): TimelineEvent => ({
  projectId: 1, chapterId, characterIds, title: 'E', description: '', type: 'plot', order,
});

describe('flagCharactersForChapter', () => {
  const codex = [entry(10, 'Kael'), entry(20, 'Mira')];

  it('flags a character appearing before their earliest timeline chapter', () => {
    // Kael ditambatkan ke Bab 3 (order 2). Di Bab 1 (order 0) → terlalu dini.
    const flags = flagCharactersForChapter(1, chapters, codex, [ev(3, [10])]);
    expect(flags.has(10)).toBe(true);
    expect(flags.get(10)!.severity).toBe('medium');
    expect(flags.get(10)!.message).toContain('Bab 3');
  });

  it('does not flag at or after the earliest timeline chapter', () => {
    expect(flagCharactersForChapter(3, chapters, codex, [ev(3, [10])]).has(10)).toBe(false);
    expect(flagCharactersForChapter(2, chapters, codex, [ev(2, [10])]).has(10)).toBe(false);
  });

  it('uses the EARLIEST anchor when a character has several timeline events', () => {
    // Ditambatkan ke Bab 2 dan Bab 3; titik paling awal = Bab 2 (order 1).
    const flags = flagCharactersForChapter(1, chapters, codex, [ev(3, [10]), ev(2, [10])]);
    expect(flags.get(10)!.message).toContain('Bab 2');
    // Di Bab 2 sendiri tak ditandai (current >= earliest).
    expect(flagCharactersForChapter(2, chapters, codex, [ev(3, [10]), ev(2, [10])]).has(10)).toBe(false);
  });

  it('returns no flags when timeline is empty (no false positives)', () => {
    expect(flagCharactersForChapter(1, chapters, codex, []).size).toBe(0);
  });

  it('ignores non-character codex entries', () => {
    const codexLoc = [entry(30, 'Eldoria', 'location')];
    expect(flagCharactersForChapter(1, chapters, codexLoc, [ev(3, [30])]).size).toBe(0);
  });

  it('ignores timeline events without a chapter link', () => {
    const orphanEvent: TimelineEvent = { projectId: 1, characterIds: [10], title: 'E', description: '', type: 'plot', order: 0 };
    expect(flagCharactersForChapter(1, chapters, codex, [orphanEvent]).size).toBe(0);
  });
});
