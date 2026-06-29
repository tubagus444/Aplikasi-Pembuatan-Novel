import { describe, it, expect } from 'vitest';
import { parseCodexDraft, stripCodexDraft } from '@/src/lib/codexDraft';

describe('parseCodexDraft', () => {
  it('mem-parse blok lengkap & menyanitasi field', () => {
    const text = [
      'Tentu, Aldric adalah mantan ksatria.',
      '```codex-draft',
      '{ "name": "Aldric", "category": "character", "description": "Mantan ksatria kerajaan Veld.", "aliases": ["Sang Pengkhianat"], "tags": ["protagonis"] }',
      '```',
    ].join('\n');
    expect(parseCodexDraft(text)).toEqual({
      name: 'Aldric',
      category: 'character',
      description: 'Mantan ksatria kerajaan Veld.',
      aliases: ['Sang Pengkhianat'],
      tags: ['protagonis'],
    });
  });

  it('mengembalikan null bila tak ada blok', () => {
    expect(parseCodexDraft('Cuma obrolan biasa, tanpa blok.')).toBeNull();
  });

  it('mengembalikan null untuk JSON rusak', () => {
    expect(parseCodexDraft('```codex-draft\n{ name: Aldric, }\n```')).toBeNull();
  });

  it('mengambil blok TERAKHIR bila ada beberapa', () => {
    const text =
      '```codex-draft\n{ "name": "Lama" }\n```\nlalu update:\n```codex-draft\n{ "name": "Baru" }\n```';
    expect(parseCodexDraft(text)?.name).toBe('Baru');
  });

  it('mengabaikan kategori di luar daftar yang diizinkan', () => {
    const text = '```codex-draft\n{ "name": "X", "category": "spaceship" }\n```';
    expect(parseCodexDraft(text)).toEqual({ name: 'X' });
  });

  it('menerima slug kategori kustom yang diizinkan', () => {
    const text = '```codex-draft\n{ "name": "X", "category": "faction" }\n```';
    expect(parseCodexDraft(text, ['character', 'faction'])?.category).toBe('faction');
  });

  it('mengembalikan null bila tak ada field valid', () => {
    expect(parseCodexDraft('```codex-draft\n{ "unknown": 1 }\n```')).toBeNull();
  });
});

describe('stripCodexDraft', () => {
  it('membuang blok lengkap dari teks tampilan', () => {
    const text = 'Halo.\n```codex-draft\n{ "name": "A" }\n```';
    expect(stripCodexDraft(text)).toBe('Halo.');
  });

  it('membuang blok separuh saat streaming', () => {
    expect(stripCodexDraft('Halo.\n```codex-draft\n{ "name": "A')).toBe('Halo.');
  });

  it('membuang pagar yang baru mulai diketik', () => {
    expect(stripCodexDraft('Halo.\n```codex-dra')).toBe('Halo.');
  });

  it('tidak menyentuh teks tanpa blok', () => {
    expect(stripCodexDraft('Sekadar teks biasa.')).toBe('Sekadar teks biasa.');
  });
});
