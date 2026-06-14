import { CodexEntry } from '@/src/types';
import { db } from '@/src/db';

// OramaWorker instance
let worker: Worker | null = null;
let messageIdCounter = 0;
const pendingRequests = new Map();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./oramaWorker.ts', import.meta.url), { type: 'module' });
    
    worker.onerror = (error) => {
      window.dispatchEvent(new ErrorEvent('error', { error: error, message: error.message }));
    };

    worker.onmessage = (e) => {
      const { type, id, result, error } = e.data;
      if (type === 'SEARCH_RESULT' && id !== undefined && pendingRequests.has(id)) {
        const { resolve, reject } = pendingRequests.get(id);
        pendingRequests.delete(id);
        if (error) reject(new Error(error));
        else resolve(result);
      }
    };
  }
  return worker;
}

export const oramaSync = {
  setupHooks: () => {
    // Only set up hooks if we are in the main window to avoid nested worker loops
    if (typeof window !== 'undefined') {
      db.codex.hook('creating', (primKey, obj, transaction) => {
        transaction.on('complete', () => {
          oramaSync.indexEntry({ ...obj, id: primKey });
        });
      });

      db.codex.hook('updating', (modifications, primKey, obj, transaction) => {
        transaction.on('complete', () => {
          oramaSync.updateEntry({ ...obj, ...modifications, id: primKey });
        });
      });

      db.codex.hook('deleting', (primKey, obj, transaction) => {
        transaction.on('complete', () => {
          oramaSync.removeEntry(primKey);
        });
      });
    }
  },
  init: (projectId: number) => {
    getWorker().postMessage({ type: 'INIT_ORAMA', payload: { projectId } });
  },
  indexEntry: (entry: CodexEntry) => {
    getWorker().postMessage({ type: 'INDEX_ENTRY', payload: { entry } });
  },
  updateEntry: (entry: CodexEntry) => {
    getWorker().postMessage({ type: 'UPDATE_ENTRY', payload: { entry } });
  },
  removeEntry: (dexieId: number) => {
    getWorker().postMessage({ type: 'REMOVE_ENTRY', payload: { dexieId } });
  },
  search: (query: string, limit: number = 5): Promise<CodexEntry[]> => {
    return new Promise((resolve, reject) => {
      const id = ++messageIdCounter;
      pendingRequests.set(id, { resolve, reject });
      getWorker().postMessage({ id, type: 'SEARCH', payload: { query, limit } });
    });
  }
};
