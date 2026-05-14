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
const MIN_SCORE_THRESHOLD = 25; // Raised threshold for leaner context
const DEFAULT_MAX_CHARS = 1200; // Lowered limit for leaner context
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
  
  const scored = allCodex.map(entry => {
    let score = 0;
    
    // Check main name
    const nameRegex = getBoundaryRegex(entry.name);
    const nameMatches = lowerText.match(nameRegex);
    if (nameMatches) {
      score += nameMatches.length * 10;
    }
    
    // Check aliases
    entry.aliases.forEach(alias => {
      const aliasRegex = getBoundaryRegex(alias);
      const aliasMatches = lowerText.match(aliasRegex);
      if (aliasMatches) {
        score += aliasMatches.length * 5;
      }
    });

    return { entry, score };
  });

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.entry);
}

function getRelevantBibleRules(
  text: string,
  allRules: StoryBibleRule[],
  maxChars: number = DEFAULT_MAX_CHARS
): StoryBibleRule[] {
  if (!text) {
    const alwaysRules = allRules.filter(r => ALWAYS_INCLUDE.includes(r.key));
    return condenseCoreRules(alwaysRules);
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

  const alwaysRules = sortedRules
    .filter(item => item.score === SCORE_ALWAYS_INCLUDE)
    .map(item => item.rule);
  
  const dynamicRules = sortedRules
    .filter(item => item.score !== SCORE_ALWAYS_INCLUDE);

  const finalRules: StoryBibleRule[] = condenseCoreRules(alwaysRules);
  let currentChars = finalRules.reduce((acc, r) => acc + r.key.length + r.instruction.length, 0);

  for (const item of dynamicRules) {
    const ruleChars = item.rule.key.length + item.rule.instruction.length;
    if (currentChars + ruleChars <= maxChars) {
      finalRules.push(item.rule);
      currentChars += ruleChars;
    }
  }

  return finalRules;
}

/**
 * Condenses core rules into a single rule to save tokens (reducing key overhead).
 */
function condenseCoreRules(rules: StoryBibleRule[]): StoryBibleRule[] {
  if (rules.length === 0) return [];
  
  // Clean up keys for display
  const formatKey = (key: string) => key.replace(/__/g, '').replace(/_/g, ' ').trim();

  let condensedInstruction = rules
    .map(r => `${formatKey(r.key)}: ${r.instruction.trim()}`)
    .join('\n');

  // Hard limit for core profile to avoid token blow-up (e.g., 2500 chars)
  if (condensedInstruction.length > 2500) {
    condensedInstruction = condensedInstruction.substring(0, 2500) + '... [Core truncated to save tokens]';
  }

  return [{
    id: -1, // Virtual ID
    isVirtual: true,
    projectId: rules[0].projectId,
    key: 'STORY_PROFILE',
    instruction: condensedInstruction
  }];
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
            // Reset lastIndex for test() because the regex is global/cached
            nameRegex.lastIndex = 0;
            if (nameRegex.test(lowerContent)) return true;
            return aliasesRegex.some((r: RegExp) => {
              r.lastIndex = 0;
              return r.test(lowerContent);
            });
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
