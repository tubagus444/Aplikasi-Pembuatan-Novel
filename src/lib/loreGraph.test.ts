import { describe, it, expect } from 'vitest';
import { buildLoreGraph, buildLoreGraphView, findDanglingRefs, scanMentions } from '@/src/lib/loreGraph';
import { CodexEntry, Relationship, PlotPromise } from '@/src/types';

const entry = (
  id: number,
  name: string,
  description = '',
  extra: Partial<CodexEntry> = {},
): CodexEntry => ({
  id, projectId: 1, name, aliases: [], category: 'character', description, tags: [], ...extra,
});

const rel = (id: number, sourceId: number, targetId: number, type = 'Musuh'): Relationship =>
  ({ id, projectId: 1, sourceId, targetId, type });

const promise = (id: number, title: string, extra: Partial<PlotPromise> = {}): PlotPromise => ({
  id, projectId: 1, title, status: 'open', createdAt: 0, updatedAt: 0, ...extra,
});

describe('scanMentions', () => {
  it('mendeteksi sebutan nama di deskripsi entri lain', () => {
    const entries = [entry(1, 'Kaelen'), entry(2, 'Mira', 'Sahabat Kaelen sejak kecil.')];
    expect(scanMentions(entries)).toEqual([{ sourceId: 2, mentionedId: 1 }]);
  });

  it('memindai alias & isi secret', () => {
    const entries = [
      entry(1, 'Kaelen', '', { aliases: ['Sang Naga'] }),
      entry(2, 'Mira', 'Biasa saja.', { secret: 'Sebenarnya Sang Naga adalah ayahnya.' }),
    ];
    expect(scanMentions(entries)).toEqual([{ sourceId: 2, mentionedId: 1 }]);
  });

  it('mengabaikan entri tanpa teks & tanpa keyword', () => {
    expect(scanMentions([entry(1, 'A'), entry(2, 'B')])).toEqual([]);
    expect(scanMentions([])).toEqual([]);
  });

  it('sumber tunggal: hasil konsisten dengan edge mention buildLoreGraphView', () => {
    const entries = [entry(1, 'Kaelen'), entry(2, 'Mira', 'Kaelen temanku.')];
    const mentionLinks = buildLoreGraphView(entries, [], []).links.filter((l) => l.via === 'mention');
    // scanMentions menghasilkan pasangan yang sama (arah tak-berurut di view).
    expect(scanMentions(entries).length).toBe(mentionLinks.length);
  });
});

describe('buildLoreGraph — backlinks (sebutan)', () => {
  it('menurunkan backlink saat deskripsi satu entri menyebut entri lain', () => {
    const entries = [
      entry(1, 'Kaelen', 'Kaelen berasal dari kota Vharos yang jauh.'),
      entry(2, 'Vharos', 'Sebuah kota pelabuhan.'),
    ];
    const { backlinks } = buildLoreGraph(entries, [], []);
    const vharosLinks = backlinks.get(2) ?? [];
    expect(vharosLinks).toHaveLength(1);
    expect(vharosLinks[0]).toMatchObject({ sourceId: 1, sourceName: 'Kaelen', via: 'mention' });
    // Arah sebaliknya tak ada (Vharos tak menyebut Kaelen).
    expect(backlinks.get(1)).toBeUndefined();
  });

  it('mencocokkan alias, bukan hanya nama utama', () => {
    const entries = [
      entry(1, 'Kaelen', 'Sang Serigala Perak memimpin pasukan.'),
      entry(2, 'Vharos', '', { aliases: ['Sang Serigala Perak'] }),
    ];
    const { backlinks } = buildLoreGraph(entries, [], []);
    expect((backlinks.get(2) ?? [])[0]).toMatchObject({ sourceId: 1, via: 'mention' });
  });

  it('memindai field secret sebagai teks penulis', () => {
    const entries = [
      entry(1, 'Kaelen', 'Panglima biasa.', { secret: 'Sebenarnya putra Raja Vharos.' }),
      entry(2, 'Vharos', 'Sebuah kota.'),
    ];
    const { backlinks } = buildLoreGraph(entries, [], []);
    expect((backlinks.get(2) ?? [])[0]).toMatchObject({ sourceId: 1, via: 'mention' });
  });

  it('mengabaikan sebutan diri sendiri', () => {
    const entries = [entry(1, 'Kaelen', 'Kaelen memikirkan Kaelen.')];
    const { backlinks } = buildLoreGraph(entries, [], []);
    expect(backlinks.get(1)).toBeUndefined();
  });

  it('men-dedup sebutan berulang jadi satu backlink', () => {
    const entries = [
      entry(1, 'Kaelen', 'Vharos, Vharos, dan sekali lagi Vharos.'),
      entry(2, 'Vharos'),
    ];
    const { backlinks } = buildLoreGraph(entries, [], []);
    expect(backlinks.get(2)).toHaveLength(1);
  });
});

