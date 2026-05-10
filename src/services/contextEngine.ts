/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CodexEntry, StoryBibleRule } from "../types";

const ALWAYS_INCLUDE = [
  '__STORY_TITLE__',
  '__GENRES__',
  '__TONES__',
  '__POV__',
  '__PACING__',
  '__THEMES__',
  '__TARGET_AUDIENCE__'
];

const SCORE_ALWAYS_INCLUDE = 1000;
const SCORE_WORD_MATCH = 15;
const SCORE_KEY_MATCH = 30;
const MIN_SCORE_THRESHOLD = 15;
const DEFAULT_MAX_CHARS = 1500;
const MIN_WORD_LENGTH = 4;

const regexCache = new Map<string, RegExp>();

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

/**
 * Generates an optimized regular expression with word boundaries.
 * Uses a caching strategy via a Map (regexCache) to prevent frequent 
 * recreation of unchanged RegExp instances, improving performance 
 * during large text scans.
 * Only applies word boundaries if characters are word characters (\w).
 * This supports names like "A.I." or "Mr. Smith" without regex failures.
 */
function getBoundaryRegex(name: string): RegExp {
  if (regexCache.has(name)) return regexCache.get(name)!;

  const escapedName = escapeRegExp(name);
  const startChar = name[0];
  const endChar = name[name.length - 1];
  
  const requireStartBoundary = startChar && /\w/.test(startChar);
  const requireEndBoundary = endChar && /\w/.test(endChar);
  
  const prefix = requireStartBoundary ? '\\b' : '';
  const suffix = requireEndBoundary ? '\\b' : '';
  
  const regex = new RegExp(`${prefix}${escapedName}${suffix}`, 'i');
  
  regexCache.set(name, regex);
  if (regexCache.size > 500) {
    const firstKey = regexCache.keys().next().value;
    if (firstKey) regexCache.delete(firstKey);
  }
  
  return regex;
}

/**
 * Filters the story bible rules to prevent context bottlenecks
 * during AI generation by capping irrelevant rules.
 */
export function getRelevantBibleRules(
  text: string,
  allRules: StoryBibleRule[],
  maxChars: number = DEFAULT_MAX_CHARS
): StoryBibleRule[] {
  if (!text) {
    return allRules.filter(r => ALWAYS_INCLUDE.includes(r.key));
  }

  const lowerText = text.toLowerCase();
  
  const scoredRules = allRules.map(rule => {
    let score = 0;
    
    // Core rules must always be included for stylistic consistency.
    if (ALWAYS_INCLUDE.includes(rule.key)) {
      score = SCORE_ALWAYS_INCLUDE;
    } else {
      // Find overlap with the current text
      const words = rule.instruction.toLowerCase().split(/[\s\W]+/);
      const uniqueWords = [...new Set(words)].filter(w => w.length > MIN_WORD_LENGTH); // require longer words for better relevance
      
      uniqueWords.forEach(w => {
        if (lowerText.includes(w)) {
          score += SCORE_WORD_MATCH;
        }
      });
      
      // Bonus if rule key words are mentioned
      const keyWords = rule.key.toLowerCase().split(/[\s_+]+/);
      keyWords.forEach(kw => {
        if (kw.length > 3 && lowerText.includes(kw)) {
          score += SCORE_KEY_MATCH;
        }
      });
    }
    
    return { rule, score };
  });

  // Sort by score descending
  // Require at least a score of 15 (one matched word) to include non-core rules
  const sortedRules = scoredRules
    .filter(item => item.score >= MIN_SCORE_THRESHOLD || item.score === SCORE_ALWAYS_INCLUDE)
    .sort((a, b) => b.score - a.score);

  const finalRules: StoryBibleRule[] = [];
  let currentChars = 0;

  for (const item of sortedRules) {
    const ruleChars = item.rule.key.length + item.rule.instruction.length;
    
    if (item.score === SCORE_ALWAYS_INCLUDE) {
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
