/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '@/src/db';
import { CodexEntry, StoryBibleRule } from '@/src/types';
import { getCodexRegex } from '@/src/lib/utils';
import { AhoCorasick } from '@/src/lib/ahoCorasick';
import { pipeline, env } from '@xenova/transformers';
import { getEncoding, encodingForModel } from 'js-tiktoken';

// Configure transformers environment
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;

let embedder: any = null;
let embedderInitializing = false;
let modelInitPromise: Promise<any> | null = null;
let encoders = new Map<string, any>();

function getEncoderForModelOrStandard(model?: string): any {
  if (!model) return getEncoding('cl100k_base');
  
  if (encoders.has(model)) return encoders.get(model);
  
  try {
    // Try by model name
    const enc = encodingForModel(model as any);
    encoders.set(model, enc);
    return enc;
  } catch (e) {
    try {
      // Fallback
      const enc = getEncoding('cl100k_base');
      encoders.set(model, enc);
      return enc;
    } catch (e2) {
      return null;
    }
  }
}

function countTokens(text: string, model?: string): number {
  if (!text) return 0;
  const encoder = getEncoderForModelOrStandard(model);
  if (!encoder) {
    return Math.ceil(text.length / 4); // Fallback approximation
  }
  return encoder.encode(text).length;
}

// Cache for Codex embeddings in the worker: key is codex ID, value is { embedding, contentHash }
const embeddingCache = new Map<string | number, { embedding: Float32Array, contentHash: string }>();

async function getEmbedder() {
  if (embedder) return embedder;
  if (!modelInitPromise) {
    modelInitPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      progress_callback: (info: any) => {
         self.postMessage({ type: 'PROGRESS', payload: { type: 'model_download', info } });
      }
    });
  }
  embedder = await modelInitPromise;
  return embedder;
}

function dotProduct(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  // L2 Norm is already applied by 'normalize: true' in transformers.js
  // So dot product is equivalent to cosine similarity here.
  return dotProduct(a, b);
}

// Generate a string to uniquely identify the semantic content of an entry
function getCodexHash(entry: CodexEntry) {
  return `${entry.name}|${entry.aliases?.join(',')}|${entry.description}`;
}

async function getSemanticEmbedding(text: string): Promise<Float32Array> {
  const model = await getEmbedder();
  const result = await model(text, { pooling: 'mean', normalize: true });
  // result.data is already a Float32Array
  return result.data as Float32Array;
}

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

