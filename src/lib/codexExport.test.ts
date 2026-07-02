import { describe, it, expect } from 'vitest';
import { codexToMarkdown } from '@/src/lib/codexExport';
import type { CodexEntry } from '@/src/types';

const NOW = Date.UTC(2026, 6, 2); // 2026-07-02

function entry(p: Partial<CodexEntry>): CodexEntry {
  return { projectId: 1, name: '', aliases: [], category: 'other', description: '', tags: [], ...p };
}

describe('codexToMarkdown', () => {
  it('menulis judul + baris meta (nama proyek, jumlah, tanggal)', () => {
    const md = codexToMarkdown([entry({ name: 'X', description: 'd' })], { projectName: 'Aethoria', now: NOW });
    expect(md).toContain('# Codex — Aethoria');
    expect(md).toContain('_Diekspor dari AetherScribe · 1 entri · 2026-07-02_');
  });

  it('mengelompokkan per kategori (label + jumlah) dan mengurutkan entri A–Z', () => {
    const md = codexToMarkdown(
      [
        entry({ name: 'Sylvari', category: 'character', description: 'elf' }),
        entry({ name: 'Keldrun', category: 'character', description: 'dwarf' }),
        entry({ name: 'Ironhaven', category: 'location', description: 'kota' }),
      ],
      { now: NOW },
    );
    expect(md).toContain('## Karakter  (2)');
    expect(md).toContain('## Lokasi  (1)');
    // Keldrun sebelum Sylvari (A–Z)
    expect(md.indexOf('### Keldrun')).toBeLessThan(md.indexOf('### Sylvari'));
    // Karakter (kategori bawaan lebih dulu) sebelum Lokasi
    expect(md.indexOf('## Karakter')).toBeLessThan(md.indexOf('## Lokasi'));
  });

  it('menulis baris meta alias/tag hanya bila ada', () => {
    const md = codexToMarkdown(
      [
        entry({ name: 'Keldrun', category: 'character', aliases: ['Dwarf'], tags: ['ras'], description: 'd' }),
        entry({ name: 'Polos', category: 'character', description: 'd' }),
      ],
      { now: NOW },
    );
    expect(md).toContain('_Alias: Dwarf · Tag: ras_');
    // entri "Polos" tak punya baris meta alias/tag
    const polos = md.slice(md.indexOf('### Polos'));
    expect(polos).not.toContain('Alias:');
  });

  it('memberi placeholder untuk deskripsi kosong', () => {
    const md = codexToMarkdown([entry({ name: 'Stub', category: 'other' })], { now: NOW });
    expect(md).toContain('_(tanpa deskripsi)_');
  });

  it('menaruh slug kategori tak dikenal di akhir', () => {
    const md = codexToMarkdown(
      [
        entry({ name: 'A', category: 'faction', description: 'd' }),
        entry({ name: 'B', category: 'character', description: 'd' }),
      ],
      { now: NOW },
    );
    expect(md.indexOf('## Karakter')).toBeLessThan(md.indexOf('## faction'));
  });

  it('menangani daftar kosong', () => {
    const md = codexToMarkdown([], { projectName: 'Kosong', now: NOW });
    expect(md).toContain('· 0 entri ·');
    expect(md).toContain('_(Tidak ada entri Codex.)_');
  });
});
