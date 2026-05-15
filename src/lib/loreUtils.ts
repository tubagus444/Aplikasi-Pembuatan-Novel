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
    const lowerSearch = searchName.toLowerCase();
    
    const entry = codexEntries.find(e => 
      e.name.toLowerCase() === lowerSearch || 
      e.name === name ||
      (e.aliases && e.aliases.some(alias => alias.toLowerCase() === lowerSearch || alias.replace(/_/g, ' ').toLowerCase() === lowerSearch))
    );

    if (!entry) return match;

    let description = entry.description;
    if (description.length > 150) {
      description = description.substring(0, 150);
      const lastSpace = description.lastIndexOf(' ');
      if (lastSpace > 0) {
        description = description.substring(0, lastSpace);
      }
      description += '...';
    }

    return `[Lore - ${entry.name}: ${description}]`;
  });

  return resolved;
}

export interface MentionSegment {
  text: string;
  isMention: boolean;
  type?: 'codex' | 'rule' | 'chapter';
  value?: string;
  original?: string;
}

/**
 * Parses a string into segments of text and mentions for visual rendering.
 */
export function parseMentionTags(input: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  // Regex to match @rule:key, @codex:name, @chapter-excerpt, @chapter-summary
  const mentionRegex = /@(codex|rule):(\S+)|@(chapter-excerpt|chapter-summary)/g;
  
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(input)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      segments.push({
        text: input.substring(lastIndex, match.index),
        isMention: false
      });
    }

    // Add the mention segment
    if (match[3]) {
      segments.push({
        text: match[3],
        isMention: true,
        type: 'chapter',
        value: match[3],
        original: match[0]
      });
    } else {
      segments.push({
        text: match[2].replace(/_/g, ' '), // Display name (replacing underscores)
        isMention: true,
        type: match[1] as 'codex' | 'rule',
        value: match[2],
        original: match[0]
      });
    }

    lastIndex = mentionRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < input.length) {
    segments.push({
      text: input.substring(lastIndex),
      isMention: false
    });
  }

  return segments;
}