async function getRelevantContext(text: string, allCodex: CodexEntry[]): Promise<CodexEntry[]> {
  if (!text || !allCodex || allCodex.length === 0) return [];

  // 1. Exact Match Score (AhoCorasick)
  const keywords = allCodex.flatMap(entry => {
    const items = [];
    if (entry.name) {
      items.push({ word: entry.name, data: { entry, isAlias: false } });
    }
    if (entry.aliases && Array.isArray(entry.aliases)) {
      entry.aliases.forEach(alias => {
        if (alias) {
          items.push({ word: alias, data: { entry, isAlias: true } });
        }
      });
    }
    return items;
  });

  const entryScores = new Map<string | number, { entry: CodexEntry; acScore: number; semanticScore: number; finalScore: number }>();

  if (keywords.length > 0) {
    const ac = new AhoCorasick(keywords);
    const matches = ac.search(text);

    matches.forEach(match => {
      const { entry, isAlias } = match.data;
      if (!entry) return;
      const key = entry.id !== undefined ? entry.id : entry.name;

      const current = entryScores.get(key) || { entry, acScore: 0, semanticScore: 0, finalScore: 0 };
      current.acScore += isAlias ? 5 : 10;
      entryScores.set(key, current);
    });
  }

  // 2. Semantic Score (Transformers.js)
  try {
    const textEmbedding = await getSemanticEmbedding(text);

    // Compute or retrieve embeddings for all Codex entries
    let newlyEmbeddedCount = 0;

    // First classify what needs to be embedded to notify UI
    let missingEmbeddingsCount = 0;
    const missingKeys = [];
    for (const entry of allCodex) {
      const key = entry.id !== undefined ? entry.id : entry.name;
      const hash = getCodexHash(entry);
      let entryEmbeddingInfo = embeddingCache.get(key);
      if (!entryEmbeddingInfo || entryEmbeddingInfo.contentHash !== hash) {
        missingKeys.push({ entry, key, hash, compositeId: `${entry.projectId}_${key}` });
      }
    }
    
    if (missingKeys.length > 0) {
      try {
        const compositeIds = missingKeys.map(m => m.compositeId);
        const storedEmbeddings = await db.embeddings.bulkGet(compositeIds);
        
        for (let i = 0; i < missingKeys.length; i++) {
          const stored = storedEmbeddings[i];
          const m = missingKeys[i];
          if (stored && stored.contentHash === m.hash) {
             embeddingCache.set(m.key, { embedding: stored.embedding, contentHash: stored.contentHash });
          } else {
             missingEmbeddingsCount++; // Found out it truly implies work
          }
        }
      } catch (err) {
        console.warn("Failed to load embeddings from IndexedDB", err);
        missingEmbeddingsCount = missingKeys.length;
      }
    }
    
    // Notify UI we are starting to embed
    if (missingEmbeddingsCount > 0) {
       self.postMessage({ type: 'PROGRESS', payload: { type: 'embedding_start', total: missingEmbeddingsCount, completed: 0 } });
    }

    const toSaveToDb = [];

    for (const entry of allCodex) {
      const key = entry.id !== undefined ? entry.id : entry.name;
      const hash = getCodexHash(entry);
      
      let entryEmbeddingInfo = embeddingCache.get(key);
      if (!entryEmbeddingInfo || entryEmbeddingInfo.contentHash !== hash) {
        // Build concise semantic representation for the entry
        // Combine name, aliases, description and category for embedding
        const textToEmbed = `[${entry.category || 'General'}] ${entry.name}${entry.aliases?.length ? ` (aka ${entry.aliases.join(', ')})` : ''}: ${entry.description || ''}`;
        
        try {
           const embedding = await getSemanticEmbedding(textToEmbed);
           entryEmbeddingInfo = { embedding, contentHash: hash };
           embeddingCache.set(key, entryEmbeddingInfo);
           
           toSaveToDb.push({
             id: `${entry.projectId}_${key}`,
             projectId: entry.projectId,
             codexId: key,
             contentHash: hash,
             embedding: embedding,
             lastUpdated: Date.now()
           });
           
           newlyEmbeddedCount++;
           
           if (newlyEmbeddedCount % 5 === 0 || newlyEmbeddedCount === missingEmbeddingsCount) {
              self.postMessage({ type: 'PROGRESS', payload: { type: 'embedding_progress', total: missingEmbeddingsCount, completed: newlyEmbeddedCount } });
           }
           
           // Yield to event loop every 10 embeddings
           if (newlyEmbeddedCount % 10 === 0) {
             await new Promise(resolve => setTimeout(resolve, 0));
           }
        } catch (e) {
           console.error("Failed to embed entry", entry.name, e);
        }
      }

      if (entryEmbeddingInfo) {
        const similarity = cosineSimilarity(textEmbedding, entryEmbeddingInfo.embedding);
        const current = entryScores.get(key) || { entry, acScore: 0, semanticScore: 0, finalScore: 0 };
        current.semanticScore = similarity;
        entryScores.set(key, current);
      }
    }

    if (toSaveToDb.length > 0) {
      db.embeddings.bulkPut(toSaveToDb).catch(e => console.warn("Failed to save embeddings to db", e));
    }
    
    if (missingEmbeddingsCount > 0) {
       self.postMessage({ type: 'PROGRESS', payload: { type: 'embedding_done' } });
    }
  } catch (error) {
    console.error("Semantic search failed, falling back to pure AhoCorasick", error);
  }

  // 3. Hybrid Scoring
  const ALPHA = 60; // Weight multiplier for semantic score (similarity is usually 0.0 - 1.0)
  const BETA = 1.0; // Weight multiplier for AC score

  return Array.from(entryScores.values())
    .map(item => {
      // similarity is between -1 and 1, usually between 0 and 1. We scale semantic to ~0-60.
      const scaledSemantic = Math.max(0, item.semanticScore) * ALPHA;
      const scaledAc = item.acScore * BETA;
      
      // If there's an exact match, give it an extra boost to ensure it surfaces
      const exactMatchBoost = item.acScore > 0 ? 10 : 0;
      
      item.finalScore = scaledSemantic + scaledAc + exactMatchBoost;
      return item;
    })
    .filter(item => item.finalScore > 20) // Minimum threshold to filter out low-relevance
    .sort((a, b) => b.finalScore - a.finalScore)
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
self.onmessage = async (e: MessageEvent) => {
  const { type, id, payload } = e.data;

  try {
    let result;
    switch (type) {
      case 'GET_RELEVANT_CONTEXT':
        result = await getRelevantContext(payload.text, payload.allCodex);
        break;
      case 'GET_RELEVANT_BIBLE_RULES':
        result = getRelevantBibleRules(payload.text, payload.allRules, payload.maxChars);
        break;
      case 'INVALIDATE_CACHE':
        regexCache.clear();
        // Option to optionally clear embedding cache if needed
        if (payload?.deep) {
          embeddingCache.clear();
        }
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
      case 'COUNT_TOKENS':
        result = countTokens(payload.text, payload.model);
        break;
      case 'ESTIMATE_CONTEXT_TOKENS':
        result = {
           textTokens: countTokens(payload.text, payload.model),
           codexTokens: countTokens(payload.codexText, payload.model),
           rulesTokens: countTokens(payload.rulesText, payload.model),
        };
        break;
      case 'PREVIEW_CONTEXT_TOKENS': {
        const { text, allCodex, allRules, model } = payload;
        const relevantCodex = await getRelevantContext(text, allCodex);
        const relevantRules = getRelevantBibleRules(text, allRules, 2500); // Example depth
        
        const codexText = relevantCodex.map(e => `[${e.name}]: ${e.description}`).join(' ');
        const rulesText = relevantRules.map(r => `${r.key}: ${r.instruction}`).join(' ');
        
        result = {
           textTokens: countTokens(text, model),
           codexTokens: countTokens(codexText, model),
           rulesTokens: countTokens(rulesText, model),
           totalTokens: countTokens(text, model) + countTokens(codexText, model) + countTokens(rulesText, model)
        };
        break;
      }
      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    self.postMessage({ id, result });
  } catch (error: any) {
    self.postMessage({ id, error: error.message || 'Worker error' });
  }
};
