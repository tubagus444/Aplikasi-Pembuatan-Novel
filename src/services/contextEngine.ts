/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from "../db";
import { CodexEntry, StoryBibleRule, StoryBeat } from "../types";
import ContextWorker from './contextWorker?worker';

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
      const { id, result, error } = e.data;
      const deferred = pendingRequests.get(id);
      if (deferred) {
        pendingRequests.delete(id);
        if (error) deferred.reject(new Error(error));
        else deferred.resolve(result);
      }
    };
    worker.onerror = (e) => {
      console.error('Context Worker Error:', e);
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
 */
export async function getRelevantContext(text: string, allCodex: CodexEntry[]): Promise<CodexEntry[]> {
  if (!text) return [];
  return sendToWorker('GET_RELEVANT_CONTEXT', { text, allCodex });
}

export async function invalidateContextCache() {
  return sendToWorker('INVALIDATE_CACHE', {});
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

export async function getChapterBeats(chapterId: number): Promise<StoryBeat[]> {
  try {
    return await db.timeline
      .where('chapterId')
      .equals(chapterId)
      .sortBy('order');
  } catch (err) {
    console.error('Error fetching chapter beats:', err);
    return [];
  }
}
