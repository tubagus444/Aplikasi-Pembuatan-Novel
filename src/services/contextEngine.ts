/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CodexEntry } from "../types";

/**
 * Scans text for names or aliases found in the codex.
 * Returns only the codex entries that are mentioned in the text.
 */
export function getRelevantContext(text: string, allCodex: CodexEntry[]): CodexEntry[] {
  if (!text) return [];
  
  const lowerText = text.toLowerCase();
  
  return allCodex.filter(entry => {
    // Check main name
    const nameRegex = new RegExp(`\\b${escapeRegExp(entry.name)}\\b`, 'i');
    if (nameRegex.test(lowerText)) {
      return true;
    }
    
    // Check aliases
    return entry.aliases.some(alias => {
      const aliasRegex = new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'i');
      return aliasRegex.test(lowerText);
    });
  });
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
