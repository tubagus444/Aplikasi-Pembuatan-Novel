/**
 * Find & Replace lintas-bab.
 *
 * Inti pencocokan/penggantian dipisah menjadi fungsi STRING MURNI (testable di Node)
 * — `escapeRegExp`, `buildSearchRegex`, `prepareReplacement`, `findInText`,
 * `replaceInText`. Bungkus DOM (`findInHtml`, `replaceInHtml`) hanya berjalan di browser
 * (butuh `DOMParser`) dan men-delegasi ke fungsi murni PER TEXT NODE, sehingga:
 *   - penggantian tak pernah merusak tag/atribut HTML (hanya menyentuh teks), dan
 *   - jumlah yang ditampilkan di pratinjau == jumlah yang benar-benar diganti
 *     (keduanya memakai basis text-node yang sama).
 *
 * Keterbatasan diketahui: kecocokan yang membentang melintasi batas tag inline
 * (mis. "wor<em>ld</em>") tak terdeteksi — wajar untuk find&replace prosa.
 */

export interface MatchSnippet {
  before: string;
  match: string;
  after: string;
}

export interface FindResult {
  count: number;
  snippets: MatchSnippet[];
}

export interface SearchOptions {
  caseSensitive: boolean;
  regex: boolean;
}

/** Escape semua metakarakter regex sehingga string dicocokkan secara harfiah. */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Bangun RegExp global dari query. Mengembalikan `null` bila query kosong atau pola
 * regex tidak valid (mode regex).
 */
export function buildSearchRegex(query: string, opts: SearchOptions): RegExp | null {
  if (!query) return null;
  try {
    const pattern = opts.regex ? query : escapeRegExp(query);
    return new RegExp(pattern, 'g' + (opts.caseSensitive ? '' : 'i'));
  } catch {
    return null; // pola regex tidak valid
  }
}

/**
 * Siapkan string pengganti. Di mode non-regex, `$` di-escape agar diperlakukan harfiah
 * (String.replace memperlakukan `$` sebagai karakter khusus). Di mode regex, backref
 * seperti `$1` dibiarkan aktif.
 */
export function prepareReplacement(replacement: string, regexMode: boolean): string {
  return regexMode ? replacement : replacement.split('$').join('$$');
}

/** Cari semua kecocokan di sepotong teks + kumpulkan cuplikan konteks (untuk pratinjau). */
export function findInText(
  text: string,
  regex: RegExp,
  maxSnippets: number,
  context = 32,
): FindResult {
  let count = 0;
  const snippets: MatchSnippet[] = [];
  for (const m of text.matchAll(regex)) {
    count++;
    if (snippets.length < maxSnippets) {
      const idx = m.index ?? 0;
      const matchText = m[0];
      const start = Math.max(0, idx - context);
      const end = Math.min(text.length, idx + matchText.length + context);
      snippets.push({
        before: (start > 0 ? '…' : '') + text.slice(start, idx),
        match: matchText,
        after: text.slice(idx + matchText.length, end) + (end < text.length ? '…' : ''),
      });
    }
  }
  return { count, snippets };
}

/** Ganti semua kecocokan di sepotong teks; kembalikan teks baru + jumlah penggantian. */
export function replaceInText(
  text: string,
  regex: RegExp,
  preparedReplacement: string,
): { text: string; count: number } {
  const matched = text.match(regex); // regex global → array semua kecocokan / null
  const count = matched ? matched.length : 0;
  if (count === 0) return { text, count: 0 };
  return { text: text.replace(regex, preparedReplacement), count };
}

// ── Bungkus DOM (browser-only) ────────────────────────────────────────────────

function collectTextNodes(html: string): { doc: Document; nodes: Text[] } {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) nodes.push(n as Text);
  return { doc, nodes };
}

/** Cari di konten HTML satu bab (hanya teks, bukan markup). */
export function findInHtml(html: string, regex: RegExp, maxSnippets: number): FindResult {
  const { nodes } = collectTextNodes(html);
  let count = 0;
  const snippets: MatchSnippet[] = [];
  for (const node of nodes) {
    const text = node.nodeValue ?? '';
    regex.lastIndex = 0;
    const r = findInText(text, regex, Math.max(0, maxSnippets - snippets.length));
    count += r.count;
    for (const s of r.snippets) if (snippets.length < maxSnippets) snippets.push(s);
  }
  return { count, snippets };
}

/** Ganti di konten HTML satu bab; kembalikan HTML baru + jumlah penggantian. */
export function replaceInHtml(
  html: string,
  regex: RegExp,
  preparedReplacement: string,
): { html: string; count: number } {
  const { doc, nodes } = collectTextNodes(html);
  let count = 0;
  for (const node of nodes) {
    const text = node.nodeValue ?? '';
    regex.lastIndex = 0;
    const r = replaceInText(text, regex, preparedReplacement);
    if (r.count > 0) {
      node.nodeValue = r.text;
      count += r.count;
    }
  }
  if (count === 0) return { html, count: 0 }; // tak ada perubahan → hindari normalisasi sia-sia
  return { html: doc.body.innerHTML, count };
}
