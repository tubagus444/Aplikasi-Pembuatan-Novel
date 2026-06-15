import { describe, it, expect } from 'vitest';
import { findOrphanEntities } from '@/src/lib/orphanEntities';

const ch = (content: string, id = 1) => ({ id, content });

describe('findOrphanEntities', () => {
  it('flags a frequent mid-sentence proper noun not in codex', () => {
    const text = 'Pagi itu Kael berjalan. Lalu Kael bertemu Kael lagi di pasar saat Kael lapar.';
    const out = findOrphanEntities([ch(text)], [], { minCount: 3 });
    const kael = out.find(o => o.name === 'Kael');
    expect(kael).toBeTruthy();
    expect(kael!.count).toBeGreaterThanOrEqual(3);
    expect(kael!.strong).toBeGreaterThanOrEqual(1); // "bertemu Kael", "saat Kael"
  });

  it('excludes names already in codex (by name or alias, suffix-tolerant)', () => {
    const text = 'Saat Kael datang, Kaelnya tersenyum. Kemudian Kael pergi bersama Kael.';
    const out = findOrphanEntities([ch(text)], [{ name: 'Kael', aliases: [] }], { minCount: 1 });
    expect(out.find(o => o.name === 'Kael')).toBeFalsy();
    expect(out.find(o => o.name === 'Kaelnya')).toBeFalsy(); // partikel -nya dilucuti
  });

  it('excludes a word that only ever appears at sentence start', () => {
    const text = 'Mereka pergi. Mereka pulang. Mereka tidur. Mereka bangun.';
    const out = findOrphanEntities([ch(text)], [], { minCount: 2 });
    expect(out.find(o => o.name === 'Mereka')).toBeFalsy();
  });

  it('respects the ignored list and minCount threshold', () => {
    const text = 'Ada Mira di sana. Aku melihat Mira. Tentu saja Mira hebat. Mira tersenyum.';
    const ignored = new Set(['mira']);
    expect(findOrphanEntities([ch(text)], [], { ignored }).find(o => o.name === 'Mira')).toBeFalsy();
    // Tanpa ignore tapi threshold tinggi → tersaring.
    expect(findOrphanEntities([ch(text)], [], { minCount: 99 }).length).toBe(0);
  });

  it('detects multi-word names and aggregates across chapters', () => {
    const a = 'Konon Kael Aldheim adalah raja. Banyak yang takut pada Kael Aldheim.';
    const b = 'Di utara, Kael Aldheim membangun benteng besar.';
    const out = findOrphanEntities([ch(a, 1), ch(b, 2)], [], { minCount: 3 });
    const full = out.find(o => o.name === 'Kael Aldheim');
    expect(full).toBeTruthy();
    expect(full!.count).toBe(3);
    expect(full!.chapterIds.sort()).toEqual([1, 2]);
  });
});
