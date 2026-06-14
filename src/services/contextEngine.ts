/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '@/src/db';
import { CodexEntry, StoryBibleRule } from '@/src/types';
import ContextWorker from '@/src/services/contextWorker?worker';
import { oramaSync } from '@/src/services/rag/oramaSync';

// Worker instance and communication state
let worker: Worker | null = null;
let requestId = 0;
const pendingRequests = new Map<number, { resolve: (val: any) => void, reject: (err: any) => void }>();

function terminateWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  const error = new Error('Context worker was terminated or crashed');
  pendingRequests.forEach(deferred => deferred.reject(error));
  pendingRequests.clear();
}

function getWorker(): Worker {
  if (!worker) {
    worker = new ContextWorker();
    worker.onmessage = (e: MessageEvent) => {
      const { id, result, error, type, payload } = e.data;
      if (type === 'PROGRESS') {
        window.dispatchEvent(new CustomEvent('semantic-indexing-progress', { detail: payload }));
        return;
      }
      const deferred = pendingRequests.get(id);
      if (deferred) {
        pendingRequests.delete(id);
        if (error) deferred.reject(new Error(error));
        else deferred.resolve(result);
      }
    };
    worker.onerror = (e) => {
      console.error('Context Worker Error:', e);
      window.dispatchEvent(new ErrorEvent('error', { error: e.error, message: e.message }));
      terminateWorker();
    };
  }
  return worker;
}

function sendToWorker(type: string, payload: any): Promise<any> {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    // 30 second timeout for heavy processing
    const timeoutId = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`Context engine worker request timed out (${type})`));
      }
    }, 30000);

    pendingRequests.set(id, { 
      resolve: (val) => {
        clearTimeout(timeoutId);
        resolve(val);
      }, 
      reject: (err) => {
        clearTimeout(timeoutId);
        reject(err);
      } 
    });
    
    try {
      getWorker().postMessage({ type, id, payload });
    } catch (err) {
      clearTimeout(timeoutId);
      pendingRequests.delete(id);
      reject(err);
    }
  });
}

/**
 * Scans text for names or aliases found in the codex via Web Worker.
 * Augments the exact-match results with semantic matches from Orama local RAG.
 */
export async function getRelevantContext(text: string, allCodex: CodexEntry[]): Promise<CodexEntry[]> {
  if (!text) return [];
  
  // 1. Exact string matching (Aho-Corasick in worker)
  const exactMatches = await sendToWorker('GET_RELEVANT_CONTEXT', { text, allCodex });
  
  // 2. Semantic matching with Orama
  // Use a smaller text slice to prevent Orama from choking on huge paragraphs. 
  // We prefer the most recent lines of interaction.
  const searchSlice = text.length > 500 ? text.substring(text.length - 500) : text;
  
  let semanticMatches: CodexEntry[] = [];
  try {
    semanticMatches = await oramaSync.search(searchSlice, 5);
  } catch (err) {
    console.warn("[RAG] Orama semantic search failed", err);
  }

  // Deduplicate
  const mergedMap = new Map<number, CodexEntry>();
  exactMatches.forEach((e: CodexEntry) => { if (e.id) mergedMap.set(e.id, e); });
  semanticMatches.forEach((e: CodexEntry) => { if (e.id) mergedMap.set(e.id, e); });
  
  return Array.from(mergedMap.values());
}

/**
 * Searches the given text chunks for codex entries utilizing the context worker
 */
export async function getCodexMatches(chunks: {pos: number; text: string}[], allCodex: CodexEntry[]): Promise<{start: number; end: number; codexId: number}[]> {
  if (!chunks || chunks.length === 0 || !allCodex || allCodex.length === 0) return [];
  return sendToWorker('GET_CODEX_MATCHES', { chunks, allCodex });
}

export async function invalidateContextCache() {
  return sendToWorker('INVALIDATE_CACHE', {});
}

/**
 * Scans all chapters to find where a specific codex entry is mentioned.
 */
export async function getEntryAppearances(entry: CodexEntry, projectId: number): Promise<number[]> {
  const chapters = await db.chapters.where('projectId').equals(projectId).toArray();
  return sendToWorker('SCAN_APPEARANCES', { entry, chapters });
}

/**
 * Filters the story bible rules via Web Worker to prevent main thread blocking.
 */
export async function getRelevantBibleRules(
  text: string,
  allRules: StoryBibleRule[],
  maxChars: number = 1500
): Promise<StoryBibleRule[]> {
  if (!text) {
    return allRules.filter(r => [
      '__STORY_TITLE__', '__GENRES__', '__TONES__', '__POV__', 
      '__PACING__', '__THEMES__', '__TARGET_AUDIENCE__'
    ].includes(r.key));
  }
  return sendToWorker('GET_RELEVANT_BIBLE_RULES', { text, allRules, maxChars });
}

export async function countTokens(text: string, model?: string): Promise<number> {
  if (!text) return 0;
  return sendToWorker('COUNT_TOKENS', { text, model });
}

export async function estimateContextTokens(text: string, codexText: string, rulesText: string, model?: string): Promise<{textTokens: number, codexTokens: number, rulesTokens: number}> {
  return sendToWorker('ESTIMATE_CONTEXT_TOKENS', { text, codexText, rulesText, model });
}

export async function previewContextTokens(text: string, allCodex: CodexEntry[], allRules: StoryBibleRule[], model?: string): Promise<{textTokens: number, codexTokens: number, rulesTokens: number, totalTokens: number}> {
  return sendToWorker('PREVIEW_CONTEXT_TOKENS', { text, allCodex, allRules, model });
}
