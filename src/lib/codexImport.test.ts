import { describe, it, expect } from 'vitest';
import { parseCodexMarkdown } from '@/src/lib/codexImport';

describe('parseCodexMarkdown — heading', () => {
  it('memisah nama + alias dari sufiks dash, dan mengisi kategori/tag default', () => {
    const md = [
      '#### ⚒️ Keldrun — Dwarf',
      '> "Batu bertahan."',
      '',
      'Ras pengrajin yang menutup diri.',
    ].join('\n');

    const [e] = parseCodexMarkdown(md, { defaultCategory: 'character', defaultTags: ['lore/05_ras'] });
    expect(e.name).toBe('Keldrun');
    expect(e.aliases).toEqual(['Dwarf']);
    expect(e.category).toBe('character');
    expect(e.tags).toEqual(['lore/05_ras']);
    expect(e.headingLevel).toBe(4);
    expect(e.structural).toBe(false);
    expect(e.description).toBe('"Batu bertahan."\n\nRas pengrajin yang menutup diri.');
  });

  it('memecah beberapa heading jadi beberapa entri dengan badan masing-masing', () => {
    const md = [
      '### Ironbark',
      'Pohon yang mengkristalkan Arcanite.',
      '### Veinbloom',
      'Bunga ungu bahan alkhemi.',
    ].join('\n');

    const out = parseCodexMarkdown(md);
    expect(out.map((e) => e.name)).toEqual(['Ironbark', 'Veinbloom']);
    expect(out[1].description).toBe('Bunga ungu bahan alkhemi.');
    expect(out[0].category).toBe('other'); // fallback saat defaultCategory diabaikan
  });

  it('membuang emoji & penanda emphasis dari heading, mencatat level', () => {
    const out = parseCodexMarkdown('# ⚫ MOURNE\nIlvan kematian.');
    expect(out[0].name).toBe('MOURNE');
    expect(out[0].headingLevel).toBe(1);
  });

  it('menangkap alias dalam tanda kurung', () => {
    const out = parseCodexMarkdown('## Manusia (Human)\nRas termuda.');
    expect(out[0].name).toBe('Manusia');
    expect(out[0].aliases).toEqual(['Human']);
  });

  it('membuang penomoran depan lalu memisah dash', () => {
    const out = parseCodexMarkdown('## 2. Benua Valthera — Tanah Asal Peradaban\nBenua terbesar.');
    expect(out[0].name).toBe('Benua Valthera');
    expect(out[0].aliases).toEqual(['Tanah Asal Peradaban']);
  });

  it('memangkas penomoran bertingkat (4.0 / 8.1) sepenuhnya', () => {
    const out = parseCodexMarkdown('### 4.0 Asal-Usul Ras — Mengapa Mereka Ada\nDari Arcanite.');
    expect(out[0].name).toBe('Asal-Usul Ras');
    expect(out[0].aliases).toEqual(['Mengapa Mereka Ada']);
  });

  it('menandai heading tanpa badan (pemisah bagian) sebagai struktural', () => {
    const md = ['## Flora Resonan', '### Ironbark', 'Pohon yang mengkristalkan Arcanite.'].join('\n');
    const all = parseCodexMarkdown(md);
    expect(all[0].name).toBe('Flora Resonan');
    expect(all[0].structural).toBe(true); // body kosong → dianggap pemisah
    expect(parseCodexMarkdown(md, { dropStructural: true }).map((e) => e.name)).toEqual(['Ironbark']);
  });

  it('menandai heading struktural dan bisa dibuang lewat opsi', () => {
    const md = ['## Ringkasan Norma & Tabu\nDaftar ringkas.', '## Roadbond\nHak tamu di jalan.'].join('\n');
    const all = parseCodexMarkdown(md);
    expect(all[0].structural).toBe(true);
    expect(all[1].structural).toBe(false);

    const kept = parseCodexMarkdown(md, { dropStructural: true });
    expect(kept.map((e) => e.name)).toEqual(['Roadbond']);
  });
});

describe('parseCodexMarkdown — badan/tabel', () => {
  it('meratakan tabel: baris pemisah dibuang, sel digabung " · "', () => {
    const md = ['### Koin', '| Nama | Bahan |', '| --- | --- |', '| Dustmark | Tembaga |'].join('\n');
    const [e] = parseCodexMarkdown(md);
    expect(e.description).toContain('Dustmark · Tembaga');
    expect(e.description).not.toContain('---');
  });

  it('membersihkan blockquote, bullet, dan emphasis', () => {
    const md = ['### Keldrun', '> "Batu bertahan."', '', '- **Jalur:** Inscription'].join('\n');
    const [e] = parseCodexMarkdown(md);
    expect(e.description).toBe('"Batu bertahan."\n\n• Jalur: Inscription');
  });
});

describe('parseCodexMarkdown — blok tanpa heading (paste-quick-add)', () => {
  it('baris pertama pendek jadi nama, sisanya jadi deskripsi', () => {
    const [e] = parseCodexMarkdown('Ironhaven\nKota dermaga di sisi barat Kelmar.', {
      defaultCategory: 'location',
    });
    expect(e.name).toBe('Ironhaven');
    expect(e.category).toBe('location');
    expect(e.headingLevel).toBe(0);
    expect(e.description).toBe('Kota dermaga di sisi barat Kelmar.');
  });

  it('baris pertama berupa kalimat panjang: nama dipangkas, teks penuh tetap di deskripsi', () => {
    const long =
      'Vormar adalah lautan luas bertabur kepulauan yang menghubungkan semua benua sekaligus memisahkannya.';
    const [e] = parseCodexMarkdown(long);
    expect(e.name.length).toBeLessThanOrEqual(80);
    expect(e.name.startsWith('Vormar adalah lautan')).toBe(true);
    expect(e.description).toContain('memisahkannya.');
  });

  it('teks kosong menghasilkan daftar kosong', () => {
    expect(parseCodexMarkdown('   \n  ')).toEqual([]);
  });
});

describe('parseCodexMarkdown — alias', () => {
  it('membuang alias duplikat & yang sama dengan nama', () => {
    const [e] = parseCodexMarkdown('## Sylvor (Sylvor) — rimba-penyegel\nHutan sadar.');
    expect(e.name).toBe('Sylvor');
    expect(e.aliases).toEqual(['rimba-penyegel']);
  });
});
