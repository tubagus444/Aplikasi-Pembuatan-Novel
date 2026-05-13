/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Indonesian suffixes/particles that can be attached to names.
 * Example: Kaelpun, Kaellah, Kaelnya.
 */
export const INDONESIAN_PARTICLES = "(nya|ku|mu|lah|kah|pun|toh)?";

/**
 * Creates a regex that is tolerant to Indonesian suffixes while maintaining word boundaries.
 * Using lookbehind and lookahead to ensure we don't match substrings (e.g., 'Kael' in 'Mikael').
 */
export function getCodexRegex(name: string, caseSensitive: boolean = false): RegExp {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // If the name starts or ends with non-word characters (like "A.I."), 
  // we fallback to a simpler boundary logic to avoid lookbehind/lookahead complexity.
  const isWordLike = /^\w.*?\w$/.test(name);
  
  if (!isWordLike) {
    const start = name[0] && /\w/.test(name[0]) ? '\\b' : '';
    const end = name[name.length - 1] && /\w/.test(name[name.length - 1]) ? '\\b' : '';
    return new RegExp(`(${start}${escapedName}${end})`, caseSensitive ? 'g' : 'gi');
  }

  // Indonesian boundary: 
  // 1. Lookbehind: Start of string OR non-alphanumeric
  // 2. Match: The name + optional Indonesian particles
  // 3. Lookahead: Non-alphanumeric OR end of string
  return new RegExp(`(?<=^|[^a-zA-Z0-9])(${escapedName}${INDONESIAN_PARTICLES})(?=[^a-zA-Z0-9]|$)`, caseSensitive ? 'g' : 'gi');
}

/**
 * Strips HTML tags and counts words in the content.
 */
export function countWords(htmlContent: string): number {
  if (!htmlContent) return 0;
  const plainText = htmlContent.replace(/<[^>]*>/g, ' ').trim();
  return plainText ? plainText.split(/\s+/).length : 0;
}
