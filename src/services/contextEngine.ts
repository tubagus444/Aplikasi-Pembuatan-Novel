/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CodexEntry, StoryBibleRule } from "../types";
import ContextWorker from './contextWorker?worker';

// Worker instance and communication state
let worker: Worker | null = null;
let requestId = 0;
const pendingRequests = new Map<number, { resolve: (val: any) => void, reject: (err: any) => void }>();

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
    };
  }
  return worker;
}

function sendToWorker(type: string, payload: any): Promise<any> {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    getWorker().postMessage({ type, id, payload });
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
