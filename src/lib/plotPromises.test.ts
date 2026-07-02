/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { analyzePromises } from './plotPromises';
import { CodexEntry, PlotPromise } from '@/src/types';

// 6 bab (idx 0..5). Belati (Codex #1) disebut di Bab 1 & 2 saja.
function makeChapters(mentions: Record<number, string>) {
  return Array.from({ length: 6 }, (_, i) => ({
    id: 100 + i,
    title: `Bab ${i + 1}`,
    content: mentions[i] ?? 'Teks biasa tanpa elemen apa pun.',
  }));
}

const codex: CodexEntry[] = [
  { id: 1, projectId: 1, name: 'Belati Berukir', category: 'item', aliases: ['Belati'] } as CodexEntry,
];

function promise(over: Partial<PlotPromise>): PlotPromise {
  return {
    projectId: 1, title: 'Janji', status: 'open',
    createdAt: 0, updatedAt: 0, ...over,
  };
}

describe('analyzePromises', () => {
  it('janji ber-codexId yang tertidur → state "dormant" + dormancy benar', () => {
    const chapters = makeChapters({ 0: 'Ada Belati di sini.', 1: 'Belati lagi.' });
    const { analyses } = analyzePromises([promise({ codexId: 1 })], chapters, codex);
    const a = analyses[0];
    expect(a.state).toBe('dormant');
    expect(a.firstIndex).toBe(0);
    expect(a.lastIndex).toBe(1);
    expect(a.dormancy).toBe(4); // 5 - 1
    expect(a.mentions).toBe(2);
  });

  it('janji yang disebut di bab terakhir → "active"', () => {
    const chapters = makeChapters({ 0: 'Belati.', 5: 'Belati muncul lagi di klimaks.' });
    const { analyses } = analyzePromises([promise({ codexId: 1 })], chapters, codex);
    expect(analyses[0].state).toBe('active');
    expect(analyses[0].dormancy).toBe(0);
  });

  it('status "paid" menimpa turunan walau tertidur', () => {
    const chapters = makeChapters({ 0: 'Belati.' });
    const { analyses } = analyzePromises([promise({ codexId: 1, status: 'paid' })], chapters, codex);
    expect(analyses[0].state).toBe('paid');
  });

  it('status "abandoned" menimpa turunan', () => {
    const chapters = makeChapters({ 0: 'Belati.' });
    const { analyses } = analyzePromises([promise({ codexId: 1, status: 'abandoned' })], chapters, codex);
    expect(analyses[0].state).toBe('abandoned');
  });

  it('janji tak pernah muncul → "unseen"', () => {
    const chapters = makeChapters({});
    const { analyses } = analyzePromises([promise({ codexId: 99 })], chapters, codex);
    expect(analyses[0].state).toBe('unseen');
    expect(analyses[0].mentions).toBe(0);
  });

  it('janji berbasis keyword (non-entitas) terlacak via scan teks', () => {
    const chapters = makeChapters({ 0: 'Sebuah ramalan kuno diucapkan.' });
    const { analyses } = analyzePromises(
      [promise({ keywords: ['ramalan'] })],
      chapters,
      codex,
    );
    const a = analyses[0];
    expect(a.mentions).toBe(1);
    expect(a.firstIndex).toBe(0);
    expect(a.state).toBe('dormant'); // muncul di Bab 1 saja, tertidur sampai akhir
  });

  it('ambang dormancy dapat disetel', () => {
    const chapters = makeChapters({ 0: 'Belati.', 1: 'Belati.' });
    const { analyses } = analyzePromises(
      [promise({ codexId: 1 })], chapters, codex, { dormancyThreshold: 8 },
    );
    expect(analyses[0].state).toBe('active'); // dormancy 4 < 8
  });
});
