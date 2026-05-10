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
export function getRelevantBibleRules(
  text: string,
  allRules: StoryBibleRule[],
  maxChars: number = 1500
): StoryBibleRule[] {
  const ALWAYS_INCLUDE = [
    '__STORY_TITLE__',
    '__GENRES__',
    '__TONES__',
    '__POV__',
    '__PACING__',
    '__THEMES__',
    '__TARGET_AUDIENCE__'
  ];
  
  if (!text) {
    return allRules.filter(r => ALWAYS_INCLUDE.includes(r.key));
  }

  const lowerText = text.toLowerCase();
  
  const scoredRules = allRules.map(rule => {
    let score = 0;
    
    // Core rules must always be included for stylistic consistency.
    if (ALWAYS_INCLUDE.includes(rule.key)) {
      score = 1000;
    } else {
      // Find overlap with the current text
      const words = rule.instruction.toLowerCase().split(/[\s\W]+/);
      const uniqueWords = [...new Set(words)].filter(w => w.length > 4); // require longer words for better relevance
      
      uniqueWords.forEach(w => {
        if (lowerText.includes(w)) {
          score += 15;
        }
      });
      
      // Bonus if rule key words are mentioned
      const keyWords = rule.key.toLowerCase().split(/[\s_+]+/);
      keyWords.forEach(kw => {
        if (kw.length > 3 && lowerText.includes(kw)) {
          score += 30;
        }
      });
    }
    
    return { rule, score };
  });

  // Sort by score descending
  // Require at least a score of 15 (one matched word) to include non-core rules
  const sortedRules = scoredRules
    .filter(item => item.score >= 15 || item.score === 1000)
    .sort((a, b) => b.score - a.score);

  const finalRules: StoryBibleRule[] = [];
  let currentChars = 0;

  for (const item of sortedRules) {
    const ruleChars = item.rule.key.length + item.rule.instruction.length;
    
    if (item.score === 1000) {
      // Always include global rules, even if they bypass the max characters
      finalRules.push(item.rule);
      currentChars += ruleChars;
    } else {
      // For context specific rules, respect the character limit limit
      if (currentChars + ruleChars <= maxChars) {
        finalRules.push(item.rule);
        currentChars += ruleChars;
      }
    }
  }

  return finalRules;
}
