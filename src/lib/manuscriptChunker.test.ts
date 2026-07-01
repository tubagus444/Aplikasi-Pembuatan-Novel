import { describe, it, expect } from 'vitest';
import { htmlToPlainText, chunkChapter, hashChunk, CHUNK_MAX_WORDS } from '@/src/lib/manuscriptChunker';

describe('htmlToPlainText', () => {
  it('converts block tags to newlines and strips inline tags', () => {
    const out = htmlToPlainText('<p>Halo <strong>dunia</strong></p><p>Baris dua</p>');
    expect(out).toBe('Halo dunia\nBaris dua');
  });

  it('decodes common and numeric entities', () => {
    expect(htmlToPlainText('<p>Ratu&nbsp;&amp;&nbsp;Raja</p>')).toBe('Ratu & Raja');
    expect(htmlToPlainText('<p>caf&#233;</p>')).toBe('café');
  });

  it('collapses excess blank lines but keeps paragraph breaks', () => {
    const out = htmlToPlainText('<p>Satu</p><p></p><p></p><p>Dua</p>');
    expect(out).toBe('Satu\n\nDua');
  });
});

describe('chunkChapter', () => {
  it('returns empty for empty content', () => {
    expect(chunkChapter('')).toEqual([]);
    expect(chunkChapter('<p></p>')).toEqual([]);
  });

  it('splits scenes on *** separators', () => {
    const html = '<p>Adegan pertama di hutan yang gelap dan sunyi.</p><p>***</p><p>Adegan kedua di istana megah nan terang.</p>';
    const chunks = chunkChapter(html);
    expect(chunks.length).toBe(2);
    expect(chunks[0].text).toContain('hutan');
    expect(chunks[1].text).toContain('istana');
    expect(chunks.map(c => c.index)).toEqual([0, 1]);
  });

  it('drops chunks shorter than 4 words', () => {
    const chunks = chunkChapter('<p>Bab satu tentang perjalanan panjang menuju utara.</p><p>***</p><p>Tamat.</p>');
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toContain('perjalanan');
  });

  it('splits an overly long scene into multiple sub-chunks under the cap', () => {
    const sentence = 'Dia berjalan menyusuri lorong panjang yang gelap sambil memikirkan masa lalu. ';
    const longScene = `<p>${sentence.repeat(40)}</p>`; // ~440 kata, satu paragraf
    const chunks = chunkChapter(longScene);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.wordCount).toBeLessThanOrEqual(CHUNK_MAX_WORDS);
    }
  });
});

describe('hashChunk', () => {
  it('is stable and text-sensitive', () => {
    expect(hashChunk('halo dunia')).toBe(hashChunk('halo dunia'));
    expect(hashChunk('halo dunia')).not.toBe(hashChunk('halo Dunia'));
  });
});
