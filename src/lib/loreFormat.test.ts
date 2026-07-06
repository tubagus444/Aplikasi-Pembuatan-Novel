import { describe, it, expect } from 'vitest';
import { formatCodexLoreLine, buildCodexLoreString, buildRelationshipGraph } from '@/src/lib/loreFormat';
import { CodexEntry, Relationship } from '@/src/types';

function entry(over: Partial<CodexEntry> = {}): CodexEntry {
  return {
    id: 1,
    projectId: 1,
    name: 'Aria',
    category: 'character',
    description: 'Seorang penyihir.',
    ...over,
  } as CodexEntry;
}

describe('formatCodexLoreLine', () => {
  it('memformat baris dasar [nama] (kat): desc', () => {
    expect(formatCodexLoreLine(entry())).toBe('[Aria] (character): Seorang penyihir.');
  });

  it('menyertakan field kategori (#17)', () => {
    const e = entry({ customFields: [{ key: 'weak', label: 'Kelemahan', value: 'Api' }] });
    expect(formatCodexLoreLine(e)).toBe('[Aria] (character): Seorang penyihir.\nKelemahan: Api');
  });

  it('menyertakan blok rahasia penulis dengan marker', () => {
    const e = entry({ secret: 'Sebenarnya seorang naga.' });
    expect(formatCodexLoreLine(e)).toContain('[RAHASIA PENULIS — jangan bocorkan ke prosa/pembaca] Sebenarnya seorang naga.');
  });

  it('deterministik', () => {
    const e = entry({ secret: 'x', customFields: [{ key: 'a', label: 'A', value: 'b' }] });
    expect(formatCodexLoreLine(e)).toBe(formatCodexLoreLine(e));
  });
});

describe('buildCodexLoreString', () => {
  it('menggabungkan entri dengan pemisah dua baris', () => {
    const res = buildCodexLoreString([entry({ name: 'Aria' }), entry({ id: 2, name: 'Borin' })], 10000);
    expect(res.text).toBe('[Aria] (character): Seorang penyihir.\n\n[Borin] (character): Seorang penyihir.');
    expect(res.truncated).toBe(false);
    expect(res.includedCount).toBe(2);
    expect(res.totalCount).toBe(2);
  });

  it('memotong pada BATAS ENTRI — tak pernah di tengah baris', () => {
    const a = entry({ id: 1, name: 'A', description: 'satu' });
    const b = entry({ id: 2, name: 'B', description: 'dua' });
    const c = entry({ id: 3, name: 'C', description: 'tiga' });
    const firstLen = formatCodexLoreLine(a).length;
    // Cap yang hanya cukup untuk entri pertama + sebagian entri kedua.
    const res = buildCodexLoreString([a, b, c], firstLen + 3);
    // Hanya entri pertama yang utuh; tak ada potongan parsial dari entri kedua.
    expect(res.text).toBe(formatCodexLoreLine(a));
    expect(res.truncated).toBe(true);
    expect(res.includedCount).toBe(1);
    expect(res.totalCount).toBe(3);
  });

  it('tak pernah memotong blok rahasia separuh (entri di-drop utuh)', () => {
    const a = entry({ id: 1, name: 'A', description: 'aman' });
    const b = entry({ id: 2, name: 'B', description: 'publik', secret: 'INI RAHASIA YANG TAK BOLEH BOCOR' });
    const res = buildCodexLoreString([a, b], formatCodexLoreLine(a).length + 5);
    expect(res.text).not.toContain('RAHASIA');
    expect(res.truncated).toBe(true);
  });

  it('menjamin ≥1 entri walau entri pertama melebihi cap', () => {
    const big = entry({ description: 'x'.repeat(500) });
    const res = buildCodexLoreString([big, entry({ id: 2, name: 'B' })], 50);
    expect(res.text.length).toBe(50);
    expect(res.includedCount).toBe(1);
    expect(res.truncated).toBe(true);
  });

  it('tak truncated saat semua muat', () => {
    const res = buildCodexLoreString([entry()], 10000);
    expect(res.truncated).toBe(false);
  });

  it('menangani codex kosong', () => {
    const res = buildCodexLoreString([], 10000);
    expect(res.text).toBe('');
    expect(res.truncated).toBe(false);
    expect(res.includedCount).toBe(0);
  });
});

describe('buildRelationshipGraph', () => {
  const codex = [entry({ id: 1, name: 'Aria' }), entry({ id: 2, name: 'Borin' })];

  it('kosong bila tak ada relasi', () => {
    expect(buildRelationshipGraph([], codex)).toBe('');
  });

  it('memformat relasi dengan nama entitas', () => {
    const rels: Relationship[] = [{ id: 1, projectId: 1, sourceId: 1, targetId: 2, type: 'Sekutu', description: 'lama' }];
    expect(buildRelationshipGraph(rels, codex)).toBe('\n\nRELATIONSHIP GRAPH:\nAria (Sekutu) -> Borin: lama');
  });

  it('fallback ke Entity#id untuk id tak dikenal', () => {
    const rels: Relationship[] = [{ id: 1, projectId: 1, sourceId: 9, targetId: 2, type: 'X' }];
    expect(buildRelationshipGraph(rels, codex)).toContain('Entity#9 (X) -> Borin');
  });
});
