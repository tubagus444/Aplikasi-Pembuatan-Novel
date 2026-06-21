/**
 * Perakit EPUB 2 minimal (kompatibel luas) di atas penulis ZIP lokal (`zip.ts`).
 *
 * Pembentukan XML bersifat MURNI (string) sehingga dapat diuji di Node; satu-satunya
 * bagian yang butuh DOM (konversi HTML bab → badan XHTML well-formed) dilakukan pemanggil
 * di sisi browser dan dikirim lewat `EpubChapter.xhtmlBody`.
 */

import { createZip, ZipEntry } from './zip';

export interface EpubChapter {
  /** Judul bab (dipakai di <h1>, nav, dan label NCX). */
  title: string;
  /** Badan XHTML well-formed (tanpa <body>), hasil konversi konten HTML bab. */
  xhtmlBody: string;
}

export interface EpubOptions {
  title: string;
  identifier: string; // UUID mentah; akan diformat sebagai urn:uuid:...
  language?: string;
  author?: string;
  chapters: EpubChapter[];
}

interface ChapterFile extends EpubChapter {
  id: string;
  file: string;
}

export function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildContainerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

export function buildContentOpf(opts: EpubOptions, chapters: ChapterFile[]): string {
  const uid = `urn:uuid:${escapeXml(opts.identifier)}`;
  const creator = opts.author
    ? `\n    <dc:creator>${escapeXml(opts.author)}</dc:creator>`
    : '';
  const manifestItems = chapters
    .map(c => `    <item id="${c.id}" href="${c.file}" media-type="application/xhtml+xml"/>`)
    .join('\n');
  const spineItems = chapters
    .map(c => `    <itemref idref="${c.id}"/>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${escapeXml(opts.title)}</dc:title>
    <dc:language>${escapeXml(opts.language || 'id')}</dc:language>
    <dc:identifier id="bookid">${uid}</dc:identifier>${creator}
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${manifestItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`;
}

export function buildTocNcx(opts: EpubOptions, chapters: ChapterFile[]): string {
  const navPoints = chapters
    .map((c, i) => `    <navPoint id="nav${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${escapeXml(c.title)}</text></navLabel>
      <content src="${c.file}"/>
    </navPoint>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${escapeXml(opts.identifier)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(opts.title)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`;
}

export function buildChapterXhtml(title: string, xhtmlBody: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(title)}</title>
</head>
<body>
  <h1>${escapeXml(title)}</h1>
${xhtmlBody}
</body>
</html>`;
}

/** Rakit seluruh berkas EPUB menjadi satu Uint8Array siap di-Blob-kan. */
export function buildEpub(opts: EpubOptions): Uint8Array {
  const enc = new TextEncoder();
  const chapters: ChapterFile[] = opts.chapters.map((c, i) => ({
    ...c,
    id: `chap${i + 1}`,
    file: `chap${i + 1}.xhtml`,
  }));

  // mimetype WAJIB entri pertama & stored (terpenuhi oleh createZip).
  const entries: ZipEntry[] = [
    { name: 'mimetype', data: enc.encode('application/epub+zip') },
    { name: 'META-INF/container.xml', data: enc.encode(buildContainerXml()) },
    { name: 'OEBPS/content.opf', data: enc.encode(buildContentOpf(opts, chapters)) },
    { name: 'OEBPS/toc.ncx', data: enc.encode(buildTocNcx(opts, chapters)) },
  ];
  for (const c of chapters) {
    entries.push({
      name: `OEBPS/${c.file}`,
      data: enc.encode(buildChapterXhtml(c.title, c.xhtmlBody)),
    });
  }

  return createZip(entries);
}
