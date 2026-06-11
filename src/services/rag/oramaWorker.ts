import { oramaStore } from './oramaStore';
import { CodexEntry } from '@/src/types';

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  try {
    switch (type) {
      case 'INIT_ORAMA':
        await oramaStore.init(payload.projectId);
        break;
      case 'INDEX_ENTRY':
        await oramaStore.indexEntry(payload.entry);
        break;
      case 'UPDATE_ENTRY':
        await oramaStore.updateEntry(payload.entry);
        break;
      case 'REMOVE_ENTRY':
        await oramaStore.removeEntry(payload.dexieId);
        break;
      case 'SEARCH':
        // A search doesn't strictly need to be here but useful for consistency
        const results = await oramaStore.search(payload.query, payload.limit);
        self.postMessage({ type: 'SEARCH_RESULT', id: e.data.id, result: results });
        break;
      default:
        console.warn(`[OramaWorker] Unknown message type: ${type}`);
    }
  } catch (error) {
    console.error(`[OramaWorker] Error handling ${type}:`, error);
  }
};
