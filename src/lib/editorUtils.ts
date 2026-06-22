/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Strips HTML tags from a string to get plain text.
 * Useful for exports and character counting.
 */
export function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
}

/**
 * Melepas mark "catatan revisi" dari HTML bab: span[data-comment-id] di-unwrap
 * (teksnya dipertahankan, sorotan + atribut data-note dibuang). Dipakai sebelum
 * EKSPOR agar catatan pribadi penulis tidak ikut bocor ke berkas hasil
 * (mis. atribut data-note di sumber EPUB/XHTML). Tidak mengubah data tersimpan.
 */
export function stripRevisionComments(html: string): string {
  if (!html || html.indexOf('data-comment-id') === -1) return html || '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.body.querySelectorAll('span[data-comment-id]').forEach((span) => {
    // Ganti span dengan isi anak-anaknya (unwrap), pertahankan teks & format dalam.
    const parent = span.parentNode;
    if (!parent) return;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
  });
  return doc.body.innerHTML;
}

/**
 * Very basic HTML to Markdown converter for simple naskah needs.
 * Handles bold, italic, and paragraphs.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  
  let md = html;
  
  // Replace paragraphs with newlines
  md = md.replace(/<\/p><p>/g, '\n\n');
  md = md.replace(/<p>/g, '');
  md = md.replace(/<\/p>/g, '\n\n');
  
  // Bold
  md = md.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
  md = md.replace(/<b>(.*?)<\/b>/g, '**$1**');
  
  // Italic
  md = md.replace(/<em>(.*?)<\/em>/g, '*$1*');
  md = md.replace(/<i>(.*?)<\/i>/g, '*$1*');
  
  // Strip any other tags
  const doc = new DOMParser().parseFromString(md, 'text/html');
  return (doc.body.textContent || "").trim();
}

/**
 * Gets a focused window of text around the current cursor position.
 * Helps reduce token usage while maintaining relevant context.
 * 
 * @param text The full manuscript text
 * @param cursorIndex The current insertion point index
 * @param windowSize Total size of context window (~chars)
 */
export function getActiveWindowText(text: string, cursorIndex: number, windowSize: number = 2000): string {
  if (!text) return '';
  if (text.length <= windowSize) return text;

  const halfWindow = Math.floor(windowSize / 2);
  let start = Math.max(0, cursorIndex - halfWindow);
  let end = Math.min(text.length, cursorIndex + halfWindow);

  // Adjust to not cut in the middle of a word if possible
  // Find previous space/newline for start
  if (start > 0) {
    const prevSpace = text.lastIndexOf(' ', start);
    const prevNewline = text.lastIndexOf('\n', start);
    start = Math.max(prevSpace, prevNewline, 0);
  }

  // Find next space/newline for end
  if (end < text.length) {
    const nextSpace = text.indexOf(' ', end);
    const nextNewline = text.indexOf('\n', end);
    
    // Pick the closest one that is not -1
    const candidates = [nextSpace, nextNewline].filter(i => i !== -1);
    if (candidates.length > 0) {
      end = Math.min(...candidates);
    }
  }

  const windowText = text.substring(start, end).trim();
  
  // Add elliptical markers to indicate it's a snippet
  let result = windowText;
  if (start > 0) result = '... ' + result;
  if (end < text.length) result = result + ' ...';
  
  return result;
}