describe('buildLoreGraph — backlinks (relasi & payoff)', () => {
  it('menautkan relasi bertipe dua arah', () => {
    const entries = [entry(1, 'Kaelen'), entry(2, 'Roderik')];
    const { backlinks } = buildLoreGraph(entries, [rel(10, 1, 2, 'Saudara')], []);
    expect((backlinks.get(2) ?? [])[0]).toMatchObject({ sourceId: 1, via: 'relationship', label: 'Saudara' });
    expect((backlinks.get(1) ?? [])[0]).toMatchObject({ sourceId: 2, via: 'relationship', label: 'Saudara' });
  });

  it('menautkan payoff janji ke entri target', () => {
    const entries = [entry(1, 'Jati Diri Kaelen', '', { hidden: true })];
    const { backlinks } = buildLoreGraph(entries, [], [promise(5, 'Siapa ayah Kaelen?', { payoffCodexId: 1 })]);
    const links = backlinks.get(1) ?? [];
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ via: 'payoff', sourceName: 'Siapa ayah Kaelen?' });
  });

  it('mengurutkan backlink: relasi → sebutan → payoff', () => {
    const entries = [
      entry(1, 'Vharos'),
      entry(2, 'Kaelen', 'Kisah tentang Vharos.'),   // mention → Vharos
      entry(3, 'Roderik'),                            // relasi → Vharos
    ];
    const rels = [rel(10, 3, 1, 'Penguasa')];
    const proms = [promise(5, 'Rahasia Vharos', { payoffCodexId: 1 })];
    const { backlinks } = buildLoreGraph(entries, rels, proms);
    const vias = (backlinks.get(1) ?? []).map(l => l.via);
    expect(vias).toEqual(['relationship', 'mention', 'payoff']);
  });
});

describe('buildLoreGraph — tautan menggantung', () => {
  it('menandai relasi yang menunjuk entri terhapus', () => {
    const entries = [entry(1, 'Kaelen')]; // id 2 sudah tiada
    const { dangling } = buildLoreGraph(entries, [rel(10, 1, 2, 'Musuh')], []);
    expect(dangling).toHaveLength(1);
    expect(dangling[0]).toMatchObject({ kind: 'relationship', missingTargetId: 2, relationshipId: 10 });
    expect(dangling[0].ownerLabel).toContain('Kaelen');
  });

  it('menandai kedua ujung relasi bila keduanya hilang', () => {
    const { dangling } = buildLoreGraph([], [rel(10, 1, 2)], []);
    expect(dangling).toHaveLength(2);
    expect(dangling.map(d => d.missingTargetId).sort()).toEqual([1, 2]);
  });

  it('menandai codexId & payoffCodexId janji yang menggantung', () => {
    const entries = [entry(1, 'Kaelen')];
    const proms = [promise(5, 'Ramalan', { codexId: 99, payoffCodexId: 98 })];
    const { dangling } = buildLoreGraph(entries, [], proms);
    const kinds = dangling.map(d => d.kind).sort();
    expect(kinds).toEqual(['promise-codex', 'promise-payoff']);
  });

  it('tidak menandai apa pun saat semua referensi utuh', () => {
    const entries = [entry(1, 'Kaelen'), entry(2, 'Roderik')];
    const rels = [rel(10, 1, 2)];
    const proms = [promise(5, 'Janji', { codexId: 1, payoffCodexId: 2 })];
    const { dangling } = buildLoreGraph(entries, rels, proms);
    expect(dangling).toHaveLength(0);
  });

  it('memberi id stabil & terurut deterministik', () => {
    const proms = [promise(5, 'B', { codexId: 99 }), promise(4, 'A', { payoffCodexId: 98 })];
    const { dangling } = buildLoreGraph([], [], proms);
    const ids = dangling.map(d => d.id);
    expect([...ids].sort()).toEqual(ids); // sudah terurut
  });

  it('findDanglingRefs setara dengan buildLoreGraph().dangling', () => {
    const entries = [entry(1, 'Kaelen', 'Menyebut Vharos.'), entry(2, 'Vharos')];
    const rels = [rel(10, 1, 2), rel(11, 1, 99)]; // rel 11 menggantung
    const proms = [promise(5, 'Ramalan', { codexId: 88, payoffCodexId: 2 })];
    expect(findDanglingRefs(entries, rels, proms)).toEqual(buildLoreGraph(entries, rels, proms).dangling);
  });
});

