/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CodexEntry, StoryBibleRule } from '../types';

/**
 * Resolves lore tags like @rule:key and @codex:name into more descriptive
 * text that the AI can understand better.
 */
export function resolveLoreTags(
  input: string, 
  codexEntries: CodexEntry[] = [], 
  bibleRules: StoryBibleRule[] = []
): string {
  let resolved = input;
  
  // Resolve rules: @rule:key
  // Matches @rule: followed by non-whitespace characters
  resolved = resolved.replace(/@rule:(\S+)/g, (match, key) => {
    const rule = bibleRules.find(r => r.key === key);
    return rule ? `[Rule - ${key}: ${rule.instruction}]` : match;
  });

  // Resolve codex: @codex:name
  // Matches @codex: followed by non-whitespace characters
  resolved = resolved.replace(/@codex:(\S+)/g, (match, name) => {
    // Replace underscores with spaces for matching if users type @codex:Character_Name
    const searchName = name.replace(/_/g, ' ');
    const entry = codexEntries.find(e => e.name.toLowerCase() === searchName.toLowerCase() || e.name === name);
    return entry ? `[Lore - ${entry.name}: ${entry.description.substring(0, 150)}]` : match;
  });

  return resolved;
}
