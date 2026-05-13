/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CodexEntry, StoryBibleRule } from "../types";
import { getCodexRegex } from "../lib/utils";

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

function getBoundaryRegex(name: string): RegExp {
  if (regexCache.has(name)) {
    const cached = regexCache.get(name)!;
    // Move to end to mark as most recently used
    regexCache.delete(name);
    regexCache.set(name, cached);
    return cached;
  }

  const regex = getCodexRegex(name);
  
  regexCache.set(name, regex);
  if (regexCache.size > 500) {
    // The first element in the iteration order is the least recently used
    const firstKey = regexCache.keys().next().value;
    if (firstKey !== undefined) regexCache.delete(firstKey);
  }
  
  return regex;
}

function getRelevantContext(text: string, allCodex: CodexEntry[]): CodexEntry[] {
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

function getRelevantBibleRules(
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
    
    if (ALWAYS_INCLUDE.includes(rule.key)) {
      score = SCORE_ALWAYS_INCLUDE;
    } else {
      // Refined split to preserve hyphens and handle word characters correctly
      const words = rule.instruction.toLowerCase().split(/[^\w-]+/);
      const uniqueWords = [...new Set(words)].filter(w => w.length > MIN_WORD_LENGTH);
      
      uniqueWords.forEach(w => {
        if (lowerText.includes(w)) {
          score += SCORE_WORD_MATCH;
        }
      });
      
      const keyWords = rule.key.toLowerCase().split(/[\s_+]+/);
      keyWords.forEach(kw => {
        if (kw.length > 3 && lowerText.includes(kw)) {
          score += SCORE_KEY_MATCH;
        }
      });
    }
    
    return { rule, score };
  });

  const sortedRules = scoredRules
    .filter(item => item.score >= MIN_SCORE_THRESHOLD || item.score === SCORE_ALWAYS_INCLUDE)
    .sort((a, b) => b.score - a.score);

  const finalRules: StoryBibleRule[] = [];
  let currentChars = 0;

  for (const item of sortedRules) {
    const ruleChars = item.rule.key.length + item.rule.instruction.length;
    
    if (item.score === SCORE_ALWAYS_INCLUDE) {
      finalRules.push(item.rule);
      currentChars += ruleChars;
    } else {
      if (currentChars + ruleChars <= maxChars) {
        finalRules.push(item.rule);
        currentChars += ruleChars;
      }
    }
  }

  return finalRules;
}

// Worker message listener
self.onmessage = (e: MessageEvent) => {
  const { type, id, payload } = e.data;

  try {
    let result;
    switch (type) {
      case 'GET_RELEVANT_CONTEXT':
        result = getRelevantContext(payload.text, payload.allCodex);
        break;
      case 'GET_RELEVANT_BIBLE_RULES':
        result = getRelevantBibleRules(payload.text, payload.allRules, payload.maxChars);
        break;
      case 'INVALIDATE_CACHE':
        regexCache.clear();
        result = { success: true };
        break;
      case 'SCAN_APPEARANCES':
        const { entry, chapters } = payload;
        const nameRegex = getBoundaryRegex(entry.name);
        const aliasesRegex = (entry.aliases || []).map((a: string) => getBoundaryRegex(a));
        
        result = chapters
          .filter((ch: any) => {
            const lowerContent = (ch.content || '').toLowerCase();
            if (nameRegex.test(lowerContent)) return true;
            return aliasesRegex.some((r: RegExp) => r.test(lowerContent));
          })
          .map((ch: any) => ch.id);
        break;
      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    self.postMessage({ id, result });
  } catch (error: any) {
    self.postMessage({ id, error: error.message || 'Worker error' });
  }
};
