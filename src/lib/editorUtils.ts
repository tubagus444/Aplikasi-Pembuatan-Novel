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
