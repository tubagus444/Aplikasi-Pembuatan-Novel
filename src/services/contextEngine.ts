/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CodexEntry, StoryBibleRule } from "../types";

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Scans text for names or aliases found in the codex.
 * Returns only the codex entries that are mentioned in the text.
 */
export function getRelevantContext(text: string, allCodex: CodexEntry[]): CodexEntry[] {
  if (!text) return [];
  
  const lowerText = text.toLowerCase();
  
  return allCodex.filter(entry => {
    // Check main name
    const nameRegex = getBoundaryRegex(entry.name);
    if (nameRegex.test(lowerText)) {
      return true;
    }
    
    // Check aliases
    return entry.aliases.some(alias => {
      const aliasRegex = getBoundaryRegex(alias);
      return aliasRegex.test(lowerText);
    });
  });
}

function getBoundaryRegex(name: string): RegExp {
  const escapedName = escapeRegExp(name);
  const startChar = name[0];
  const endChar = name[name.length - 1];
  
  // Only apply word boundaries if characters are word characters.
  // This supports names like "A.I." or "Mr. Smith" without regex failures.
  const requireStartBoundary = startChar && /\w/.test(startChar);
  const requireEndBoundary = endChar && /\w/.test(endChar);
  
  const prefix = requireStartBoundary ? '\\b' : '';
  const suffix = requireEndBoundary ? '\\b' : '';
  
  return new RegExp(`${prefix}${escapedName}${suffix}`, 'i');
}

/**
 * Filters the story bible rules to prevent context bottlenecks
 * during AI generation by capping irrelevant rules.
 */
export function getRelevantBibleRules(text: string, allRules: StoryBibleRule[]): StoryBibleRule[] {
  if (!text) return allRules;
  const lowerText = text.toLowerCase();
  
  const ALWAYS_INCLUDE = ['__STORY_TITLE__', '__GENRES__', '__TONES__', '__POV__', '__PACING__'];
  
  const scoredRules = allRules.map(rule => {
    let score = 0;
    
    // Core rules must always be included for stylistic consistency.
    if (ALWAYS_INCLUDE.includes(rule.key)) {
      score = 1000;
    } else {
      // Find overlap with the current text
      const words = rule.instruction.toLowerCase().split(/[\s\W]+/);
      const uniqueWords = [...new Set(words)].filter(w => w.length > 3);
      
      uniqueWords.forEach(w => {
        if (lowerText.includes(w)) {
          score += 10;
        }
      });
      
      // Give a slight boost if it's very short, to not lose small contextual rules
      if (rule.instruction.length < 150) {
        score += 5;
      }
    }
    
    return { rule, score };
  });

  // Filter to keep core rules + top 5 relevant long rules to avoid token bloat
  return scoredRules
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10) 
    .map(item => item.rule);
}
