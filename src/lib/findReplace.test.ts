import { describe, it, expect } from 'vitest';
import {
  escapeRegExp,
  buildSearchRegex,
  prepareReplacement,
  findInText,
  replaceInText,
} from './findReplace';

describe('escapeRegExp', () => {
  it('meng-escape metakarakter regex', () => {
    expect(escapeRegExp('a.b*c?')).toBe('a\\.b\\*c\\?');
    expect(escapeRegExp('(x)[y]')).toBe('\\(x\\)\\[y\\]');
  });
});

describe('buildSearchRegex', () => {
  it('null untuk query kosong', () => {
    expect(buildSearchRegex('', { caseSensitive: false, regex: false })).toBeNull();
  });

  it('non-regex memperlakukan query secara harfiah', () => {
    const re = buildSearchRegex('a.b', { caseSensitive: false, regex: false })!;
    expect('a.b'.match(re)).toHaveLength(1);
    expect('axb'.match(re)).toBeNull(); // titik harfiah, bukan wildcard
  });

  it('case-insensitive secara default, sensitif bila diminta', () => {
    expect('Kael kael'.match(buildSearchRegex('kael', { caseSensitive: false, regex: false })!)).toHaveLength(2);
    expect('Kael kael'.match(buildSearchRegex('kael', { caseSensitive: true, regex: false })!)).toHaveLength(1);
  });

  it('null untuk pola regex tidak valid', () => {
    expect(buildSearchRegex('(', { caseSensitive: false, regex: true })).toBeNull();
  });
});

describe('prepareReplacement', () => {
  it('meng-escape $ di mode non-regex', () => {
    expect(prepareReplacement('harga $5', false)).toBe('harga $$5');
  });
  it('membiarkan backref di mode regex', () => {
    expect(prepareReplacement('$1-$2', true)).toBe('$1-$2');
  });
});

describe('findInText', () => {
  it('menghitung kecocokan dan membatasi jumlah cuplikan', () => {
    const re = buildSearchRegex('kael', { caseSensitive: false, regex: false })!;
    const text = 'Kael berlari. kael melompat. KAEL diam.';
    const r = findInText(text, re, 2);
    expect(r.count).toBe(3);
    expect(r.snippets).toHaveLength(2);
    expect(r.snippets[0].match).toBe('Kael');
  });

  it('cuplikan memuat konteks sebelum/sesudah', () => {
    const re = buildSearchRegex('naga', { caseSensitive: false, regex: false })!;
    const r = findInText('Sang naga terbang', re, 5);
    expect(r.snippets[0].before).toContain('Sang ');
    expect(r.snippets[0].after).toContain(' terbang');
  });
});

describe('replaceInText', () => {
  it('mengganti semua kecocokan dan menghitungnya', () => {
    const re = buildSearchRegex('Kael', { caseSensitive: true, regex: false })!;
    const r = replaceInText('Kael dan Kael', re, prepareReplacement('Aria', false));
    expect(r.text).toBe('Aria dan Aria');
    expect(r.count).toBe(2);
  });

  it('tak mengubah teks bila tak ada kecocokan', () => {
    const re = buildSearchRegex('zzz', { caseSensitive: false, regex: false })!;
    const r = replaceInText('teks biasa', re, 'x');
    expect(r.text).toBe('teks biasa');
    expect(r.count).toBe(0);
  });

  it('memperlakukan $ pengganti secara harfiah di mode non-regex', () => {
    const re = buildSearchRegex('harga', { caseSensitive: false, regex: false })!;
    const r = replaceInText('harga itu', re, prepareReplacement('$5', false));
    expect(r.text).toBe('$5 itu');
  });

  it('mendukung backref di mode regex', () => {
    const re = buildSearchRegex('(\\w+)@(\\w+)', { caseSensitive: false, regex: true })!;
    const r = replaceInText('budi@mail', re, prepareReplacement('$2.$1', true));
    expect(r.text).toBe('mail.budi');
  });
});