describe('buildLoreGraphView — node & edge untuk visualisasi', () => {
  it('membuat satu node per entri dengan metadata', () => {
    const entries = [entry(1, 'Kaelen'), entry(2, 'Vharos', '', { category: 'location', hidden: true })];
    const { nodes } = buildLoreGraphView(entries, [], []);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({ id: 1, name: 'Kaelen', category: 'character', hidden: false });
    expect(nodes[1]).toMatchObject({ id: 2, name: 'Vharos', category: 'location', hidden: true });
  });

  it('membuat edge relasi dan menghitung degree kedua ujung', () => {
    const entries = [entry(1, 'Kaelen'), entry(2, 'Roderik')];
    const { nodes, links } = buildLoreGraphView(entries, [rel(10, 1, 2, 'Saudara')], []);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ source: 1, target: 2, via: 'relationship', label: 'Saudara' });
    expect(nodes.find(n => n.id === 1)!.degree).toBe(1);
    expect(nodes.find(n => n.id === 2)!.degree).toBe(1);
  });

  it('men-dedup edge relasi dua-ujung jadi satu (tak-berarah), tapi memisah tipe berbeda', () => {
    const entries = [entry(1, 'A'), entry(2, 'B')];
    // relasi 1→2 dan 2→1 tipe sama = satu edge; tipe beda = edge terpisah.
    const rels = [rel(10, 1, 2, 'Musuh'), rel(11, 2, 1, 'Musuh'), rel(12, 1, 2, 'Sekutu')];
    const { links } = buildLoreGraphView(entries, rels, []);
    expect(links).toHaveLength(2);
    expect(links.map(l => l.label).sort()).toEqual(['Musuh', 'Sekutu']);
  });

  it('membuat edge sebutan (undirected) dari deskripsi & men-dedup arah balik', () => {
    const entries = [
      entry(1, 'Kaelen', 'Kaelen tinggal di Vharos.'),
      entry(2, 'Vharos', 'Vharos adalah rumah Kaelen.'),
    ];
    const { links } = buildLoreGraphView(entries, [], []);
    // A menyebut B dan B menyebut A → tetap satu edge.
    const mentions = links.filter(l => l.via === 'mention');
    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toMatchObject({ source: 1, target: 2 });
  });

  it('membuat edge payoff dari janji dengan codexId & payoffCodexId', () => {
    const entries = [entry(1, 'Ramalan Kuno'), entry(2, 'Jati Diri', '', { hidden: true })];
    const proms = [promise(5, 'Siapa sang terpilih?', { codexId: 1, payoffCodexId: 2 })];
    const { links } = buildLoreGraphView(entries, [], proms);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ source: 1, target: 2, via: 'payoff', label: 'Siapa sang terpilih?' });
  });

  it('mengabaikan edge yang salah satu ujungnya entri terhapus', () => {
    const entries = [entry(1, 'Kaelen', 'Menyebut hantu.')];
    const rels = [rel(10, 1, 99)]; // 99 tak ada
    const proms = [promise(5, 'X', { codexId: 1, payoffCodexId: 98 })]; // 98 tak ada
    const { links } = buildLoreGraphView(entries, rels, proms);
    expect(links).toHaveLength(0);
  });

  it('menandai entri terisolasi lewat degree 0', () => {
    const entries = [entry(1, 'Kaelen'), entry(2, 'Roderik'), entry(3, 'Yatim')];
    const { nodes } = buildLoreGraphView(entries, [rel(10, 1, 2)], []);
    expect(nodes.find(n => n.id === 3)!.degree).toBe(0);
  });
});
