import { describe, it, expect } from 'vitest';
import {
  buildFactions, aggregateFactionRelations, factionPairSentiment, pairKey,
} from '@/src/lib/factions';
import type { CodexEntry, Relationship } from '@/src/types';

const entry = (id: number, name: string, extra: Partial<CodexEntry> = {}): CodexEntry => ({
  id, projectId: 1, name, aliases: [], category: 'character', description: '', tags: [], ...extra,
});

const rel = (id: number, sourceId: number, targetId: number, type = 'Enemy'): Relationship =>
  ({ id, projectId: 1, sourceId, targetId, type });

// Skenario dasar: dua faksi (entri 100/200), anggota via tag.
const scenario = () => {
  const entries: CodexEntry[] = [
    entry(100, 'Kerajaan Merah', { factionTag: 'Merah' }),
    entry(200, 'Kerajaan Biru', { factionTag: 'Biru' }),
    entry(1, 'Arin', { tags: ['Merah'] }),
    entry(2, 'Bael', { tags: ['Merah'] }),
    entry(3, 'Cora', { tags: ['Merah'] }),
    entry(4, 'Dain', { tags: ['Biru'] }),
    entry(5, 'Elle', { tags: ['Biru'] }),
    entry(9, 'Netral', { tags: [] }),
  ];
  return entries;
};

describe('buildFactions', () => {
  it('hanya entri ber-factionTag yang jadi faksi; anggota dari pencocokan tag', () => {
    const factions = buildFactions(scenario());
    expect(factions.map(f => f.name)).toEqual(['Kerajaan Biru', 'Kerajaan Merah']); // terurut nama
    const merah = factions.find(f => f.tag === 'Merah')!;
    expect(merah.memberIds).toEqual([1, 2, 3]);
    const biru = factions.find(f => f.tag === 'Biru')!;
    expect(biru.memberIds).toEqual([4, 5]);
  });

  it('mengabaikan factionTag kosong/spasi', () => {
    const factions = buildFactions([entry(1, 'X', { factionTag: '   ' }), entry(2, 'Y', { factionTag: '' })]);
    expect(factions).toHaveLength(0);
  });

  it('anggota lintas-kategori & satu entri bisa di banyak faksi', () => {
    const entries = [
      entry(100, 'Merah', { factionTag: 'Merah' }),
      entry(200, 'Biru', { factionTag: 'Biru' }),
      entry(1, 'Kota', { category: 'location', tags: ['Merah', 'Biru'] }),
    ];
    const factions = buildFactions(entries);
    expect(factions.find(f => f.tag === 'Merah')!.memberIds).toContain(1);
    expect(factions.find(f => f.tag === 'Biru')!.memberIds).toContain(1);
  });

  it('faksi tanpa anggota tetap valid', () => {
    const factions = buildFactions([entry(100, 'Kosong', { factionTag: 'Kosong' })]);
    expect(factions[0].memberIds).toEqual([]);
  });
});

describe('aggregateFactionRelations — derived (potret anggota)', () => {
  it('hanya menghitung relasi yang KEDUA ujungnya anggota faksi berbeda', () => {
    const factions = buildFactions(scenario());
    const rels = [
      rel(10, 1, 4, 'Enemy'),  // Merah↔Biru
      rel(11, 2, 5, 'Enemy'),  // Merah↔Biru
      rel(12, 3, 4, 'Enemy'),  // Merah↔Biru
      rel(13, 1, 9, 'Friend'), // Merah↔Netral (Netral bukan anggota) → diabaikan
    ];
    const { pairMap } = aggregateFactionRelations(factions, rels);
    const pair = pairMap.get(pairKey(100, 200))!;
    expect(pair.derived).toEqual({ Enemy: 3 });
  });

  it('relasi antar-anggota faksi SAMA masuk internal, bukan derived', () => {
    const factions = buildFactions(scenario());
    const rels = [rel(10, 1, 2, 'Friend')]; // Arin↔Bael, keduanya Merah
    const { pairMap, internal } = aggregateFactionRelations(factions, rels);
    expect(pairMap.get(pairKey(100, 200))).toBeUndefined();
    expect(internal.get(100)).toEqual({ Friend: 1 });
  });

  it('tidak ganda menghitung pasangan lintas untuk anggota multi-faksi', () => {
    // Entitas 1 anggota Merah & Biru; entitas 4 anggota Biru. Relasi 1↔4 tak boleh
    // menghitung pasangan (Merah,Biru) dua kali.
    const entries = [
      entry(100, 'Merah', { factionTag: 'Merah' }),
      entry(200, 'Biru', { factionTag: 'Biru' }),
      entry(1, 'Ganda', { tags: ['Merah', 'Biru'] }),
      entry(4, 'Dain', { tags: ['Biru'] }),
    ];
    const factions = buildFactions(entries);
    const { pairMap, internal } = aggregateFactionRelations(factions, [rel(10, 1, 4, 'Enemy')]);
    // 1∈{Merah,Biru}, 4∈{Biru}: irisan {Biru} → internal Biru; lintas (Merah,Biru) sekali.
    expect(internal.get(200)).toEqual({ Enemy: 1 });
    expect(pairMap.get(pairKey(100, 200))!.derived).toEqual({ Enemy: 1 });
  });
});

describe('aggregateFactionRelations — declared', () => {
  it('mengumpulkan relasi langsung antar entri faksi terpisah dari derived', () => {
    const factions = buildFactions(scenario());
    const rels = [
      rel(20, 100, 200, 'Ally'), // deklarasi Merah—Sekutu—Biru
      rel(10, 1, 4, 'Enemy'),    // anggota saling musuh
    ];
    const { pairMap } = aggregateFactionRelations(factions, rels);
    const pair = pairMap.get(pairKey(100, 200))!;
    expect(pair.declared.map(r => r.type)).toEqual(['Ally']);
    expect(pair.derived).toEqual({ Enemy: 1 });
  });
});

describe('factionPairSentiment', () => {
  it('deklarasi menang atas turunan (tanpa menghakimi)', () => {
    const factions = buildFactions(scenario());
    const { pairMap } = aggregateFactionRelations(factions, [
      rel(20, 100, 200, 'Ally'),
      rel(10, 1, 4, 'Enemy'),
      rel(11, 2, 5, 'Enemy'),
    ]);
    const s = factionPairSentiment(pairMap.get(pairKey(100, 200)));
    expect(s.source).toBe('declared');
    expect(s.type).toBe('Ally');
    expect(s.memberRelations).toBe(2); // potret tetap dihitung
  });

  it('tanpa deklarasi → pakai tipe turunan dominan', () => {
    const factions = buildFactions(scenario());
    const { pairMap } = aggregateFactionRelations(factions, [
      rel(10, 1, 4, 'Enemy'),
      rel(11, 2, 5, 'Enemy'),
      rel(12, 3, 4, 'Friend'),
    ]);
    const s = factionPairSentiment(pairMap.get(pairKey(100, 200)));
    expect(s.source).toBe('derived');
    expect(s.type).toBe('Enemy'); // 2 Enemy > 1 Friend
    expect(s.memberRelations).toBe(3);
  });

  it('pasangan tak ada → none', () => {
    expect(factionPairSentiment(undefined)).toEqual({ source: 'none', memberRelations: 0 });
  });
});
