import { describe, it, expect } from 'vitest';
import {
  escapeXml,
  buildContainerXml,
  buildContentOpf,
  buildTocNcx,
  buildChapterXhtml,
  buildEpub,
  EpubOptions,
} from './epub';

const opts: EpubOptions = {
  title: 'Naga & "Pedang"',
  identifier: '1234-abcd',
  language: 'id',
  author: 'Penulis <X>',
  chapters: [
    { title: 'Bab Satu', xhtmlBody: '<p>Halo dunia.</p>' },
    { title: 'Bab Dua', xhtmlBody: '<p>Lanjutan.</p>' },
  ],
};

describe('escapeXml', () => {
  it('meng-escape karakter spesial XML', () => {
    expect(escapeXml('a & b < c > "d" \'e\'')).toBe('a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;');
  });
});

describe('buildContainerXml', () => {
  it('menunjuk ke content.opf', () => {
    expect(buildContainerXml()).toContain('full-path="OEBPS/content.opf"');
  });
});

describe('buildContentOpf', () => {
  const opf = buildContentOpf(opts, [
    { ...opts.chapters[0], id: 'chap1', file: 'chap1.xhtml' },
    { ...opts.chapters[1], id: 'chap2', file: 'chap2.xhtml' },
  ]);
  it('memuat judul ter-escape, identifier urn:uuid, dan creator', () => {
    expect(opf).toContain('<dc:title>Naga &amp; &quot;Pedang&quot;</dc:title>');
    expect(opf).toContain('urn:uuid:1234-abcd');
    expect(opf).toContain('<dc:creator>Penulis &lt;X&gt;</dc:creator>');
  });
  it('mendaftarkan ncx + semua bab di manifest & spine', () => {
    expect(opf).toContain('href="toc.ncx"');
    expect(opf).toContain('<item id="chap1" href="chap1.xhtml"');
    expect(opf).toContain('<itemref idref="chap2"/>');
  });
});

describe('buildTocNcx', () => {
  it('membuat navPoint per bab dengan playOrder berurutan', () => {
    const ncx = buildTocNcx(opts, [
      { ...opts.chapters[0], id: 'chap1', file: 'chap1.xhtml' },
      { ...opts.chapters[1], id: 'chap2', file: 'chap2.xhtml' },
    ]);
    expect(ncx).toContain('playOrder="1"');
    expect(ncx).toContain('playOrder="2"');
    expect(ncx).toContain('<text>Bab Satu</text>');
  });
});

describe('buildChapterXhtml', () => {
  it('menyisipkan judul sebagai h1 dan badan', () => {
    const x = buildChapterXhtml('Bab Satu', '<p>Halo.</p>');
    expect(x).toContain('<h1>Bab Satu</h1>');
    expect(x).toContain('<p>Halo.</p>');
    expect(x).toContain('xmlns="http://www.w3.org/1999/xhtml"');
  });
});

describe('buildEpub', () => {
  it('menghasilkan arsip ZIP yang diawali signature PK', () => {
    const bytes = buildEpub(opts);
    expect(bytes[0]).toBe(0x50); // 'P'
    expect(bytes[1]).toBe(0x4b); // 'K'
    expect(bytes.byteLength).toBeGreaterThan(100);
  });
});
